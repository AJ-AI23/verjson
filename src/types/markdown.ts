import { MarkdownStyles } from './markdownStyles';

export interface MarkdownDocument {
  verjson: string; // Format version - always "1.0.0" for this schema version
  type: 'markdown';
  info: {
    version: string; // Document version (semantic versioning)
    title: string;
    description?: string;
    author?: string;
    created?: string;
    modified?: string;
  };
  data: MarkdownData;
  styles: MarkdownStyles; // Required styling configuration (can be empty themes object)
  selectedTheme?: string;
}

export interface MarkdownData {
  pages: MarkdownPage[];
  embeds?: MarkdownEmbed[];
}

export interface MarkdownPage {
  id: string;
  title?: string;
  lines: Record<string, string>; // Hierarchical line indexing: "1", "1.1", "1.2.1", etc.
}

export interface MarkdownEmbed {
  id: string;
  type: 'image' | 'diagram';
  ref: string; // "storage://path" for images, "document://id" for diagrams
  alt?: string;
  caption?: string;
}

export type MarkdownEmbedType = 'image' | 'diagram';
