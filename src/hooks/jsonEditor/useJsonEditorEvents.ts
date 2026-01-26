
import { useRef, useCallback, useEffect } from 'react';
import { CollapsedState } from '@/lib/diagram/types';
import { FoldingDebugInfo } from './types';
import { useBulkExpandCollapse } from './useBulkExpandCollapse';

interface UseJsonEditorEventsProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  setFoldingDebug?: (info: FoldingDebugInfo | null) => void;
  collapsedPaths: CollapsedState;
  editorRef?: React.MutableRefObject<any>;
  maxDepth: number,
  rootSchema?: any; // Schema for bulk expand operations
}

export const useJsonEditorEvents = ({
  onToggleCollapse,
  setFoldingDebug,
  collapsedPaths = {},
  editorRef,
  maxDepth,
  rootSchema
}: UseJsonEditorEventsProps) => {
  // Keep a reference to the latest collapsedPaths
  const collapsedPathsRef = useRef<Record<string, boolean>>(collapsedPaths);
  
  // Update ref when props change - throttled to prevent excessive updates
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      collapsedPathsRef.current = { ...collapsedPaths };
    }, 100); // 100ms throttle
    
    return () => clearTimeout(timeoutId);
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
    const valueInRef = collapsedPathsRef.current[normalizedPath];
    const currentState = valueInRef !== undefined ? valueInRef : true; // Default to collapsed if not specified
    
    return currentState;
  }, [normalizePath, collapsedPathsRef]);

  // Initialize bulk expand/collapse functionality
  const { bulkExpand } = useBulkExpandCollapse({
    onToggleCollapse,
    maxDepth
  });

  // Create event handlers for JSONEditor
  const createEditorEventHandlers = useCallback(() => {
    // Handle expand event from JSONEditor - we use this to toggle the collapsed state
    const onExpand = (node: any) => {
      const path = node.path.length > 0 ? node.path.join('.') : 'root';
      const normalizedPath = normalizePath(path);
      
      // Force update the ref to latest state before reading
      collapsedPathsRef.current = { ...collapsedPaths };
      
      // Get the current state (default to true/collapsed if not set)
      const currentlyCollapsed = getPathState(normalizedPath);
      
      // Toggle the state - inverse of current state
      // If current state is true (collapsed), new state is false (expanded)
      // If current state is false (expanded), new state is true (collapsed)
      const newCollapsedState = !currentlyCollapsed;
      
      if (onToggleCollapse) {
        onToggleCollapse(normalizedPath, newCollapsedState);
        
        // If we're expanding a node and have rootSchema, perform bulk expand
        // Only allow bulk expansion for specific paths, not root or very shallow paths
        const shouldBulkExpand = !newCollapsedState && rootSchema && 
          normalizedPath !== 'root' && 
          (normalizedPath.includes('.') && normalizedPath.split('.').length >= 2);
          
        if (shouldBulkExpand) {
          // Throttle bulk expand operations
          setTimeout(() => {
            bulkExpand(normalizedPath, rootSchema, true, editorRef, collapsedPathsRef);
          }, 50);
        }
      }
      
      // Update debug state if needed
      if (setFoldingDebug) {
        setFoldingDebug({
          timestamp: Date.now(),
          path: normalizedPath,
          lastOperation: newCollapsedState ? 'collapse' : 'expand',
          isCollapsed: newCollapsedState,
          previousState: currentlyCollapsed
        });
      }
      
      // If we have access to the editor, apply the change directly to the specific node
      if (editorRef && editorRef.current) {
        try {
          // Throttle editor synchronization to prevent excessive calls
          setTimeout(() => {
            if (!editorRef.current) return;
            
            const pathArray = Array.isArray(node.path) ? node.path : path.split('.');
            editorRef.current.expand({
              path: pathArray,
              isExpand: !newCollapsedState,
              recursive: false
            });
          }, 25);
        } catch (err) {
          console.error('Error synchronizing editor node state:', err);
        }
      }
    };
    
    return { 
      onExpand
    };
  }, [getPathState, normalizePath, onToggleCollapse, setFoldingDebug, editorRef, bulkExpand, rootSchema, maxDepth, collapsedPaths]);

  return {
    createEditorEventHandlers,
    getPathState,
    collapsedPathsRef
  };
};
