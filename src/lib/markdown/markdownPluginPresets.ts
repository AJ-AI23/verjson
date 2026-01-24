import remarkGfm from 'remark-gfm';
import remarkGemoji from 'remark-gemoji';
import rehypeHighlight from 'rehype-highlight';

export type MarkdownDocType = 'markdown' | 'extended-markdown';

export function getMarkdownPlugins(docType: MarkdownDocType): {
  remarkPlugins: any[];
  rehypePlugins: any[];
} {
  if (docType !== 'extended-markdown') {
    return { remarkPlugins: [], rehypePlugins: [] };
  }

  // NOTE: We only include plugins that are compatible with react-markdown v10 (micromark-based).
  // remark-mark-plus and remark-supersub use the legacy Parser API and crash the app.
  // Extended syntax for highlight (==), subscript (~), and superscript (^) would require
  // micromark extensions which are not yet implemented.
  const remarkPlugins = [
    [remarkGfm, { singleTilde: false }],
    remarkGemoji,
  ];

  const rehypePlugins = [rehypeHighlight];

  return { remarkPlugins, rehypePlugins };
}
