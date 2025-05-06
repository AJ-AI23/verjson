
import { LineToPathMap } from '@/lib/editor/types';
import { findPathForFoldingRange, generateLineToPathMap } from '@/lib/editor';
import { editor } from 'monaco-editor';

/**
 * Resolves a path for a folding range, using multiple fallback methods if needed
 */
export function resolvePathForFoldingRange(
  range: { startLineNumber: number, endLineNumber: number },
  pathMap: LineToPathMap,
  model: editor.ITextModel
): string | null {
  // First try direct path lookup
  let path = findPathForFoldingRange(range, pathMap);
  
  if (!path && model) {
    // Fallback: Check the content of the line to extract path information
    const lineContent = model.getLineContent(range.startLineNumber).trim();
    const propertyMatch = lineContent.match(/"([^"]+)"\s*:/);
    
    if (propertyMatch && propertyMatch[1]) {
      // Found a property name at least
      path = `unknown.${propertyMatch[1]}`;
      console.log(`Fallback path extraction for line ${range.startLineNumber}: ${path}`);
    }
  }
  
  return path;
}

/**
 * Process folding change for a single path
 */
export function processFoldingChange(
  path: string | null, 
  range: { startLineNumber: number, endLineNumber: number },
  isCollapsed: boolean,
  model: editor.ITextModel,
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void,
  isDebugMode: boolean = false
): void {
  if (path && onToggleCollapse) {
    if (isDebugMode) {
      const action = isCollapsed ? 'Folding' : 'Unfolding';
      console.log(`${action} detected at line ${range.startLineNumber}, path: ${path}`);
    }
    
    onToggleCollapse(path, isCollapsed);
  } else if (isDebugMode) {
    console.warn(`Could not find path for ${isCollapsed ? 'folded' : 'unfolded'} region at line ${range.startLineNumber}`);
  }
}

/**
 * Compare two sets of folding ranges to detect changes
 */
export function detectFoldingChanges(
  editor: any,
  previousRanges: Array<{startLineNumber: number, endLineNumber: number}>,
  currentRanges: Array<{startLineNumber: number, endLineNumber: number, isCollapsed: boolean}>,
  pathMapRef: React.MutableRefObject<{[lineNumber: number]: string}>,
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void,
  isDebugMode: boolean = false
): void {
  const model = editor.getModel();
  if (!model) return;
  
  // Filter to just the ranges that represent collapsed sections
  const prevCollapsedRanges = previousRanges;
  const currCollapsedRanges = currentRanges
    .filter(r => r.isCollapsed)
    .map(({ startLineNumber, endLineNumber }) => ({ startLineNumber, endLineNumber }));
  
  // Ensure we have the latest path map
  if (Object.keys(pathMapRef.current).length === 0) {
    if (isDebugMode) {
      console.log('Path map is empty, regenerating...');
    }
    pathMapRef.current = generateLineToPathMap(model);
  }
  
  // Find ranges that were in previous but not in current (unfolded)
  const unfolded = prevCollapsedRanges
    .filter(prev => !currCollapsedRanges.some(curr => 
      curr.startLineNumber === prev.startLineNumber && 
      curr.endLineNumber === prev.endLineNumber));
  
  // Find ranges that are in current but weren't in previous (folded)
  const folded = currCollapsedRanges
    .filter(curr => !prevCollapsedRanges.some(prev => 
      prev.startLineNumber === curr.startLineNumber && 
      prev.endLineNumber === curr.endLineNumber));
  
  if (isDebugMode) {
    console.log('Detected changes:');
    console.log('- Newly folded:', folded.length);
    console.log('- Newly unfolded:', unfolded.length);
  }
  
  // Process newly folded ranges
  if (folded.length > 0) {
    folded.forEach(range => {
      const path = resolvePathForFoldingRange(range, pathMapRef.current, model);
      processFoldingChange(path, range, true, model, onToggleCollapse, isDebugMode);
      
      // If we couldn't find a path, regenerate the path map for next time
      if (!path) {
        setTimeout(() => {
          pathMapRef.current = generateLineToPathMap(model);
          if (isDebugMode) {
            console.log('Path map regenerated after failed path lookup');
          }
        }, 100);
      }
    });
  }
  
  // Process newly unfolded ranges
  if (unfolded.length > 0) {
    unfolded.forEach(range => {
      const path = resolvePathForFoldingRange(range, pathMapRef.current, model);
      processFoldingChange(path, range, false, model, onToggleCollapse, isDebugMode);
    });
  }
}
