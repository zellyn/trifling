// +build ignore

package main

import (
	"fmt"
	"os"

	"github.com/zellyn/trifle/internal/docgen"
)

func main() {
	// Paths are relative to project root
	docsDir := "../../docs"
	outputDir := "../../static/docs"
	learnPage := "../../web/learn.html"

	fmt.Println("Generating documentation...")

	// Generate all documentation pages
	if err := docgen.GenerateAllDocs(docsDir, outputDir); err != nil {
		fmt.Fprintf(os.Stderr, "Error generating docs: %v\n", err)
		os.Exit(1)
	}

	// Generate landing page
	if err := docgen.GenerateLandingPage(learnPage); err != nil {
		fmt.Fprintf(os.Stderr, "Error generating landing page: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Documentation generation complete!")
}
