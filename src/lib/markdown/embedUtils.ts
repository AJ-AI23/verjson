import { MarkdownPage } from '@/types/markdown';

/**
 * Extract all embed:// IDs referenced in the markdown pages.
 * Scans all lines for ![...]( embed://... ) patterns.
 */
export function extractEmbedIdsFromPages(pages: MarkdownPage[]): Set<string> {
  const ids = new Set<string>();
  // Match embed:// references in markdown image syntax: ![alt](embed://id)
  const embedPattern = /!\[[^\]]*\]\(embed:\/\/([^)\s]+)\)/g;

  for (const page of pages) {
    for (const lineContent of Object.values(page.lines)) {
      let match: RegExpExecArray | null;
      while ((match = embedPattern.exec(lineContent)) !== null) {
        ids.add(match[1]);
      }
    }
  }

  return ids;
}
