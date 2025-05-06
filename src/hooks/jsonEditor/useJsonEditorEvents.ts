
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
          
          // Log in a cleaner format
          console.log('Collapse event:', { 
            path: pathStr, 
            collapsed: false, 
            previousState: collapsedPaths[pathStr]
          });
          
          setFoldingDebug({
            lastOperation: 'expand',
            path: pathStr,
            timestamp: Date.now()
          });
          
          onToggleCollapse(pathStr, false);
        }
      },
      
      onCollapse: function(node: any) {
        if (onToggleCollapse && node.path) {
          // Format path properly - empty path array means root node
          const pathStr = node.path.length > 0 ? 'root.' + node.path.join('.') : 'root';
          
          // Log in a cleaner format
          console.log('Collapse event:', { 
            path: pathStr, 
            collapsed: true,
            previousState: collapsedPaths[pathStr]
          });
          
          setFoldingDebug({
            lastOperation: 'collapse',
            path: pathStr,
            timestamp: Date.now()
          });
          
          onToggleCollapse(pathStr, true);
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
