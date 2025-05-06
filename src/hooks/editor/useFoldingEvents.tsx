
import { useCallback, useRef } from 'react';
import { Monaco } from '@monaco-editor/react';
import { toast } from 'sonner';
import { CollapsedState } from '@/lib/diagram/types';
import { 
  getCurrentFoldingRanges,
  detectFoldingChanges,
  generateLineToPathMap,
  findPathForFoldingRange
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
        if (isDebugMode) {
          console.log('Path map is empty, regenerating...');
        }
        pathMapRef.current = generateLineToPathMap(model);
      }
      
      // Detect changes between previous and current ranges
      const changes = detectFoldingChanges(
        prevCollapsedRanges,
        currCollapsedRanges,
        pathMapRef.current
      );
      
      if (isDebugMode) {
        console.log('Detected changes:');
        console.log('- Newly folded:', changes.folded);
        console.log('- Newly unfolded:', changes.unfolded);
      }
      
      if (onToggleCollapse) {
        // Process newly folded ranges
        if (changes.folded.length > 0) {
          changes.folded.forEach(({ path, range }) => {
            // If no path was found using standard methods, try again with more aggressive methods
            let resolvedPath = path;
            
            if (!resolvedPath) {
              // Try to directly find a path for this range
              resolvedPath = findPathForFoldingRange(range, pathMapRef.current);
              
              if (!resolvedPath) {
                // Last resort: Check the content of the line to try to extract path information
                const lineContent = model.getLineContent(range.startLineNumber).trim();
                const propertyMatch = lineContent.match(/"([^"]+)"\s*:/);
                
                if (propertyMatch && propertyMatch[1]) {
                  // Found a property name at least
                  resolvedPath = `unknown.${propertyMatch[1]}`;
                  
                  if (isDebugMode) {
                    console.log(`Fallback path extraction for line ${range.startLineNumber}: ${resolvedPath}`);
                  }
                }
              }
            }
            
            if (resolvedPath) {
              if (isDebugMode) {
                console.log(`Folding detected at line ${range.startLineNumber}, path: ${resolvedPath}`);
              }
              onToggleCollapse(resolvedPath, true);
              
              // Show folding details for debugging
              if (isDebugMode) {
                const content = model.getLineContent(range.startLineNumber).trim();
                toast.info(`Folded: ${resolvedPath}`, {
                  description: `Line ${range.startLineNumber}: ${content}`
                });
              }
            } else {
              // Still couldn't find a path, log warning and regenerate path map
              console.warn(`Could not find path for folded region at line ${range.startLineNumber}`);
              
              // Force a path map regeneration for next time
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
        if (changes.unfolded.length > 0) {
          changes.unfolded.forEach(({ path, range }) => {
            // If no path was found using standard methods, try again with more aggressive methods
            let resolvedPath = path;
            
            if (!resolvedPath) {
              // Try to directly find a path for this range
              resolvedPath = findPathForFoldingRange(range, pathMapRef.current);
              
              if (!resolvedPath) {
                // Last resort: Check the content of the line to try to extract path information
                const lineContent = model.getLineContent(range.startLineNumber).trim();
                const propertyMatch = lineContent.match(/"([^"]+)"\s*:/);
                
                if (propertyMatch && propertyMatch[1]) {
                  // Found a property name at least
                  resolvedPath = `unknown.${propertyMatch[1]}`;
                  
                  if (isDebugMode) {
                    console.log(`Fallback path extraction for line ${range.startLineNumber}: ${resolvedPath}`);
                  }
                }
              }
            }
            
            if (resolvedPath) {
              if (isDebugMode) {
                console.log(`Unfolding detected at line ${range.startLineNumber}, path: ${resolvedPath}`);
              }
              onToggleCollapse(resolvedPath, false);
              
              // Show unfolding details for debugging
              if (isDebugMode) {
                const content = model.getLineContent(range.startLineNumber).trim();
                toast.info(`Expanded: ${resolvedPath}`, {
                  description: `Line ${range.startLineNumber}: ${content}`
                });
              }
            } else {
              // Still couldn't find a path, log warning
              console.warn(`Could not find path for unfolded region at line ${range.startLineNumber}`);
            }
          });
        }
      }
      
      // Update reference to current ranges for next comparison
      previousFoldingRangesRef.current = currCollapsedRanges;
      
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
  const setupFoldingCommands = useCallback((
    editor: any, 
    monaco: Monaco,
    inspectFoldedRegions: (editor: any, pathMapRef: any) => any,
    pathMapRef: React.MutableRefObject<{[lineNumber: number]: string}>
  ) => {
    try {
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
      
      // Add custom action for refreshing path map
      editor.addAction({
        id: 'refresh-path-map',
        label: 'Refresh JSON Path Map',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyP],
        run: () => {
          const model = editor.getModel();
          if (model) {
            pathMapRef.current = generateLineToPathMap(model);
            toast.success('Path map refreshed', {
              description: `Mapped ${Object.keys(pathMapRef.current).length} lines to JSON paths`
            });
            console.log('Path map refreshed manually:', pathMapRef.current);
          }
        }
      });
    } catch (error) {
      console.error('Error setting up folding commands:', error);
      toast.error('Error setting up editor commands', {
        description: (error instanceof Error) ? error.message : 'Unknown error'
      });
    }
  }, []);

  return {
    previousFoldingRangesRef,
    processFoldingChanges,
    setupFoldingCommands
  };
};
