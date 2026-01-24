import remarkGfm from 'remark-gfm';
import remarkGemoji from 'remark-gemoji';
import rehypeHighlight from 'rehype-highlight';
import { remarkExtendedSyntax } from './remarkExtendedSyntax';

export type MarkdownDocType = 'markdown' | 'extended-markdown';

export function getMarkdownPlugins(docType: MarkdownDocType): {
  remarkPlugins: any[];
  rehypePlugins: any[];
} {
  if (docType !== 'extended-markdown') {
    return { remarkPlugins: [], rehypePlugins: [] };
  }

  // Extended markdown plugins compatible with react-markdown v10 (micromark-based)
  // - remarkGfm: tables, strikethrough (~~), task lists, autolinks
  // - remarkGemoji: emoji shortcodes (:smile:)
  // - remarkExtendedSyntax: highlight (==), subscript (~), superscript (^)
  const remarkPlugins = [
    [remarkGfm, { singleTilde: false }], // Disable single-tilde strikethrough to not conflict with subscript
    remarkGemoji,
    remarkExtendedSyntax,
  ];

  const rehypePlugins = [rehypeHighlight];

  return { remarkPlugins, rehypePlugins };
}
