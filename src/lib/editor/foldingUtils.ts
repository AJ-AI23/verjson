
import { editor } from 'monaco-editor';
import { CollapsedState } from '@/lib/diagram/types';
import { 
  LineToPathMap, 
  FoldingRangeWithState, 
  FoldedRegionDetail,
  FoldingChanges
} from './types';
import { 
  generateLineToPathMap,
  findPathForFoldingRange
} from './pathMapping';

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
): FoldingChanges {
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
): Array<FoldedRegionDetail> {
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
