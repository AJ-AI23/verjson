import remarkGfm from 'remark-gfm';
import remarkGemoji from 'remark-gemoji';
import remarkDefinitionList from 'remark-definition-list';
import remarkCustomHeaderId from 'remark-custom-header-id';
import remarkMarkPlus from 'remark-mark-plus';
import remarkSupersub from 'remark-supersub';
import rehypeHighlight from 'rehype-highlight';

export type MarkdownDocType = 'markdown' | 'extended-markdown';

export function getMarkdownPlugins(docType: MarkdownDocType): {
  remarkPlugins: any[];
  rehypePlugins: any[];
} {
  if (docType !== 'extended-markdown') {
    return { remarkPlugins: [], rehypePlugins: [] };
  }

  // NOTE: remark-gfm parses single-tildes as strikethrough by default. We disable that
  // so remark-supersub can safely use `~sub~`.
  const remarkPlugins = [
    [remarkGfm, { singleTilde: false }],
    remarkDefinitionList,
    remarkCustomHeaderId,
    remarkGemoji,
    remarkMarkPlus,
    remarkSupersub,
  ];

  const rehypePlugins = [rehypeHighlight];

  return { remarkPlugins, rehypePlugins };
}
