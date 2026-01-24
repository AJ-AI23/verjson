/**
 * Micromark extension for highlight syntax: ==text==
 * Compatible with react-markdown v10
 */

import type { Extension as MicromarkExtension, Tokenizer, State } from 'micromark-util-types';
import type { Extension as FromMarkdownExtension, Handle } from 'mdast-util-from-markdown';

// Token types (as string to avoid strict type checking)
const highlightMarkerType = 'highlightMarker' as const;
const highlightType = 'highlight' as const;
const highlightTextType = 'highlightText' as const;

/**
 * Micromark syntax extension for ==highlight==
 */
export function highlightSyntax(): MicromarkExtension {
  const tokenize: Tokenizer = function (effects, ok, nok) {
    let markerCount = 0;
    let closingMarkerCount = 0;
    
    const start: State = function (code) {
      if (code !== 61) return nok(code); // 61 is '='
      (effects.enter as any)(highlightType);
      (effects.enter as any)(highlightMarkerType);
      return consumeMarker(code);
    };
    
    const consumeMarker: State = function (code) {
      if (code === 61) { // '='
        effects.consume(code);
        markerCount++;
        if (markerCount === 2) {
          (effects.exit as any)(highlightMarkerType);
          (effects.enter as any)(highlightTextType);
          return consumeText;
        }
        return consumeMarker;
      }
      return nok(code);
    };
    
    const consumeText: State = function (code) {
      // End of line or end of file without closing
      if (code === null || code === -3 || code === -4 || code === -5) {
        return nok(code);
      }
      
      // Potential closing marker
      if (code === 61) { // '='
        (effects.exit as any)(highlightTextType);
        (effects.enter as any)(highlightMarkerType);
        closingMarkerCount = 0;
        return consumeClosingMarker(code);
      }
      
      effects.consume(code);
      return consumeText;
    };
    
    const consumeClosingMarker: State = function (code) {
      if (code === 61) { // '='
        effects.consume(code);
        closingMarkerCount++;
        if (closingMarkerCount === 2) {
          (effects.exit as any)(highlightMarkerType);
          (effects.exit as any)(highlightType);
          return ok(code);
        }
        return consumeClosingMarker;
      }
      
      // Not a valid closing marker, continue as text
      (effects.exit as any)(highlightMarkerType);
      (effects.enter as any)(highlightTextType);
      return consumeText(code);
    };
    
    return start;
  };
  
  return {
    text: {
      61: { // '=' character code
        tokenize,
      },
    },
  };
}

/**
 * mdast-util extension to convert highlight tokens to mdast nodes
 */
export function highlightFromMarkdown(): FromMarkdownExtension {
  const enterHighlight: Handle = function (token) {
    this.enter({ type: 'mark' as any, children: [], data: { hName: 'mark' } }, token);
  };
  
  const enterHighlightText: Handle = function (token) {
    this.enter({ type: 'text', value: '' }, token);
  };
  
  const exitHighlight: Handle = function (token) {
    this.exit(token);
  };
  
  const exitHighlightText: Handle = function (token) {
    const node = this.stack[this.stack.length - 1];
    if (node && node.type === 'text') {
      (node as any).value = this.sliceSerialize(token);
    }
    this.exit(token);
  };
  
  return {
    enter: {
      [highlightType]: enterHighlight,
      [highlightTextType]: enterHighlightText,
    },
    exit: {
      [highlightType]: exitHighlight,
      [highlightTextType]: exitHighlightText,
    },
  } as FromMarkdownExtension;
}
