/**
 * Simple Query Language Parser for filtering translation entries
 * Supports: AND, OR, NOT operators, wildcards (*), quoted strings, and parentheses
 * 
 * Example queries:
 * - *.description AND *.example
 * - "paths.*" OR "components.*"
 * - description AND NOT (deprecated OR internal)
 * - *.tag* AND NOT *.example
 */

export interface FilterToken {
  type: 'AND' | 'OR' | 'NOT' | 'TERM' | 'LPAREN' | 'RPAREN';
  value: string;
  position: number;
}

export interface FilterNode {
  type: 'AND' | 'OR' | 'NOT' | 'TERM';
  value?: string;
  children?: FilterNode[];
}

/**
 * Tokenize a query string into tokens
 */
export function tokenizeQuery(query: string): FilterToken[] {
  const tokens: FilterToken[] = [];
  let i = 0;

  while (i < query.length) {
    const char = query[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Handle parentheses
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: i });
      i++;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: i });
      i++;
      continue;
    }

    // Handle quoted strings
    if (char === '"') {
      let value = '';
      i++; // Skip opening quote
      const startPos = i;
      
      while (i < query.length && query[i] !== '"') {
        value += query[i];
        i++;
      }
      
      if (i >= query.length) {
        throw new Error(`Unclosed quote starting at position ${startPos - 1}`);
      }
      
      i++; // Skip closing quote
      tokens.push({ type: 'TERM', value, position: startPos - 1 });
      continue;
    }

    // Handle terms and operators
    let value = '';
    const startPos = i;
    
    while (i < query.length && !/[\s()]/.test(query[i])) {
      value += query[i];
      i++;
    }

    const upperValue = value.toUpperCase();
    
    if (upperValue === 'AND') {
      tokens.push({ type: 'AND', value, position: startPos });
    } else if (upperValue === 'OR') {
      tokens.push({ type: 'OR', value, position: startPos });
    } else if (upperValue === 'NOT') {
      tokens.push({ type: 'NOT', value, position: startPos });
    } else if (value.startsWith('-') && value.length > 1) {
      // Handle -term as NOT term
      tokens.push({ type: 'NOT', value: '-', position: startPos });
      tokens.push({ type: 'TERM', value: value.slice(1), position: startPos + 1 });
    } else if (value) {
      tokens.push({ type: 'TERM', value, position: startPos });
    }
  }

  return tokens;
}

/**
 * Parse tokens into an Abstract Syntax Tree
 */
export function parseQuery(tokens: FilterToken[]): FilterNode {
  let position = 0;

  function peek(): FilterToken | undefined {
    return tokens[position];
  }

  function consume(): FilterToken {
    return tokens[position++];
  }

  function parseExpression(): FilterNode {
    return parseOr();
  }

  function parseOr(): FilterNode {
    let left = parseAnd();

    while (peek()?.type === 'OR') {
      consume(); // consume OR
      const right = parseAnd();
      left = {
        type: 'OR',
        children: [left, right]
      };
    }

    return left;
  }

  function parseAnd(): FilterNode {
    let left = parseNot();

    while (peek()?.type === 'AND') {
      consume(); // consume AND
      const right = parseNot();
      left = {
        type: 'AND',
        children: [left, right]
      };
    }

    return left;
  }

  function parseNot(): FilterNode {
    if (peek()?.type === 'NOT') {
      consume(); // consume NOT
      const child = parsePrimary();
      return {
        type: 'NOT',
        children: [child]
      };
    }

    return parsePrimary();
  }

  function parsePrimary(): FilterNode {
    const token = peek();

    if (!token) {
      throw new Error('Unexpected end of query');
    }

    if (token.type === 'LPAREN') {
      consume(); // consume (
      const expr = parseExpression();
      
      if (peek()?.type !== 'RPAREN') {
        throw new Error(`Expected closing parenthesis, got ${peek()?.type || 'end of query'}`);
      }
      
      consume(); // consume )
      return expr;
    }

    if (token.type === 'TERM') {
      consume();
      return {
        type: 'TERM',
        value: token.value
      };
    }

    throw new Error(`Unexpected token: ${token.type} at position ${token.position}`);
  }

  if (tokens.length === 0) {
    return { type: 'TERM', value: '' };
  }

  const ast = parseExpression();

  if (position < tokens.length) {
    throw new Error(`Unexpected token after expression: ${tokens[position].type} at position ${tokens[position].position}`);
  }

  return ast;
}

/**
 * Convert wildcard pattern to regex
 */
function wildcardToRegex(pattern: string, caseSensitive: boolean = false): RegExp {
  // Escape special regex characters except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  
  // Convert * to .*
  const regexPattern = escaped.replace(/\*/g, '.*');
  
  const flags = caseSensitive ? '' : 'i';
  return new RegExp(`^${regexPattern}$`, flags);
}

/**
 * Evaluate a filter node against a path/value
 */
export function evaluateFilter(node: FilterNode, path: string): boolean {
  switch (node.type) {
    case 'AND':
      return node.children!.every(child => evaluateFilter(child, path));
    
    case 'OR':
      return node.children!.some(child => evaluateFilter(child, path));
    
    case 'NOT':
      return !evaluateFilter(node.children![0], path);
    
    case 'TERM': {
      const pattern = node.value || '';
      
      if (!pattern) {
        return true; // Empty pattern matches everything
      }

      // Check if pattern contains wildcards
      if (pattern.includes('*')) {
        const regex = wildcardToRegex(pattern, false);
        return regex.test(path);
      }

      // Simple substring match (case-insensitive)
      return path.toLowerCase().includes(pattern.toLowerCase());
    }
    
    default:
      return false;
  }
}

/**
 * Main entry point: match a query against a path/value
 */
export function matchesFilter(query: string, path: string): boolean {
  if (!query.trim()) {
    return true; // Empty query matches everything
  }

  try {
    const tokens = tokenizeQuery(query);
    const ast = parseQuery(tokens);
    return evaluateFilter(ast, path);
  } catch (error) {
    // If parsing fails, fall back to simple substring matching
    console.warn('Filter parsing error:', error);
    return path.toLowerCase().includes(query.toLowerCase());
  }
}

/**
 * Validate a query and return error message if invalid
 */
export function validateQuery(query: string): string | null {
  if (!query.trim()) {
    return null; // Empty query is valid
  }

  try {
    const tokens = tokenizeQuery(query);
    parseQuery(tokens);
    return null; // Valid query
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Invalid query syntax';
  }
}
