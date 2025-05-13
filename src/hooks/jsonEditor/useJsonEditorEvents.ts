
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
      // Handle expand/collapse events
      onExpand: function(node: any) {
        if (onToggleCollapse && node.path) {
          // Format path properly - empty path array means root node
          const pathStr = node.path.length > 0 ? 'root.' + node.path.join('.') : 'root';
          
          // Get current state from editor node
          const isNodeCollapsed = node.collapsed || false;
          
          console.log(`Node event for path: ${pathStr}, node.collapsed=${isNodeCollapsed}`);
          
          // The event is triggered AFTER the node state changes in the editor
          // So we need to pass the OPPOSITE of node.collapsed to our state
          onToggleCollapse(pathStr, isNodeCollapsed);
          
          setFoldingDebug({
            lastOperation: isNodeCollapsed ? 'collapse' : 'expand',
            path: pathStr,
            timestamp: Date.now()
          });
          
          // Update our local reference
          collapsedPathsRef.current = {
            ...collapsedPathsRef.current,
            [pathStr]: isNodeCollapsed
          };
          
          console.log('Updated collapsed state for path:', pathStr, 'isCollapsed:', isNodeCollapsed);
        }
      },
      
      // Handle content changes
      onChange: function (this: any) {
        // We don't need to trigger collapse events for general content changes
      }
    };
  };

  return {
    createEditorEventHandlers,
    getPathState
  };
};
