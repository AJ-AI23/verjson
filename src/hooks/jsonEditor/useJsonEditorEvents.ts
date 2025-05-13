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
      false; // Default to expanded if not specified
    
    return currentState;
  }, [normalizePath, collapsedPathsRef]);

  // Create event handlers for JSONEditor
  const createEditorEventHandlers = useCallback(() => {
    console.log('Creating JSONEditor event handlers with toggle logic');
    
    // Handle node visibility toggle - now we use the same handler for both expand/collapse operations
    const onToggleNode = (node: any, actionType: string) => {
      const path = node.path.length > 0 ? node.path.join('.') : 'root';
      const normalizedPath = normalizePath(path);
      
      console.log(`onToggleNode called for path: ${normalizedPath}, action: ${actionType}`);
      
      // Get the current tracked state (true = collapsed, false = expanded)
      const currentlyCollapsed = getPathState(normalizedPath);
      
      // If expanding, the new state should be false (not collapsed)
      // If implicit collapse (no event but logical opposite of expand), the new state should be true (collapsed)
      const newCollapsedState = actionType === 'expand' ? false : true;
      
      console.log(`Path ${normalizedPath}: currently ${currentlyCollapsed ? 'collapsed' : 'expanded'}, 
                  setting to ${newCollapsedState ? 'collapsed' : 'expanded'}`);
      
      if (onToggleCollapse) {
        onToggleCollapse(normalizedPath, newCollapsedState);
      }
      
      // Update debug state if needed
      if (setFoldingDebug) {
        setFoldingDebug({
          timestamp: Date.now(),
          path: normalizedPath,
          lastOperation: actionType,
          isCollapsed: newCollapsedState,
          previousState: currentlyCollapsed
        });
      }
    };
    
    // We'll use onExpand event and infer onCollapse by tracking state
    const onExpand = (node: any) => {
      onToggleNode(node, 'expand');
    };
    
    return { 
      onExpand
      // Note: We don't need a separate onCollapse handler anymore
    };
  }, [getPathState, normalizePath, onToggleCollapse, setFoldingDebug]);

  return {
    createEditorEventHandlers,
    getPathState,
    collapsedPathsRef
  };
};
