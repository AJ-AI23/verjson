
import { editor } from 'monaco-editor';
import { CollapsedState } from '@/lib/diagram/types';

// Builds a map of line numbers to JSON paths during JSON parsing
interface LineToPathMap {
  [lineNumber: number]: string;
}

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
  const pathMap = generateLineToPathMap(model);
  
  // Process each decoration to find collapsed regions
  decorations.forEach(decoration => {
    if (decoration.options.isWholeLine && decoration.options.inlineClassName === 'folded') {
      const range = {
        startLineNumber: decoration.range.startLineNumber,
        endLineNumber: decoration.range.endLineNumber
      };
      
      const path = findPathForFoldingRange(range, pathMap);
      if (path) {
        newCollapsedPaths[path] = true;
        console.log(`Found folded region at lines ${range.startLineNumber}-${range.endLineNumber}, path: ${path}`);
      }
    }
  });
  
  return newCollapsedPaths;
}

/**
 * Compare two sets of folding ranges to detect changes
 * @param previousRanges The previous folding ranges
 * @param currentRanges The current folding ranges
 * @param pathMap The line-to-path mapping
 * @returns Object containing newly folded and unfolded paths
 */
export function detectFoldingChanges(
  previousRanges: Array<{startLineNumber: number, endLineNumber: number}>,
  currentRanges: Array<{startLineNumber: number, endLineNumber: number}>,
  pathMap: LineToPathMap
): {
  folded: {path: string | null, range: {startLineNumber: number, endLineNumber: number}}[],
  unfolded: {path: string | null, range: {startLineNumber: number, endLineNumber: number}}[]
} {
  // Find ranges that were in previous but not in current (unfolded)
  const unfolded = previousRanges
    .filter(prev => !currentRanges.some(curr => 
      curr.startLineNumber === prev.startLineNumber && 
      curr.endLineNumber === prev.endLineNumber))
    .map(range => ({
      path: findPathForFoldingRange(range, pathMap),
      range
    }));
    
  // Find ranges that are in current but weren't in previous (folded)
  const folded = currentRanges
    .filter(curr => !previousRanges.some(prev => 
      prev.startLineNumber === curr.startLineNumber && 
      prev.endLineNumber === curr.endLineNumber))
    .map(range => ({
      path: findPathForFoldingRange(range, pathMap),
      range
    }));
    
  return { folded, unfolded };
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
  const pathMap = generateLineToPathMap(model);
  
  return foldedRegions.map(decoration => {
    const lineNumber = decoration.range.startLineNumber;
    const range = {
      startLineNumber: decoration.range.startLineNumber,
      endLineNumber: decoration.range.endLineNumber
    };
    
    return {
      lineNumber,
      content: model.getLineContent(lineNumber),
      path: findPathForFoldingRange(range, pathMap),
      range: {
        startLine: decoration.range.startLineNumber,
        endLine: decoration.range.endLineNumber
      }
    };
  });
}

/**
 * Get current folding ranges from the editor
 * @param editor Monaco editor instance
 * @returns Array of folding ranges
 */
export function getCurrentFoldingRanges(editor: any): Array<{
  startLineNumber: number;
  endLineNumber: number;
  isCollapsed: boolean;
}> {
  if (!editor || !editor.getModel()) return [];
  
  // Try to access folding regions through Monaco's API
  // This is somewhat Monaco-implementation specific
  try {
    // First method: try to access folding controller directly
    if (editor._privateApiMethod?.foldingController) {
      const foldingController = editor._privateApiMethod.foldingController;
      if (foldingController._foldingModel) {
        // Get regions from folding model
        return foldingController._foldingModel.regions.map(region => ({
          startLineNumber: region.startLineNumber,
          endLineNumber: region.endLineNumber,
          isCollapsed: region.isCollapsed
        }));
      }
    }
    
    // Second method: try to get from hidden areas
    const hiddenRanges = editor.getHiddenAreas ? editor.getHiddenAreas() : [];
    if (hiddenRanges.length > 0) {
      return hiddenRanges.map(range => ({
        startLineNumber: range.startLineNumber,
        endLineNumber: range.endLineNumber,
        isCollapsed: true // If it's in hidden areas, it's collapsed
      }));
    }
    
    // Third method: Check folded decorations in the model
    const model = editor.getModel();
    if (model) {
      const decorations = model.getAllDecorations().filter(
        d => d.options.isWholeLine && d.options.inlineClassName === 'folded'
      );
      
      return decorations.map(d => ({
        startLineNumber: d.range.startLineNumber,
        endLineNumber: d.range.endLineNumber,
        isCollapsed: true
      }));
    }
  } catch (e) {
    console.error('Error getting folding ranges:', e);
  }
  
  return [];
}

