
import { FoldingDebugInfo } from './types';

interface UseJsonEditorEventsProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  setFoldingDebug: React.Dispatch<React.SetStateAction<FoldingDebugInfo | null>>;
  collapsedPaths?: Record<string, boolean>;
}

export const useJsonEditorEvents = ({
  onToggleCollapse,
  setFoldingDebug,
  collapsedPaths = {}
}: UseJsonEditorEventsProps) => {
  // Helper function to get current state with default to true (collapsed)
  const getPathState = (path: string): boolean => {
    return collapsedPaths[path] !== undefined ? collapsedPaths[path] : true;
  };

  // Create event handlers for the editor
  const createEditorEventHandlers = () => {
    return {
      // Handle expand events - this is the ONLY event we should use
      onExpand: function(node: any) {
        if (onToggleCollapse && node.path) {
          // Format path properly - empty path array means root node
          const pathStr = node.path.length > 0 ? 'root.' + node.path.join('.') : 'root';
          
          // Get the current state from our tracked state
          const currentState = getPathState(pathStr);
          
          // IMPORTANT: The expand event actually toggles - we need to invert the current state
          // regardless of what the event says (it's unreliable)
          const newState = !currentState;
          
          console.log(`Toggle collapse for path: ${pathStr}`);
          console.log(`Current tracked state: ${currentState ? 'collapsed' : 'expanded'}`);
          console.log(`Setting new state to: ${newState ? 'collapsed' : 'expanded'}`);
          
          // Log in a cleaner format
          console.log('Collapse event:', { 
            path: pathStr, 
            collapsed: newState, 
            previousState: currentState 
          });
          
          setFoldingDebug({
            lastOperation: newState ? 'collapse' : 'expand',
            path: pathStr,
            timestamp: Date.now()
          });
          
          // Call the callback to update the state with the new value
          onToggleCollapse(pathStr, newState);
        }
      },
      
      // Handle content changes
      onChange: function (this: any) {
        // Get the editor instance from context
        const editor = this;
        
        try {
          // Get the current editor content
          const json = editor.get();
          // Convert to string
          const jsonStr = JSON.stringify(json, null, 2);
          // We don't need to trigger collapse events for general content changes
        } catch (err) {
          console.error('Error getting JSON from editor:', err);
        }
      }
    };
  };

  return {
    createEditorEventHandlers
  };
};
