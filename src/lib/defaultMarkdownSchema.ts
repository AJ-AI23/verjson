import { MarkdownDocument } from '@/types/markdown';

export const defaultMarkdownSchema: MarkdownDocument = {
  verjson: "1.0.0",
  type: "markdown",
  info: {
    version: "1.0.0",
    title: "New Markdown Document",
    description: "A markdown document with hierarchical line indexing",
    created: new Date().toISOString(),
    modified: new Date().toISOString()
  },
  data: {
    pages: [
      {
        id: "page-1",
        title: "Page 1",
        lines: {
          "1": "# Welcome to VerjSON Markdown",
          "2": "",
          "3": "This document uses hierarchical line indexing for version-friendly editing.",
          "4": "",
          "5": "## How It Works",
          "6": "",
          "7": "Each line has a numeric key like `1`, `2`, `3`. When you insert content between lines, it gets a sub-index like `1.1` (inserted after line 1).",
          "8": "",
          "9": "### Benefits",
          "10": "",
          "11": "- **Clean diffs**: Inserting content doesn't renumber existing lines",
          "12": "- **Easy merging**: Parallel edits are less likely to conflict",
          "13": "- **Version tracking**: Changes are isolated to specific indices"
        }
      }
    ],
    embeds: []
  },
  selectedTheme: "light"
};

/**
 * Create a new markdown document with custom title
 */
export function createMarkdownDocument(title: string, description?: string): MarkdownDocument {
  const now = new Date().toISOString();
  return {
    verjson: "1.0.0",
    type: "markdown",
    info: {
      version: "1.0.0",
      title,
      description: description || "A markdown document",
      created: now,
      modified: now
    },
    data: {
      pages: [
        {
          id: "page-1",
          title: "Page 1",
          lines: {
            "1": `# ${title}`,
            "2": "",
            "3": "Start writing here..."
          }
        }
      ],
      embeds: []
    },
    selectedTheme: "light"
  };
}
