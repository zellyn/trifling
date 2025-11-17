package docgen

//go:generate go run generate.go

import (
	"bytes"
	"fmt"
	"html"
	"os"
	"path/filepath"
	"strings"

	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer"
	goldmarkhtml "github.com/yuin/goldmark/renderer/html"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"
)

// RunnableCodeBlock represents a Python code block that can be executed
type RunnableCodeBlock struct {
	ast.BaseBlock
	Mode string // "text" or "graphics"
	Code string
}

// Dump implements ast.Node
func (n *RunnableCodeBlock) Dump(source []byte, level int) {
	ast.DumpHelper(n, source, level, nil, nil)
}

// Kind implements ast.Node
func (n *RunnableCodeBlock) Kind() ast.NodeKind {
	return ast.KindCodeBlock
}

// ASTTransformer transforms fenced code blocks with python-editor-* languages into RunnableCodeBlock nodes
type ASTTransformer struct{}

func (t *ASTTransformer) Transform(node *ast.Document, reader text.Reader, pc parser.Context) {
	// First pass: collect all nodes to transform
	// We can't modify the tree while walking it, so we collect first
	type replacement struct {
		parent      ast.Node
		oldNode     ast.Node
		newNode     ast.Node
	}
	var replacements []replacement

	ast.Walk(node, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}

		fencedBlock, ok := n.(*ast.FencedCodeBlock)
		if !ok {
			return ast.WalkContinue, nil
		}

		// Get the language/info from the code block
		if fencedBlock.Info == nil {
			return ast.WalkContinue, nil
		}

		lang := string(fencedBlock.Info.Text(reader.Source()))
		lang = strings.TrimSpace(lang)

		// Check if it's one of our special types
		var mode string
		if lang == "python-editor-text" {
			mode = "text"
		} else if lang == "python-editor-graphics" {
			mode = "graphics"
		} else {
			// Not our special code block
			return ast.WalkContinue, nil
		}

		// Extract the code from the fenced block
		var code strings.Builder
		lines := fencedBlock.Lines()
		for i := 0; i < lines.Len(); i++ {
			line := lines.At(i)
			code.Write(line.Value(reader.Source()))
		}

		// Create our custom node
		customNode := &RunnableCodeBlock{
			Mode: mode,
			Code: code.String(),
		}

		// Store the replacement to be done later
		parent := fencedBlock.Parent()
		if parent != nil {
			replacements = append(replacements, replacement{
				parent:  parent,
				oldNode: fencedBlock,
				newNode: customNode,
			})
		}

		return ast.WalkContinue, nil
	})

	// Second pass: apply all replacements
	for _, r := range replacements {
		r.parent.ReplaceChild(r.parent, r.oldNode, r.newNode)
	}
}

// RunnableCodeBlockRenderer renders RunnableCodeBlock nodes
type RunnableCodeBlockRenderer struct{}

// RegisterFuncs implements renderer.NodeRenderer
func (r *RunnableCodeBlockRenderer) RegisterFuncs(reg renderer.NodeRendererFuncRegisterer) {
	reg.Register(ast.KindCodeBlock, r.renderRunnableCodeBlock)
}

