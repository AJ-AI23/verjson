import { useRef, useCallback, useEffect } from 'react';
import { CollapsedState } from '@/lib/diagram/types';
import { FoldingDebugInfo } from './types';

interface UseJsonEditorEventsProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  setFoldingDebug?: (info: FoldingDebugInfo | null) => void;
  collapsedPaths: CollapsedState;
}

export const useJsonEditorEvents = ({
  onToggleCollapse,
  setFoldingDebug,
  collapsedPaths = {}
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
    };
    
    return { 
      onExpand
    };
  }, [getPathState, normalizePath, onToggleCollapse, setFoldingDebug]);

  return {
    createEditorEventHandlers,
    getPathState,
    collapsedPathsRef
  };
};
