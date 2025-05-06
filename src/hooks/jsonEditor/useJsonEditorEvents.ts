
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
      // Add direct collapse/expand event handlers in the options
      onExpand: function(node: any) {
        if (onToggleCollapse && node.path) {
          // Format path properly - empty path array means root node
          const pathStr = node.path.length > 0 ? 'root.' + node.path.join('.') : 'root';
          
          console.log('Expanded path via onExpand:', node.path);
          console.log('Path string:', pathStr);
          console.log('Current collapsed state before update:', collapsedPaths);
          
          setFoldingDebug({
            lastOperation: 'expand',
            path: pathStr,
            timestamp: Date.now()
          });
          
          onToggleCollapse(pathStr, false);
          
          // Log the state after the callback (though this won't reflect the actual state update yet)
          console.log('New collapsed state will be:', {
            ...collapsedPaths,
            [pathStr]: false
          });
        }
      },
      
      onCollapse: function(node: any) {
        if (onToggleCollapse && node.path) {
          // Format path properly - empty path array means root node
          const pathStr = node.path.length > 0 ? 'root.' + node.path.join('.') : 'root';
          
          console.log('Collapsed path via onCollapse:', node.path);
          console.log('Path string:', pathStr);
          console.log('Current collapsed state before update:', collapsedPaths);
          
          setFoldingDebug({
            lastOperation: 'collapse',
            path: pathStr,
            timestamp: Date.now()
          });
          
          onToggleCollapse(pathStr, true);
          
          // Log the state after the callback (though this won't reflect the actual state update yet)
          console.log('New collapsed state will be:', {
            ...collapsedPaths,
            [pathStr]: true
          });
        }
      },
      
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
