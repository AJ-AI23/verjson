
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
  
  // Get all decorations and filter for folded regions
  const decorations = model.getAllDecorations();
  const foldedDecorations = decorations.filter(
    d => d.options.isWholeLine && d.options.inlineClassName === 'folded'
  );
  
  // Extract fold ranges and their paths
  const foldedRanges = foldedDecorations.map(d => {
    const startLine = d.range.startLineNumber;
    const endLine = d.range.endLineNumber;
    
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
      path: extractJsonPathFromLine(model, startLine),
      foldedContent: foldedContentPreview
    };
  });
  
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
