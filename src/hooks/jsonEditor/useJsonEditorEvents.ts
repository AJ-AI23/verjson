
import { FoldingDebugInfo } from './types';

interface UseJsonEditorEventsProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  setFoldingDebug: React.Dispatch<React.SetStateAction<FoldingDebugInfo | null>>;
}

export const useJsonEditorEvents = ({
  onToggleCollapse,
  setFoldingDebug
}: UseJsonEditorEventsProps) => {
  // Create event handlers for the editor
  const createEditorEventHandlers = () => {
    return {
      // Add direct collapse/expand event handlers in the options
      onExpand: function(node: any) {
        if (onToggleCollapse && node.path) {
          console.log('Expanded path via onExpand:', node.path);
          const path = 'root.' + node.path.join('.');
          setFoldingDebug({
            lastOperation: 'expand',
            path,
            timestamp: Date.now()
          });
          onToggleCollapse(path, false);
        }
      },
      
      onCollapse: function(node: any) {
        if (onToggleCollapse && node.path) {
          console.log('Collapsed path via onCollapse:', node.path);
          const path = 'root.' + node.path.join('.');
          setFoldingDebug({
            lastOperation: 'collapse',
            path,
            timestamp: Date.now()
          });
          onToggleCollapse(path, true);
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
