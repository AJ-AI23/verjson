
import { editor } from 'monaco-editor';
import { LineToPathMap } from './types';

/**
 * Extracts JSON path from a line in the editor
 * @param model The editor model
 * @param lineNumber The line number to extract path from
 * @returns The JSON path string
 */
export function extractJsonPathFromLine(model: editor.ITextModel, lineNumber: number): string | null {
  if (!model) return null;
  
  // Get the content of the line
  const lineContent = model.getLineContent(lineNumber).trim();
  
  // Extract property name from the line
  const matches = lineContent.match(/"([^"]+)"\s*:/);
  if (!matches || !matches[1]) return null;
  
  const propertyName = matches[1];
  
  // Calculate the indentation level to determine path hierarchy
  const indentation = model.getLineContent(lineNumber).indexOf('"');
  const level = Math.floor(indentation / 2);
  
  // Build the path based on parent lines
  let path = propertyName;
  let currentLevel = level;
  let currentLine = lineNumber;
  
  console.log(`Building path for "${propertyName}" at line ${lineNumber}, indent level: ${level}, indentation: ${indentation}`);
  
  // Traverse up the document to build the full path
  while (currentLevel > 0 && currentLine > 1) {
    currentLine--;
    const prevLineContent = model.getLineContent(currentLine).trim();
    const prevIndent = model.getLineContent(currentLine).indexOf('"');
    
    console.log(`Checking line ${currentLine}: "${prevLineContent}" (indent: ${prevIndent})`);
    
    // If we found a parent property (with less indentation)
    if (prevIndent >= 0 && prevIndent < indentation) {
      const parentMatches = prevLineContent.match(/"([^"]+)"\s*:/);
      if (parentMatches && parentMatches[1]) {
        const parentProp = parentMatches[1];
        console.log(`Found parent property: "${parentProp}" at indent ${prevIndent} vs current indent ${indentation}`);
        path = `${parentProp}.${path}`;
        currentLevel--;
      }
    }
  }
  
  const fullPath = `root.${path}`;
  console.log(`Final path for line ${lineNumber}: ${fullPath}`);
  return fullPath;
}

/**
 * Generates a map of line numbers to JSON paths for the entire document
 * @param model The editor model
 * @returns A map of line numbers to JSON paths
 */
export function generateLineToPathMap(model: editor.ITextModel): LineToPathMap {
  if (!model) return {};
  
  const lineCount = model.getLineCount();
  const pathMap: LineToPathMap = {};
  
  console.log(`Generating line-to-path map for ${lineCount} lines`);
  
  for (let i = 1; i <= lineCount; i++) {
    const lineContent = model.getLineContent(i).trim();
    
    // Only process lines that define properties
    if (lineContent.match(/"([^"]+)"\s*:/)) {
      const path = extractJsonPathFromLine(model, i);
      if (path) {
        pathMap[i] = path;
        console.log(`Mapped line ${i} to path ${path}`);
      }
    }
  }
  
  console.log(`Generated path map with ${Object.keys(pathMap).length} entries`);
  return pathMap;
}

/**
 * Finds the JSON path for a folding range by finding the closest property line
 * @param range The folding range
 * @param pathMap The line-to-path mapping
 * @returns The JSON path for the folding range
 */
export function findPathForFoldingRange(
  range: {startLineNumber: number, endLineNumber: number},
  pathMap: LineToPathMap
): string | null {
  // First try to find a path for the exact start line
  if (pathMap[range.startLineNumber]) {
    return pathMap[range.startLineNumber];
  }
  
  // If not found, look for the closest line before that has a path
  for (let i = range.startLineNumber - 1; i > 0; i--) {
    if (pathMap[i]) {
      return pathMap[i];
    }
  }
  
  return null;
}
