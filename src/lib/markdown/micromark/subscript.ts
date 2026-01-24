/**
 * Micromark extension for subscript syntax: ~text~
 * Compatible with react-markdown v10
 */

import type { Extension as MicromarkExtension, Tokenizer, State } from 'micromark-util-types';
import type { Extension as FromMarkdownExtension, Handle } from 'mdast-util-from-markdown';

// Token types
const subscriptMarkerType = 'subscriptMarker' as const;
const subscriptType = 'subscript' as const;
const subscriptTextType = 'subscriptText' as const;

/**
 * Micromark syntax extension for ~subscript~
 */
export function subscriptSyntax(): MicromarkExtension {
  const tokenize: Tokenizer = function (effects, ok, nok) {
    let hasContent = false;
    
    const start: State = function (code) {
      if (code !== 126) return nok(code); // 126 is '~'
      (effects.enter as any)(subscriptType);
      (effects.enter as any)(subscriptMarkerType);
      effects.consume(code);
      return afterOpeningMarker;
    };
    
    const afterOpeningMarker: State = function (code) {
      // Don't match ~~ (strikethrough)
      if (code === 126) {
        return nok(code);
      }
      
      (effects.exit as any)(subscriptMarkerType);
      (effects.enter as any)(subscriptTextType);
      return consumeText(code);
    };
    
    const consumeText: State = function (code) {
      // End of line or end of file without closing
      if (code === null || code === -3 || code === -4 || code === -5) {
        return nok(code);
      }
      
      // Closing marker
      if (code === 126) { // '~'
        if (!hasContent) {
          return nok(code);
        }
        (effects.exit as any)(subscriptTextType);
        (effects.enter as any)(subscriptMarkerType);
        effects.consume(code);
        return afterClosingMarker;
      }
      
      hasContent = true;
      effects.consume(code);
      return consumeText;
    };
    
    const afterClosingMarker: State = function (code) {
      // If another ~ follows, this is strikethrough, not subscript
      if (code === 126) {
        return nok(code);
      }
      
      (effects.exit as any)(subscriptMarkerType);
      (effects.exit as any)(subscriptType);
      return ok(code);
    };
    
    return start;
  };
  
  return {
    text: {
      126: { // '~' character code
        tokenize,
      },
    },
  };
}

/**
 * mdast-util extension to convert subscript tokens to mdast nodes
 */
export function subscriptFromMarkdown(): FromMarkdownExtension {
  const enterSubscript: Handle = function (token) {
    this.enter({ type: 'subscript' as any, children: [], data: { hName: 'sub' } }, token);
  };
  
  const enterSubscriptText: Handle = function (token) {
    this.enter({ type: 'text', value: '' }, token);
  };
  
  const exitSubscript: Handle = function (token) {
    this.exit(token);
  };
  
  const exitSubscriptText: Handle = function (token) {
    const node = this.stack[this.stack.length - 1];
    if (node && node.type === 'text') {
      (node as any).value = this.sliceSerialize(token);
    }
    this.exit(token);
  };
  
  return {
    enter: {
      [subscriptType]: enterSubscript,
      [subscriptTextType]: enterSubscriptText,
    },
    exit: {
      [subscriptType]: exitSubscript,
      [subscriptTextType]: exitSubscriptText,
    },
  } as FromMarkdownExtension;
}
