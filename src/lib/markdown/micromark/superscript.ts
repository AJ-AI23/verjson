/**
 * Micromark extension for superscript syntax: ^text^
 * Compatible with react-markdown v10
 */

import type { Extension as MicromarkExtension, Tokenizer, State } from 'micromark-util-types';
import type { Extension as FromMarkdownExtension, Handle } from 'mdast-util-from-markdown';

// Token types
const superscriptMarkerType = 'superscriptMarker' as const;
const superscriptType = 'superscript' as const;
const superscriptTextType = 'superscriptText' as const;

/**
 * Micromark syntax extension for ^superscript^
 */
export function superscriptSyntax(): MicromarkExtension {
  const tokenize: Tokenizer = function (effects, ok, nok) {
    let hasContent = false;
    
    const start: State = function (code) {
      if (code !== 94) return nok(code); // 94 is '^'
      (effects.enter as any)(superscriptType);
      (effects.enter as any)(superscriptMarkerType);
      effects.consume(code);
      (effects.exit as any)(superscriptMarkerType);
      (effects.enter as any)(superscriptTextType);
      return consumeText;
    };
    
    const consumeText: State = function (code) {
      // End of line or end of file without closing
      if (code === null || code === -3 || code === -4 || code === -5) {
        return nok(code);
      }
      
      // Closing marker
      if (code === 94) { // '^'
        if (!hasContent) {
          return nok(code);
        }
        (effects.exit as any)(superscriptTextType);
        (effects.enter as any)(superscriptMarkerType);
        effects.consume(code);
        (effects.exit as any)(superscriptMarkerType);
        (effects.exit as any)(superscriptType);
        return ok;
      }
      
      hasContent = true;
      effects.consume(code);
      return consumeText;
    };
    
    return start;
  };
  
  return {
    text: {
      94: { // '^' character code
        tokenize,
      },
    },
  };
}

/**
 * mdast-util extension to convert superscript tokens to mdast nodes
 */
export function superscriptFromMarkdown(): FromMarkdownExtension {
  const enterSuperscript: Handle = function (token) {
    this.enter({ type: 'superscript' as any, children: [], data: { hName: 'sup' } }, token);
  };
  
  const enterSuperscriptText: Handle = function (token) {
    this.enter({ type: 'text', value: '' }, token);
  };
  
  const exitSuperscript: Handle = function (token) {
    this.exit(token);
  };
  
  const exitSuperscriptText: Handle = function (token) {
    const node = this.stack[this.stack.length - 1];
    if (node && node.type === 'text') {
      (node as any).value = this.sliceSerialize(token);
    }
    this.exit(token);
  };
  
  return {
    enter: {
      [superscriptType]: enterSuperscript,
      [superscriptTextType]: enterSuperscriptText,
    },
    exit: {
      [superscriptType]: exitSuperscript,
      [superscriptTextType]: exitSuperscriptText,
    },
  } as FromMarkdownExtension;
}
