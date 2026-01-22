import type { MarkdownDocument } from '@/types/markdown';
import { linesToMarkdown } from '@/lib/markdownUtils';

export type DetectedExtendedFeature =
  | 'Tables'
  | 'Task lists'
  | 'Strikethrough'
  | 'Autolinks'
  | 'Footnotes'
  | 'Heading IDs'
  | 'Definition lists'
  | 'Emoji shortcodes'
  | 'Highlight'
  | 'Subscript'
  | 'Superscript'
  | 'Fenced code blocks';

export function detectExtendedMarkdownFeatures(doc: MarkdownDocument): {
  hasAny: boolean;
  features: DetectedExtendedFeature[];
} {
  const md = (doc?.data?.pages || [])
    .map((p) => linesToMarkdown(p.lines || {}))
    .join('\n\n');

  const features: DetectedExtendedFeature[] = [];
  const push = (f: DetectedExtendedFeature, condition: boolean) => {
    if (condition && !features.includes(f)) features.push(f);
  };

  // GFM set
  push('Tables', /^\|.+\|\s*$/m.test(md) && /^\|?\s*:?-+:?\s*\|/m.test(md));
  push('Task lists', /^\s*[-*]\s+\[[ xX]\]\s+/m.test(md));
  push('Strikethrough', /~~[^~]+~~/.test(md));
  push('Autolinks', /(https?:\/\/\S+)|(\bwww\.[^\s]+\b)/.test(md));

  // Footnotes
  push('Footnotes', /\[\^[^\]]+\]/.test(md) || /\[\^[^\]]+\]:/.test(md));

  // Heading IDs (remark-custom-header-id uses {#id})
  push('Heading IDs', /\{#[A-Za-z][\w-]*\}\s*$/m.test(md));

  // Definition lists (very conservative heuristic)
  push('Definition lists', /^.+\n:\s+.+/m.test(md));

  // Emoji shortcodes
  push('Emoji shortcodes', /:[a-z0-9_+-]+:/i.test(md));

  // Highlight
  push('Highlight', /==[^=][\s\S]*?==/.test(md));

  // Sub/Sup (note: avoid counting strikethrough "~~" as subscript)
  push('Subscript', /(^|[^~])~[^~]+~([^~]|$)/.test(md));
  push('Superscript', /\^[^^]+\^/.test(md));

  // Fenced code blocks
  push('Fenced code blocks', /^```[\w-]*\n[\s\S]*?\n```/m.test(md));

  return { hasAny: features.length > 0, features };
}
