# Documentation System

## Overview

Trifling now has an interactive documentation system that allows users to learn Python with runnable code snippets directly in the browser.

## Architecture

### Build System

1. **Markdown Source**: Documentation is written in Markdown files in `/docs/`
2. **Goldmark Processing**: `go generate ./internal/docgen` converts Markdown → HTML
3. **Static Output**: Generated HTML files are written to `/static/docs/`
4. **Go Embed**: Static docs are embedded in the binary via `//go:embed static`

### Special Code Blocks

Two special code fence types for executable snippets:

- ` ```python-editor-text ` - Text output mode
- ` ```python-editor-graphics ` - Graphics output mode (turtle/canvas)

These are transformed into interactive editors with:
- Inline Ace editor instances
- Run button
- Copy code button
- "Make Trifle" button (saves as new trifle)

### File Structure

```
/docs/                      # Markdown source files
  intro.md                  # Getting started
  turtle.md                 # Turtle graphics tutorial
  canvas.md                 # Canvas API reference
  imports.md                # Trifle import system
/internal/docgen/           # Documentation generator
  generator.go              # Goldmark renderer & AST transformer
  generate.go               # CLI tool (called by go generate)
/static/docs/               # Generated HTML (committed to repo)
  intro.html
  turtle.html
  canvas.html
  imports.html
/web/
  learn.html                # Documentation landing page
  /css/
    docs.css                # Documentation styling
  /js/
    snippet-runner.js       # Runnable code snippet logic
```

## Workflow

### Adding/Editing Documentation

1. Edit or create Markdown files in `/docs/`
2. Use special code fences for runnable examples:
   ```
   ```python-editor-text
   print("Hello, World!")
   ```
   ```

3. Run `go generate ./internal/docgen` to rebuild HTML
4. Commit both `.md` and `.html` files
5. Service worker will cache docs for offline use

### Navigation Integration

- **Homepage**: "Learn" link in header navigation
- **About page**: "Learn Python" button
- **Editor**: "? Help" dropdown with context-sensitive links
- **Landing page**: `/learn.html` with overview cards

### Service Worker

Updated to v125 with docs caching:
- `/learn.html`
- `/css/docs.css`
- `/js/snippet-runner.js`
- `/static/docs/*.html`

## Implementation Details

### Custom Goldmark Components

**ASTTransformer**: Walks the AST and replaces `FencedCodeBlock` nodes with custom `RunnableCodeBlock` nodes when the language is `python-editor-text` or `python-editor-graphics`.

**RunnableCodeBlockRenderer**: Renders `RunnableCodeBlock` nodes as interactive HTML:
```html
<div class="runnable-snippet" data-mode="text|graphics">
  <div class="snippet-header">...</div>
  <div class="snippet-code" data-code="..."></div>
  <div class="snippet-output"></div>
</div>
```

### Snippet Runner (Client-Side)

Each runnable snippet:
1. Creates a mini Ace editor instance
2. Shares a single Pyodide worker across all snippets
3. Executes code in isolated Python namespace
4. Shows inline terminal/canvas output
5. Can create a new trifle from the snippet code

### Server Integration

`main.go` serves static docs via embedded FS:
```go
//go:embed static
var staticFS embed.FS

// ...

staticContent, _ := fs.Sub(staticFS, "static")
mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.FS(staticContent))))
```

## Dependencies

- `github.com/yuin/goldmark` - Markdown processor
- `github.com/yuin/goldmark-meta` - Frontmatter support

## Future Enhancements

- [ ] Search functionality across docs
- [ ] Code snippet sharing/permalinks
- [ ] More tutorials (data structures, algorithms, etc.)
- [ ] Inline syntax highlighting themes
- [ ] Snippet execution history/persistence
- [ ] Progressive enhancement for no-JS users
