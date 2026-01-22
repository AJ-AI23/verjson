import { MarkdownDocument } from '@/types/markdown';
import { defaultMarkdownStyles } from '@/types/markdownStyles';

/**
 * Default VerjSON Markdown Schema
 * 
 * A starter template for markdown documents using the hierarchical line indexing format.
 */
export const defaultMarkdownSchema: MarkdownDocument = {
  verjson: '1.0.0',
  type: 'markdown',
  info: {
    version: '1.0.0',
    title: 'Untitled Document',
    description: '',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  },
  selectedTheme: 'light',
  styles: defaultMarkdownStyles,
  data: {
    pages: [
      {
        id: 'page-1',
        title: 'Introduction',
        lines: {
          "1": "# Welcome to Your Document",
          "2": "",
          "3": "Start writing your content here. This editor supports **Markdown** formatting.",
          "4": "",
          "5": "## Features",
          "6": "",
          "7": "- Easy-to-use WYSIWYG editor",
          "8": "- Split view with live preview",
          "9": "- Version-friendly hierarchical storage",
          "10": "",
          "11": "## Getting Started",
          "12": "",
          "13": "Use the toolbar above to format your text, or write Markdown directly.",
        }
      }
    ],
    embeds: []
  }
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
    styles: defaultMarkdownStyles,
    selectedTheme: "light"
  };
}
