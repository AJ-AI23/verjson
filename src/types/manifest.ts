/**
 * Manifest Document Type
 * 
 * A VerjSON document type that serves as an indexed repository/navigation structure
 * for documentation. The manifest acts as a table of contents and navigation system
 * (similar to WinHelp or manpages) that references or embeds other markdown documents.
 */

export interface ManifestDocument {
  verjson: string;           // "1.0.0"
  type: 'manifest';
  info: ManifestInfo;
  data: ManifestData;
  styles?: ManifestStyles;
  selectedTheme?: string;
}

export interface ManifestInfo {
  version: string;           // Semantic version
  title: string;
  description?: string;
  author?: string;
  created?: string;
  modified?: string;
}

export interface ManifestData {
  toc: TOCEntry[];           // Hierarchical table of contents
  index?: IndexEntry[];      // Keyword index
  embeds?: ManifestEmbed[];  // Embedded content
  defaultPage?: string;      // ID of default landing page
}

export interface TOCEntry {
  id: string;                // Unique identifier
  title: string;             // Display title
  icon?: string;             // Optional icon name (lucide icon name)
  ref?: string;              // Reference: "document://uuid" or "embed://id"
  anchor?: string;           // Optional anchor within referenced document
  children?: TOCEntry[];     // Nested entries (folders/sections)
  keywords?: string[];       // Searchable keywords for this entry
  description?: string;      // Short description for search results
}

export interface IndexEntry {
  keyword: string;           // Index keyword
  entries: IndexReference[]; // References to TOC entries or specific anchors
}

export interface IndexReference {
  tocId: string;             // Reference to TOC entry ID
  anchor?: string;           // Optional anchor within the document
  context?: string;          // Context snippet for search preview
}

export interface ManifestEmbed {
  id: string;                // Unique embed identifier
  type: 'markdown';          // Currently only markdown supported
  content?: any;             // Inline MarkdownDocument for embedded content
  documentId?: string;       // Reference to external document for linked content
}

export interface ManifestStyles {
  themes?: Record<string, ManifestTheme>;
}

export interface ManifestTheme {
  navigation: {
    background: string;
    text: string;
    activeBackground: string;
    hoverBackground: string;
  };
  content: {
    background: string;
    text: string;
    linkColor: string;
  };
}

// Default theme for manifest documents
export const defaultManifestTheme: ManifestTheme = {
  navigation: {
    background: 'hsl(var(--sidebar-background))',
    text: 'hsl(var(--sidebar-foreground))',
    activeBackground: 'hsl(var(--sidebar-accent))',
    hoverBackground: 'hsl(var(--sidebar-accent))',
  },
  content: {
    background: 'hsl(var(--background))',
    text: 'hsl(var(--foreground))',
    linkColor: 'hsl(var(--primary))',
  },
};
