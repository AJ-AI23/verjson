
import { useCallback, useRef } from 'react';
import { Monaco } from '@monaco-editor/react';
import { CollapsedState } from '@/lib/diagram/types';
import { 
  getCurrentFoldingRanges,
  detectFoldingChanges,
  generateLineToPathMap
} from '@/lib/editor';

/**
 * Hook for handling folding events in Monaco editor
 */
export const useFoldingEvents = (onToggleCollapse?: (path: string, isCollapsed: boolean) => void) => {
  // Store previous folding ranges for comparison
  const previousFoldingRangesRef = useRef<Array<{startLineNumber: number, endLineNumber: number}>>([]);
  
  // Process folding changes
  const processFoldingChanges = useCallback((
    editor: any, 
    pathMapRef: React.MutableRefObject<{[lineNumber: number]: string}>,
    isDebugMode: boolean
  ) => {
    const model = editor.getModel();
    if (!model) return;
    
    // Get current folding ranges
    const currentFoldingRanges = getCurrentFoldingRanges(editor);
    
    // Only continue if we have both current and previous ranges
    if (currentFoldingRanges.length === 0 && previousFoldingRangesRef.current.length === 0) {
      return;
    }
    
    console.log('===== FOLD/UNFOLD EVENT DETECTED =====');
    console.log('Event timestamp:', new Date().toISOString());
    console.log('Previous folding ranges count:', previousFoldingRangesRef.current.length);
    console.log('Current folding ranges count:', currentFoldingRanges.length);
    
    // Filter to just the ranges that represent collapsed sections
    const prevCollapsedRanges = previousFoldingRangesRef.current;
    const currCollapsedRanges = currentFoldingRanges
      .filter(r => r.isCollapsed)
      .map(({ startLineNumber, endLineNumber }) => ({ 
        startLineNumber, 
        endLineNumber 
      }));
    
    // Ensure we have the latest path map
    if (Object.keys(pathMapRef.current).length === 0) {
      pathMapRef.current = generateLineToPathMap(model);
    }
    
    // Detect changes between previous and current ranges
    const changes = detectFoldingChanges(
      prevCollapsedRanges,
      currCollapsedRanges,
      pathMapRef.current
    );
    
    console.log('Detected changes:');
    console.log('- Newly folded:', changes.folded);
    console.log('- Newly unfolded:', changes.unfolded);
    
    if (onToggleCollapse) {
      // Process newly folded ranges
      if (changes.folded.length > 0) {
        changes.folded.forEach(({ path, range }) => {
          if (path) {
            console.log(`Folding detected at line ${range.startLineNumber}, path: ${path}`);
            onToggleCollapse(path, true);
            
            // Show folding details for debugging
            if (isDebugMode) {
              const content = model.getLineContent(range.startLineNumber).trim();
              toast.info(`Folded: ${path}`, {
                description: `Line ${range.startLineNumber}: ${content}`
              });
            }
          }
        });
      }
      
      // Process newly unfolded ranges
      if (changes.unfolded.length > 0) {
        changes.unfolded.forEach(({ path, range }) => {
          if (path) {
            console.log(`Unfolding detected at line ${range.startLineNumber}, path: ${path}`);
            onToggleCollapse(path, false);
            
            // Show unfolding details for debugging
            if (isDebugMode) {
              const content = model.getLineContent(range.startLineNumber).trim();
              toast.info(`Expanded: ${path}`, {
                description: `Line ${range.startLineNumber}: ${content}`
              });
            }
          }
        });
      }
    }
    
    // Update reference to current ranges for next comparison
    previousFoldingRangesRef.current = currCollapsedRanges;
    console.log('===== END FOLD/UNFOLD EVENT =====');
  }, [onToggleCollapse]);

  // Configure keyboard commands for fold/unfold actions
  const setupFoldingCommands = useCallback((
    editor: any, 
    monaco: Monaco,
    inspectFoldedRegions: (editor: any, pathMapRef: any) => any,
    pathMapRef: React.MutableRefObject<{[lineNumber: number]: string}>
  ) => {
    // Setup keyboard command listeners for fold/unfold actions
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.BracketLeft, () => {
      console.log("Fold command triggered via keyboard");
      // Log current folded state after a delay to allow folding to complete
      setTimeout(() => inspectFoldedRegions(editor, pathMapRef), 100);
    });
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.BracketRight, () => {
      console.log("Unfold command triggered via keyboard");
      // Log current folded state after a delay to allow unfolding to complete
      setTimeout(() => inspectFoldedRegions(editor, pathMapRef), 100);
    });
  }, []);

  return {
    previousFoldingRangesRef,
    processFoldingChanges,
    setupFoldingCommands
  };
};
