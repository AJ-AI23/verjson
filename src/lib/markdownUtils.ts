/**
 * Utilities for working with hierarchical line indexing in markdown documents.
 * 
 * Line keys use dot notation for hierarchy:
 * - "1", "2", "3" are top-level lines
 * - "1.1", "1.2" are insertions after line "1"
 * - "1.1.1" is an insertion after "1.1"
 * 
 * This structure allows non-destructive insertions that don't renumber existing lines.
 */

/**
 * Parse a line key into its numeric components
 * @example parseLineKey("1.2.1") => [1, 2, 1]
 */
export function parseLineKey(key: string): number[] {
  return key.split('.').map(Number);
}

/**
 * Compare two line keys for sorting
 * Sorts numerically by each component: "1" < "1.1" < "1.2" < "2"
 */
export function compareLineKeys(a: string, b: string): number {
  const partsA = parseLineKey(a);
  const partsB = parseLineKey(b);
  
  const maxLength = Math.max(partsA.length, partsB.length);
  
  for (let i = 0; i < maxLength; i++) {
    const numA = partsA[i] ?? -1; // Missing parts sort before existing
    const numB = partsB[i] ?? -1;
    
    if (numA !== numB) {
      return numA - numB;
    }
  }
  
  return 0;
}

/**
 * Get sorted line keys from a lines object
 */
export function getSortedLineKeys(lines: Record<string, string>): string[] {
  return Object.keys(lines).sort(compareLineKeys);
}

/**
 * Flatten hierarchical lines into an ordered array of strings
 */
export function flattenLines(lines: Record<string, string>): string[] {
  const sortedKeys = getSortedLineKeys(lines);
  return sortedKeys.map(key => lines[key]);
}

/**
 * Convert hierarchical lines to a markdown string
 * Appends two spaces to non-empty lines to force hard line breaks in markdown rendering,
 * except for lines that are blank or end with markdown block syntax.
 */
export function linesToMarkdown(lines: Record<string, string>): string {
  const flatLines = flattenLines(lines);
  return flatLines.map((line, index) => {
    // Don't modify empty lines, lines that are just whitespace, 
    // or lines that already end with trailing spaces
    if (!line.trim() || line.endsWith('  ')) {
      return line;
    }
    // Don't add trailing spaces to lines that end with block-level markdown
    // (headings, hr, code fence, list items start, etc. - they naturally break)
    if (/^#{1,6}\s/.test(line) || // headings
        /^[-*+]\s/.test(line) ||   // unordered list items
        /^\d+\.\s/.test(line) ||   // ordered list items
        /^>\s?/.test(line) ||      // blockquotes
        /^```/.test(line) ||       // code fence
        /^---$/.test(line) ||      // hr
        /^\*\*\*$/.test(line) ||   // hr
        /^___$/.test(line)) {      // hr
      return line;
    }
    // Add two trailing spaces to force hard break
    return line + '  ';
  }).join('\n');
}

/**
 * Convert a markdown string to hierarchical lines
 * Uses simple sequential numbering for fresh conversion
 */
export function markdownToLines(markdown: string): Record<string, string> {
  const textLines = markdown.split('\n');
  const lines: Record<string, string> = {};
  
  textLines.forEach((line, index) => {
    lines[String(index + 1)] = line;
  });
  
  return lines;
}

/**
 * Find the next available key for insertion after a given key
 * @example getNextInsertKey("1", { "1": "...", "1.1": "..." }) => "1.2"
 */
export function getNextInsertKey(afterKey: string, lines: Record<string, string>): string {
  const prefix = afterKey + '.';
  const existingSubKeys = Object.keys(lines)
    .filter(key => key.startsWith(prefix) && !key.slice(prefix.length).includes('.'))
    .map(key => parseInt(key.slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  
  const maxSubKey = existingSubKeys.length > 0 ? Math.max(...existingSubKeys) : 0;
  return `${afterKey}.${maxSubKey + 1}`;
}

/**
 * Insert a new line after the specified key
 */
export function insertAfterLine(
  lines: Record<string, string>,
  afterKey: string,
  content: string
): { lines: Record<string, string>; newKey: string } {
  const newKey = getNextInsertKey(afterKey, lines);
  return {
    lines: { ...lines, [newKey]: content },
    newKey
  };
}

/**
 * Delete a line and optionally its sub-lines
 */
export function deleteLine(
  lines: Record<string, string>,
  key: string,
  deleteChildren: boolean = false
): Record<string, string> {
  const result = { ...lines };
  delete result[key];
  
  if (deleteChildren) {
    const prefix = key + '.';
    Object.keys(result).forEach(k => {
      if (k.startsWith(prefix)) {
        delete result[k];
      }
    });
  }
  
  return result;
}

/**
 * Update a line's content
 */
export function updateLine(
  lines: Record<string, string>,
  key: string,
  content: string
): Record<string, string> {
  return { ...lines, [key]: content };
}

/**
 * Get all child keys for a given parent key
 * @example getChildKeys("1", { "1": "...", "1.1": "...", "1.2": "...", "2": "..." }) => ["1.1", "1.2"]
 */
export function getChildKeys(parentKey: string, lines: Record<string, string>): string[] {
  const prefix = parentKey + '.';
  return Object.keys(lines)
    .filter(key => key.startsWith(prefix))
    .sort(compareLineKeys);
}

/**
 * Check if a key has any children
 */
export function hasChildren(key: string, lines: Record<string, string>): boolean {
  const prefix = key + '.';
  return Object.keys(lines).some(k => k.startsWith(prefix));
}

/**
 * Get the parent key of a given key
 * @example getParentKey("1.2.1") => "1.2"
 * @example getParentKey("1") => null
 */
export function getParentKey(key: string): string | null {
  const parts = key.split('.');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join('.');
}

/**
 * Get the depth level of a key (0-indexed)
 * @example getKeyDepth("1") => 0
 * @example getKeyDepth("1.2.1") => 2
 */
export function getKeyDepth(key: string): number {
  return key.split('.').length - 1;
}

/**
 * Renumber lines sequentially (useful for cleanup/export)
 * Preserves hierarchy but uses clean sequential numbers
 */
export function renumberLines(lines: Record<string, string>): Record<string, string> {
  const sortedKeys = getSortedLineKeys(lines);
  const result: Record<string, string> = {};
  const keyMapping: Record<string, string> = {};
  
  // First pass: assign new keys to top-level items
  let topLevelCounter = 1;
  sortedKeys.forEach(oldKey => {
    if (!oldKey.includes('.')) {
      keyMapping[oldKey] = String(topLevelCounter++);
    }
  });
  
  // Second pass: assign new keys to nested items
  sortedKeys.forEach(oldKey => {
    if (oldKey.includes('.')) {
      const parentOldKey = getParentKey(oldKey)!;
      const parentNewKey = keyMapping[parentOldKey];
      const prefix = parentNewKey + '.';
      
      // Count existing children for this parent
      const existingChildren = Object.values(keyMapping).filter(k => 
        k.startsWith(prefix) && !k.slice(prefix.length).includes('.')
      ).length;
      
      keyMapping[oldKey] = `${parentNewKey}.${existingChildren + 1}`;
    }
  });
  
  // Apply mapping
  sortedKeys.forEach(oldKey => {
    result[keyMapping[oldKey]] = lines[oldKey];
  });
  
  return result;
}
