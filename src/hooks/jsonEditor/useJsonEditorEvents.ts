
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
      // Handle expand events
      onExpand: function(node: any) {
        if (onToggleCollapse && node.path) {
          // Format path properly - empty path array means root node
          const pathStr = node.path.length > 0 ? 'root.' + node.path.join('.') : 'root';
          
          // Get the previous state
          const previousState = getPathState(pathStr);
          
          console.log('Current collapsed state before update:', collapsedPaths);
          console.log('Expanded path via onExpand:', node.path);
          console.log('Path string:', pathStr);
          
          // Log in a cleaner format
          console.log('Collapse event:', { 
            path: pathStr, 
            collapsed: false, 
            previousState 
          });
          
          setFoldingDebug({
            lastOperation: 'expand',
            path: pathStr,
            timestamp: Date.now()
          });
          
          console.log('New collapsed state will be:', {...collapsedPaths, [pathStr]: false});
          
          // Call the callback to update the state to expanded (false)
          onToggleCollapse(pathStr, false);
        }
      },
      
      // Handle collapse events - this is key for toggle functionality
      onCollapse: function(node: any) {
        if (onToggleCollapse && node.path) {
          // Format path properly - empty path array means root node
          const pathStr = node.path.length > 0 ? 'root.' + node.path.join('.') : 'root';
          
          // Get the previous state
          const previousState = getPathState(pathStr);
          
          console.log('Current collapsed state before update:', collapsedPaths);
          console.log('Collapsed path via onCollapse:', node.path);
          console.log('Path string:', pathStr);
          
          // Log in a cleaner format
          console.log('Collapse event:', { 
            path: pathStr, 
            collapsed: true, 
            previousState 
          });
          
          setFoldingDebug({
            lastOperation: 'collapse',
            path: pathStr,
            timestamp: Date.now()
          });
          
          console.log('New collapsed state will be:', {...collapsedPaths, [pathStr]: true});
          
          // Call the callback to update the state to collapsed (true)
          onToggleCollapse(pathStr, true);
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
          // Update the parent component through the onChange prop
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
