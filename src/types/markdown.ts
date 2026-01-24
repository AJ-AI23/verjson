import { MarkdownStyles } from './markdownStyles';

// Page size in millimeters (for PDF generation)
export interface PageSize {
  width: number;  // in mm
  height: number; // in mm
}

// Common page size presets
export const PAGE_SIZES: Record<string, PageSize> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  Tabloid: { width: 279, height: 432 },
};

export type PageOrientation = 'portrait' | 'landscape';

export interface MarkdownDocument {
  verjson: string; // Format version - always "1.0.0" for this schema version
  type: 'markdown' | 'extended-markdown';
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

export const isExtendedMarkdown = (doc: MarkdownDocument): boolean => doc.type === 'extended-markdown';

export const isMarkdownLike = (doc: any): doc is MarkdownDocument =>
  !!doc && typeof doc === 'object' && doc.verjson !== undefined && (doc.type === 'markdown' || doc.type === 'extended-markdown');

export interface MarkdownData {
  pages: MarkdownPage[];
  embeds?: MarkdownEmbed[];
}

export interface MarkdownPage {
  id: string;
  title?: string;
  lines: Record<string, string>; // Hierarchical line indexing: "1", "1.1", "1.2.1", etc.
  pageSize?: PageSize;           // Maximum page size for this page
  orientation?: PageOrientation; // Page orientation (default: portrait)
}

export interface MarkdownEmbed {
  id: string;
  type: 'image' | 'diagram';
  ref: string; // "storage://path" for images, "document://id" for diagrams, or "embed://id" for inline base64
  alt?: string;
  caption?: string;
  data?: string; // Base64 encoded data for inline embeds
  mimeType?: string; // MIME type for base64 data (e.g., "image/png")
}

export type MarkdownEmbedType = 'image' | 'diagram';

// Utility to convert mm to pixels at a given DPI
export function mmToPixels(mm: number, dpi: number = 96): number {
  // 1 inch = 25.4 mm
  return Math.round((mm / 25.4) * dpi);
}

// Utility to get effective page dimensions (with orientation applied)
export function getEffectivePageDimensions(
  pageSize: PageSize,
  orientation: PageOrientation = 'portrait'
): PageSize {
  if (orientation === 'landscape') {
    return { width: pageSize.height, height: pageSize.width };
  }
  return pageSize;
}
