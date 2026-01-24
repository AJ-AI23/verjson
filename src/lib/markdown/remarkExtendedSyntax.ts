/**
 * Remark plugin that combines all custom extended markdown syntax extensions
 * Compatible with react-markdown v10
 */

import { 
  highlightSyntax, 
  highlightFromMarkdown,
  subscriptSyntax,
  subscriptFromMarkdown,
  superscriptSyntax,
  superscriptFromMarkdown,
} from './micromark';

/**
 * Remark plugin for extended markdown syntax (highlight, subscript, superscript)
 * Usage: remarkPlugins={[remarkExtendedSyntax]}
 */
export function remarkExtendedSyntax() {
  // Get the processor data
  // @ts-ignore - accessing internal unified processor data
  const data = this.data();
  
  // Add micromark extensions
  const micromarkExtensions = data.micromarkExtensions || (data.micromarkExtensions = []);
  micromarkExtensions.push(
    highlightSyntax(),
    subscriptSyntax(),
    superscriptSyntax()
  );
  
  // Add mdast-util-from-markdown extensions
  const fromMarkdownExtensions = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = []);
  fromMarkdownExtensions.push(
    highlightFromMarkdown(),
    subscriptFromMarkdown(),
    superscriptFromMarkdown()
  );
}
