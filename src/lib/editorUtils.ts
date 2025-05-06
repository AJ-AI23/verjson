
import { editor } from 'monaco-editor';
import { CollapsedState } from '@/lib/diagram/types';

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
 * Updates the collapsed state when the editor's folding state changes
 * @param model The editor model
 * @param decorations The folding decorations
 * @param currentCollapsedPaths The current collapsed paths state
 * @returns The updated collapsed paths
 */
export function updateCollapsedState(
  model: editor.ITextModel,
  decorations: editor.IModelDecoration[],
  currentCollapsedPaths: CollapsedState
): CollapsedState {
  const newCollapsedPaths: CollapsedState = { ...currentCollapsedPaths };
  
  // Process each decoration to find collapsed regions
  decorations.forEach(decoration => {
    if (decoration.options.isWholeLine && decoration.options.inlineClassName === 'folded') {
      const path = extractJsonPathFromLine(model, decoration.range.startLineNumber);
      if (path) {
        newCollapsedPaths[path] = true;
      }
    }
  });
  
  return newCollapsedPaths;
}

/**
 * Gets a detailed structure of the folded regions in the editor
 * @param model The editor model
 * @param decorations The editor decorations
 * @returns An array of folded region details
 */
export function getFoldedRegionDetails(
  model: editor.ITextModel,
  decorations: editor.IModelDecoration[]
): Array<{
  lineNumber: number;
  content: string;
  path: string | null;
  range: { startLine: number; endLine: number };
}> {
  if (!model) return [];
  
  const foldedRegions = decorations.filter(
    d => d.options.isWholeLine && d.options.inlineClassName === 'folded'
  );
  
  return foldedRegions.map(decoration => {
    const lineNumber = decoration.range.startLineNumber;
    return {
      lineNumber,
      content: model.getLineContent(lineNumber),
      path: extractJsonPathFromLine(model, lineNumber),
      range: {
        startLine: decoration.range.startLineNumber,
        endLine: decoration.range.endLineNumber
      }
    };
  });
}
