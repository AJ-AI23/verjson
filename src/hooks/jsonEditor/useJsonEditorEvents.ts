
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
  // Create event handlers for the editor
  const createEditorEventHandlers = () => {
    return {
      // Add direct expand event handler in the options
      onExpand: function(node: any) {
        if (onToggleCollapse && node.path) {
          // Format path properly - empty path array means root node
          const pathStr = node.path.length > 0 ? 'root.' + node.path.join('.') : 'root';
          
          // Get the previous state before we update it
          const previousState = collapsedPaths[pathStr];
          
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
          
          // Call the callback to update the state
          onToggleCollapse(pathStr, false);
        }
      },
      
      // We'll handle folding through the tree click events instead of onCollapse
      
      onChange: function (this: any) {
        // Get the editor instance from context
        const editor = this;
        
        try {
          // Get the current editor content
          const json = editor.get();
          // Convert to string
          const jsonStr = JSON.stringify(json, null, 2);
          // Update the parent component through the onChange prop
          onToggleCollapse && onToggleCollapse('onChange', false); // Not a real path, just for debug
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
