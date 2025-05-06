
import { Monaco } from '@monaco-editor/react';
import { toast } from 'sonner';
import { generateLineToPathMap } from '@/lib/editor';

/**
 * Configure keyboard commands for fold/unfold actions
 */
export function setupFoldingCommands(
  editor: any, 
  monaco: Monaco,
  inspectFoldedRegions: (editor: any, pathMapRef: any) => any,
  pathMapRef: React.MutableRefObject<{[lineNumber: number]: string}>,
  processFoldingChanges: (editor: any, pathMapRef: React.MutableRefObject<{[lineNumber: number]: string}>, isDebugMode: boolean) => void
): void {
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
    
    // Add direct toggle operation command to debug folding events
    editor.addAction({
      id: 'debug-toggle-fold',
      label: 'Debug Toggle Fold State',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      run: () => {
        console.log("Manual folding debug triggered");
        
        // Get folding controller (internal Monaco API)
        const foldingController = editor._actions?.["editor.foldAll"]?.run ? editor : 
                                 editor._privateApiMethod?.foldingController;
        
        if (foldingController) {
          // Attempt to toggle folding
          try {
            // First check if we can call the action directly
            if (editor._actions?.["editor.toggleFold"]?.run) {
              editor._actions["editor.toggleFold"].run();
              console.log("Toggled fold via editor action");
            } else if (foldingController.toggleFoldingAtLine) {
              // Get current position
              const position = editor.getPosition();
              if (position) {
                foldingController.toggleFoldingAtLine(position.lineNumber);
                console.log(`Toggled folding at line ${position.lineNumber}`);
              }
            }
            
            // Process the folding change after a short delay
            setTimeout(() => {
              const model = editor.getModel();
              if (model) {
                processFoldingChanges(editor, pathMapRef, true);
              }
            }, 100);
            
          } catch (error) {
            console.error("Error toggling fold:", error);
          }
        } else {
          console.warn("Could not access folding controller");
        }
      }
    });
  } catch (error) {
    console.error('Error setting up folding commands:', error);
    toast.error('Error setting up editor commands', {
      description: (error instanceof Error) ? error.message : 'Unknown error'
    });
  }
}
