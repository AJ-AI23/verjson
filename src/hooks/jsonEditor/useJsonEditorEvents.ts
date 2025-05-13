
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
          
          // Check if the node is being expanded or collapsed in the editor
          // In JSONEditor, onExpand gets triggered for both expand and collapse actions
          // node.expanded shows the NEW state after the user action
          const isBeingExpanded = node.expanded === true;
          const isBeingCollapsed = node.expanded === false;
          
          if (isBeingExpanded || isBeingCollapsed) {
            // The diagram should mirror the editor state exactly:
            // - When a node is expanded in editor, it should be NOT collapsed in our state (false)
            // - When a node is collapsed in editor, it should be collapsed in our state (true)
            const newCollapsedState = !isBeingExpanded;
            
            console.log(`Toggle collapse for path: ${pathStr}`);
            console.log(`Editor node is now: ${isBeingExpanded ? 'expanded' : 'collapsed'}`);
            console.log(`Setting collapsed state to: ${newCollapsedState}`);
            
            // Log in a cleaner format
            console.log('Collapse event:', { 
              path: pathStr, 
              collapsed: newCollapsedState, 
              editorExpanded: isBeingExpanded 
            });
            
            setFoldingDebug({
              lastOperation: newCollapsedState ? 'collapse' : 'expand',
              path: pathStr,
              timestamp: Date.now()
            });
            
            // Call the callback to update the state with the new value
            onToggleCollapse(pathStr, newCollapsedState);
            
            // Also update our local reference
            collapsedPathsRef.current = {
              ...collapsedPathsRef.current,
              [pathStr]: newCollapsedState
            };
          }
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
