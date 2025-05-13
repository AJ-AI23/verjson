
import { useRef, useCallback, useEffect } from 'react';
import { CollapsedState } from '@/lib/diagram/types';
import { FoldingDebugInfo } from './types';

interface UseJsonEditorEventsProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  setFoldingDebug?: (info: FoldingDebugInfo | null) => void;
  collapsedPaths: CollapsedState;
  editorRef?: React.MutableRefObject<any>;
}

export const useJsonEditorEvents = ({
  onToggleCollapse,
  setFoldingDebug,
  collapsedPaths = {},
  editorRef
}: UseJsonEditorEventsProps) => {
  // Keep a reference to the latest collapsedPaths
  const collapsedPathsRef = useRef<Record<string, boolean>>(collapsedPaths);
  
  // Update ref when props change
  useEffect(() => {
    collapsedPathsRef.current = { ...collapsedPaths };
    console.log('Updated collapsedPathsRef in useJsonEditorEvents:', collapsedPathsRef.current);
  }, [collapsedPaths]);
  
  // Helper to normalize a path for diagram consumption
  const normalizePath = useCallback((path: string | string[]): string => {
    // If path is an array, join it
    if (Array.isArray(path)) {
      path = path.join('.');
    }
    
    // Empty path is root
    if (!path || path === '') {
      return 'root';
    }
    
    // If path doesn't start with 'root', prepend it
    const normalizedPath = path.startsWith('root') ? path : `root.${path}`;
    
    return normalizedPath;
  }, []);

  // Helper to get the current state of a path
  const getPathState = useCallback((path: string): boolean => {
    const normalizedPath = normalizePath(path);
    const currentState = collapsedPathsRef.current[normalizedPath] !== undefined ? 
      collapsedPathsRef.current[normalizedPath] : 
      true; // Default to collapsed if not specified
    
    return currentState;
  }, [normalizePath, collapsedPathsRef]);

  // Create event handlers for JSONEditor
  const createEditorEventHandlers = useCallback(() => {
    console.log('Creating JSONEditor event handlers with toggle logic');
    
    // Handle expand event from JSONEditor - we use this to toggle the collapsed state
    const onExpand = (node: any) => {
      const path = node.path.length > 0 ? node.path.join('.') : 'root';
      const normalizedPath = normalizePath(path);
      
      console.log(`onExpand called for path: ${normalizedPath}`);
      
      // Get the current state (default to true/collapsed if not set)
      const currentlyCollapsed = getPathState(normalizedPath);
      
      // Toggle the state - inverse of current state
      // If current state is true (collapsed), new state is false (expanded)
      // If current state is false (expanded), new state is true (collapsed)
      const newCollapsedState = !currentlyCollapsed;
      
      console.log(`Path ${normalizedPath}: currently ${currentlyCollapsed ? 'collapsed' : 'expanded'}, 
                  toggling to ${newCollapsedState ? 'collapsed' : 'expanded'}`);
      
      if (onToggleCollapse) {
        onToggleCollapse(normalizedPath, newCollapsedState);
      }
      
      // Update debug state if needed
      if (setFoldingDebug) {
        setFoldingDebug({
          timestamp: Date.now(),
          path: normalizedPath,
          lastOperation: 'toggle',
          isCollapsed: newCollapsedState,
          previousState: currentlyCollapsed
        });
      }
      
      // If we have access to the editor, apply the change directly to the specific node
      if (editorRef && editorRef.current) {
        try {
          // Use the expand method with the specific path
          // When newCollapsedState is true, we want to collapse (isExpand = false)
          // When newCollapsedState is false, we want to expand (isExpand = true)
          console.log(`Synchronizing JSONEditor node state for path: ${normalizedPath}`);
          console.log(`Setting node to ${newCollapsedState ? 'collapsed' : 'expanded'}`);
          
          // Convert the path back to an array for the expand method
          const pathArray = Array.isArray(node.path) ? node.path : path.split('.');
          
          // Use the expand method with the correct parameters:
          // - pathArray: The path to the node
          // - !newCollapsedState: true for expand, false for collapse
          // - false: Don't do this recursively
          editorRef.current.expand({
            path: pathArray,
            isExpand: !newCollapsedState,
            recursive: false
          });
          
          console.log(`JSONEditor expand() called with isExpand=${!newCollapsedState}, recursive=false`);
        } catch (err) {
          console.error('Error synchronizing editor node state:', err);
        }
      }
    };
    
    return { 
      onExpand
    };
  }, [getPathState, normalizePath, onToggleCollapse, setFoldingDebug, editorRef]);

  return {
    createEditorEventHandlers,
    getPathState,
    collapsedPathsRef
  };
};