func (r *RunnableCodeBlockRenderer) renderRunnableCodeBlock(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		return ast.WalkContinue, nil
	}

	// Check if this is our custom node
	n, ok := node.(*RunnableCodeBlock)
	if !ok {
		// Not our custom block, render as regular code block
		if cb, ok := node.(*ast.FencedCodeBlock); ok {
			w.WriteString("<pre><code")
			if cb.Info != nil {
				lang := string(cb.Info.Text(source))
				if lang != "" {
					w.WriteString(` class="language-`)
					w.WriteString(html.EscapeString(lang))
					w.WriteString(`"`)
				}
			}
			w.WriteString(">")

			lines := cb.Lines()
			for i := 0; i < lines.Len(); i++ {
				line := lines.At(i)
				w.Write(util.EscapeHTML(line.Value(source)))
			}

			w.WriteString("</code></pre>\n")
		}
		return ast.WalkContinue, nil
	}

	// Render our custom runnable code block
	// Escape HTML entities and also escape newlines for data attribute
	escapedCode := html.EscapeString(n.Code)
	// Replace newlines with &#10; for proper data attribute encoding
	escapedCode = strings.ReplaceAll(escapedCode, "\n", "&#10;")
	// Also escape any literal backslashes to prevent issues
	escapedCode = strings.ReplaceAll(escapedCode, "\r", "&#13;")

	w.WriteString(fmt.Sprintf(`<div class="runnable-snippet" data-mode="%s">`, n.Mode))
	w.WriteString(`<div class="snippet-header">`)
	w.WriteString(`<span class="snippet-label">`)
	if n.Mode == "graphics" {
		w.WriteString(`🐢 Interactive Graphics`)
	} else {
		w.WriteString(`▶ Interactive Python`)
	}
	w.WriteString(`</span>`)
	w.WriteString(`<div class="snippet-controls">`)
	w.WriteString(`<button class="copy-btn" title="Copy code" aria-label="Copy code to clipboard">📋</button>`)
	w.WriteString(`<button class="run-btn" title="Run code" aria-label="Run Python code">▶ Run</button>`)
	w.WriteString(`<button class="make-trifle-btn" title="Save as trifle" aria-label="Save code as new trifle">💾 Make Trifle</button>`)
	w.WriteString(`</div>`)
	w.WriteString(`</div>`)
	w.WriteString(fmt.Sprintf(`<div class="snippet-code" data-code="%s"></div>`, escapedCode))
	w.WriteString(`<div class="snippet-output"></div>`)
	w.WriteString(`</div>`)
	w.WriteString("\n")

	return ast.WalkContinue, nil
}

// DocMetadata contains metadata from markdown frontmatter
type DocMetadata struct {
	Title       string
	Description string
	Category    string
	Order       int
}

// GenerateDoc converts a single markdown file to HTML
func GenerateDoc(inputPath, outputPath string) error {
	// Read markdown file
	content, err := os.ReadFile(inputPath)
	if err != nil {
		return fmt.Errorf("reading input file: %w", err)
	}

	// Set up goldmark with our custom extensions
	md := goldmark.New(
		goldmark.WithExtensions(
			meta.Meta,
		),
		goldmark.WithParserOptions(
			parser.WithASTTransformers(
				util.Prioritized(&ASTTransformer{}, 100),
			),
		),
		goldmark.WithRendererOptions(
			goldmarkhtml.WithUnsafe(), // Allow raw HTML in markdown
			renderer.WithNodeRenderers(
				util.Prioritized(&RunnableCodeBlockRenderer{}, 100),
			),
		),
	)

	// Parse markdown
	var buf bytes.Buffer
	ctx := parser.NewContext()
	if err := md.Convert(content, &buf, parser.WithContext(ctx)); err != nil {
		return fmt.Errorf("converting markdown: %w", err)
	}

	// Extract metadata
	metadata := meta.Get(ctx)
	title := "Documentation"
	description := ""

	if titleVal, ok := metadata["title"]; ok {
		if titleStr, ok := titleVal.(string); ok {
			title = titleStr
		}
	}

	if descVal, ok := metadata["description"]; ok {
		if descStr, ok := descVal.(string); ok {
			description = descStr
		}
	}

	// Generate full HTML page
	htmlContent := generateHTMLPage(title, description, buf.String())

	// Write output file
	if err := os.WriteFile(outputPath, []byte(htmlContent), 0644); err != nil {
		return fmt.Errorf("writing output file: %w", err)
	}

	return nil
}

