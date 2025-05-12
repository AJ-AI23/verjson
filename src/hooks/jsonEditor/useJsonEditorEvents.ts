
import { useRef } from 'react';
import { FoldingDebugInfo } from './types';
import { toggleCollapsedState } from '@/lib/editor/jsonEditorUtils';

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
  // Store original collapsed paths for comparison
  const collapsedPathsRef = useRef<Record<string, boolean>>(collapsedPaths);
  
  // Update ref when props change
  if (collapsedPaths !== collapsedPathsRef.current) {
    collapsedPathsRef.current = collapsedPaths;
    console.log('Updated collapsedPathsRef in useJsonEditorEvents:', collapsedPathsRef.current);
  }

  // Helper function to get current state with default to true (collapsed)
  const getPathState = (path: string): boolean => {
    return collapsedPathsRef.current[path] !== undefined ? collapsedPathsRef.current[path] : true;
  };

  // Create event handlers for the editor
  const createEditorEventHandlers = () => {
    return {
      // Handle expand events - this is the ONLY event we should use
      onExpand: function(node: any) {
        if (onToggleCollapse && node.path) {
          // Format path properly - empty path array means root node
          const pathStr = node.path.length > 0 ? 'root.' + node.path.join('.') : 'root';
          
          // Use the simplified toggle function
          const toggleResult = toggleCollapsedState(pathStr, collapsedPathsRef.current);
          const newState = toggleResult.newState;
          
          console.log(`Toggle collapse for path: ${pathStr}`);
          console.log(`Current tracked state: ${!toggleResult.newState ? 'collapsed' : 'expanded'}`);
          console.log(`Setting new state to: ${toggleResult.newState ? 'collapsed' : 'expanded'}`);
          console.log(`Current collapsedPaths object:`, collapsedPathsRef.current);
          
          // Log in a cleaner format
          console.log('Collapse event:', { 
            path: pathStr, 
            collapsed: newState, 
            previousState: toggleResult.previousState 
          });
          
          setFoldingDebug({
            lastOperation: newState ? 'collapse' : 'expand',
            path: pathStr,
            timestamp: Date.now()
          });
          
          // Call the callback to update the state with the new value
          onToggleCollapse(pathStr, newState);
          
          // Also update our local reference
          collapsedPathsRef.current = {
            ...collapsedPathsRef.current,
            [pathStr]: newState
          };
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
    createEditorEventHandlers,
    getPathState
  };
};