/**
 * Analyze the editor's model to find all folded regions
 * @param editor The Monaco editor instance
 * @returns Object with info about folded ranges and model structure
 */
export function analyzeFoldedRegions(editor: any): { 
  foldedRanges: Array<{
    start: number;
    end: number; 
    content: string; 
    path: string | null;
    foldedContent: string[];
  }>;
  modelStructure: any;
  decorations: {
    count: number;
    foldedCount: number;
    foldingDetails: {
      enabled: boolean;
      showControls: string;
      decorationDetails: any[];
    };
  };
} {
  const model = editor.getModel();
  if (!model) {
    return {
      foldedRanges: [],
      modelStructure: null,
      decorations: {
        count: 0,
        foldedCount: 0,
        foldingDetails: {
          enabled: false,
          showControls: 'none',
          decorationDetails: []
        }
      }
    };
  }
  
  // Generate path map for the entire document
  const pathMap = generateLineToPathMap(model);
  
  // Get all decorations and filter for folded regions
  const decorations = model.getAllDecorations();
  const foldedDecorations = decorations.filter(
    d => d.options.isWholeLine && d.options.inlineClassName === 'folded'
  );
  
  // Extract fold ranges and their paths
  const foldedRanges = foldedDecorations.map(d => {
    const startLine = d.range.startLineNumber;
    const endLine = d.range.endLineNumber;
    const range = {
      startLineNumber: startLine,
      endLineNumber: endLine
    };
    
    // Get a preview of the folded content (up to 10 lines)
    const foldedContentPreview: string[] = [];
    for (let i = startLine; i <= Math.min(endLine, startLine + 10); i++) {
      foldedContentPreview.push(model.getLineContent(i));
    }
    if (endLine > startLine + 10) {
      foldedContentPreview.push(`... and ${endLine - startLine - 10} more lines`);
    }
    
    return {
      start: startLine,
      end: endLine,
      content: model.getLineContent(startLine),
      path: findPathForFoldingRange(range, pathMap),
      foldedContent: foldedContentPreview
    };
  });
  
  // Get current folding ranges
  const currentFoldingRanges = getCurrentFoldingRanges(editor);
  
  console.log('Current folding ranges:', currentFoldingRanges);
  console.log('Path map:', pathMap);
  console.log('Folded ranges with paths:', foldedRanges);
  
  // Collect decoration details for deeper inspection
  const decorationDetails = foldedDecorations.map(d => ({
    id: d.id,
    range: `${d.range.startLineNumber}:${d.range.startColumn} - ${d.range.endLineNumber}:${d.range.endColumn}`,
    options: {
      ...d.options,
      // Ensure we don't include any circular references
      hoverMessage: d.options.hoverMessage ? 'present' : 'none',
      glyphMarginHoverMessage: d.options.glyphMarginHoverMessage ? 'present' : 'none'
    }
  }));
  
  // Get basic model structure information
  const modelStructure = {
    lineCount: model.getLineCount(),
    valueLength: model.getValueLength(),
    modelId: model.id,
    language: model.getLanguageId(),
    tabSize: model.getOptions().tabSize
  };
  
  // Get editor folding options
  const editorOptions = editor.getOptions();
  const foldingEnabled = editorOptions.get('folding');
  const showFoldingControls = editorOptions.get('showFoldingControls');
  
  return {
    foldedRanges,
    modelStructure,
    decorations: {
      count: decorations.length,
      foldedCount: foldedDecorations.length,
      foldingDetails: {
        enabled: foldingEnabled,
        showControls: showFoldingControls,
        decorationDetails
      }
    }
  };
}