// generateHTMLPage creates a complete HTML page with the converted content
func generateHTMLPage(title, description, bodyContent string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s - Trifling Documentation</title>
    <meta name="description" content="%s">
    <link rel="stylesheet" href="/css/app.css">
    <link rel="stylesheet" href="/css/docs.css">
</head>
<body>
    <header class="app-header">
        <nav class="nav-container">
            <a href="/" class="logo">Trifling</a>
            <div class="nav-links">
                <a href="/">Home</a>
                <a href="/learn.html" class="active">Learn</a>
                <a href="/about.html">About</a>
            </div>
            <div class="nav-auth" id="nav-auth"></div>
        </nav>
    </header>

    <div class="docs-container">
        <aside class="docs-sidebar">
            <h2>Documentation</h2>
            <nav class="docs-nav">
                <div class="docs-category">
                    <h3>Getting Started</h3>
                    <a href="/static/docs/intro.html">Introduction</a>
                </div>
                <div class="docs-category">
                    <h3>Graphics</h3>
                    <a href="/static/docs/turtle.html">Turtle Graphics</a>
                    <a href="/static/docs/canvas.html">Canvas API</a>
                </div>
                <div class="docs-category">
                    <h3>Advanced</h3>
                    <a href="/static/docs/imports.html">Trifle Imports</a>
                </div>
            </nav>
        </aside>

        <main class="docs-content">
            <article class="doc-article">
                %s
            </article>
        </main>
    </div>

    <script src="/js/terminal.js"></script>
    <script type="module" src="/js/snippet-runner.js"></script>
    <script>
        // Register service worker for offline support
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('Service Worker registered'))
                    .catch(err => console.error('Service Worker registration failed:', err));
            });
        }
    </script>
</body>
</html>`, html.EscapeString(title), html.EscapeString(description), bodyContent)
}

// GenerateAllDocs processes all markdown files in docs/ directory
func GenerateAllDocs(docsDir, outputDir string) error {
	// Ensure output directory exists
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("creating output directory: %w", err)
	}

	// Walk through docs directory
	return filepath.Walk(docsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Only process .md files
		if filepath.Ext(path) != ".md" {
			return nil
		}

		// Calculate output path
		relPath, err := filepath.Rel(docsDir, path)
		if err != nil {
			return fmt.Errorf("calculating relative path: %w", err)
		}

		outputPath := filepath.Join(outputDir, strings.TrimSuffix(relPath, ".md")+".html")

		// Ensure output subdirectory exists
		outputSubdir := filepath.Dir(outputPath)
		if err := os.MkdirAll(outputSubdir, 0755); err != nil {
			return fmt.Errorf("creating output subdirectory: %w", err)
		}

		fmt.Printf("Generating %s -> %s\n", path, outputPath)
		return GenerateDoc(path, outputPath)
	})
}

// GenerateLandingPage creates the main /learn.html page
func GenerateLandingPage(outputPath string) error {
	content := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Learn Python - Trifling Documentation</title>
    <meta name="description" content="Interactive Python tutorials and documentation for Trifling">
    <link rel="stylesheet" href="/css/app.css">
    <link rel="stylesheet" href="/css/docs.css">
</head>
<body>
    <header class="app-header">
        <nav class="nav-container">
            <a href="/" class="logo">Trifling</a>
            <div class="nav-links">
                <a href="/">Home</a>
                <a href="/learn.html" class="active">Learn</a>
                <a href="/about.html">About</a>
            </div>
            <div class="nav-auth" id="nav-auth"></div>
        </nav>
    </header>

    <div class="docs-landing">
        <div class="docs-hero">
            <h1>Learn Python with Trifling</h1>
            <p>Interactive tutorials with runnable code examples. No setup required.</p>
        </div>

        <div class="docs-grid">
            <a href="/static/docs/intro.html" class="doc-card">
                <h2>🚀 Getting Started</h2>
                <p>Learn the basics of Python programming right in your browser.</p>
            </a>

            <a href="/static/docs/turtle.html" class="doc-card">
                <h2>🐢 Turtle Graphics</h2>
                <p>Create beautiful drawings and animations with turtle graphics.</p>
            </a>

            <a href="/static/docs/canvas.html" class="doc-card">
                <h2>🎨 Canvas API</h2>
                <p>Draw directly on the canvas with shapes, colors, and images.</p>
            </a>

            <a href="/static/docs/imports.html" class="doc-card">
                <h2>🔗 Trifle Imports</h2>
                <p>Share code between trifles with the import system.</p>
            </a>
        </div>
    </div>

    <script type="module">
        import { initAuth } from '/js/app.js';
        initAuth();
    </script>
</body>
</html>`

	return os.WriteFile(outputPath, []byte(content), 0644)
}
