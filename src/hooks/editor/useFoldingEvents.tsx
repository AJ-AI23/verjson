
import { useCallback, useRef } from 'react';
import { Monaco } from '@monaco-editor/react';
import { toast } from 'sonner';
import { getCurrentFoldingRanges } from '@/lib/editor';
import { setupFoldingCommands } from './foldingUtils/setupFoldingCommands';
import { detectFoldingChanges } from './foldingUtils/detectFoldingChanges';

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
    try {
      const model = editor.getModel();
      if (!model) return;
      
      // Get current folding ranges
      const currentFoldingRanges = getCurrentFoldingRanges(editor);
      
      // Only continue if we have both current and previous ranges
      if (currentFoldingRanges.length === 0 && previousFoldingRangesRef.current.length === 0) {
        return;
      }
      
      if (isDebugMode) {
        console.log('===== FOLD/UNFOLD EVENT DETECTED =====');
        console.log('Event timestamp:', new Date().toISOString());
        console.log('Previous folding ranges count:', previousFoldingRangesRef.current.length);
        console.log('Current folding ranges count:', currentFoldingRanges.length);
      }
      
      // Detect and process folding changes
      detectFoldingChanges(
        editor,
        previousFoldingRangesRef.current,
        currentFoldingRanges,
        pathMapRef,
        onToggleCollapse,
        isDebugMode
      );
      
      // Update reference to current ranges for next comparison
      previousFoldingRangesRef.current = currentFoldingRanges
        .filter(r => r.isCollapsed)
        .map(({ startLineNumber, endLineNumber }) => ({ 
          startLineNumber, 
          endLineNumber 
        }));
      
      if (isDebugMode) {
        console.log('===== END FOLD/UNFOLD EVENT =====');
      }
    } catch (error) {
      console.error('Error processing folding changes:', error);
      toast.error('Error processing fold/unfold event', {
        description: (error instanceof Error) ? error.message : 'Unknown error'
      });
    }
  }, [onToggleCollapse]);

  // Configure keyboard commands for fold/unfold actions
  const setupFoldingCommandsCallback = useCallback((
    editor: any, 
    monaco: Monaco,
    inspectFoldedRegions: (editor: any, pathMapRef: any) => any,
    pathMapRef: React.MutableRefObject<{[lineNumber: number]: string}>
  ) => {
    setupFoldingCommands(editor, monaco, inspectFoldedRegions, pathMapRef, processFoldingChanges);
  }, [processFoldingChanges]);

  return {
    previousFoldingRangesRef,
    processFoldingChanges,
    setupFoldingCommands: setupFoldingCommandsCallback
  };
};
