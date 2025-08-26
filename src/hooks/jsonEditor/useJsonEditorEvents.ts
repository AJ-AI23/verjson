
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
    const valueInRef = collapsedPathsRef.current[normalizedPath];
    const currentState = valueInRef !== undefined ? valueInRef : true; // Default to collapsed if not specified
    
    return currentState;
  }, [normalizePath, collapsedPathsRef]);

  // Initialize bulk expand/collapse functionality
  const { bulkExpand } = useBulkExpandCollapse({
    onToggleCollapse,
    maxDepth
  });
  console.log('[DEBUG] useJsonEditorEvents received maxDepth:', maxDepth);

  // Create event handlers for JSONEditor
  const createEditorEventHandlers = useCallback(() => {
    console.log('Creating JSONEditor event handlers with toggle logic');
    
    // Handle expand event from JSONEditor - we use this to toggle the collapsed state
    const onExpand = (node: any) => {
      const path = node.path.length > 0 ? node.path.join('.') : 'root';
      const normalizedPath = normalizePath(path);
      
      console.log(`[DEBUG] onExpand called for path: ${normalizedPath}`);
      console.log(`[DEBUG] Current maxDepth: ${maxDepth}`);
      console.log(`[DEBUG] rootSchema available:`, !!rootSchema);
      
      // Force update the ref to latest state before reading
      collapsedPathsRef.current = { ...collapsedPaths };
      
      // Get the current state (default to true/collapsed if not set)
      const currentlyCollapsed = getPathState(normalizedPath);
      
      // Toggle the state - inverse of current state
      // If current state is true (collapsed), new state is false (expanded)
      // If current state is false (expanded), new state is true (collapsed)
      const newCollapsedState = !currentlyCollapsed;
      
      console.log(`[DEBUG] Path ${normalizedPath}: currently ${currentlyCollapsed ? 'collapsed' : 'expanded'}, 
                  toggling to ${newCollapsedState ? 'collapsed' : 'expanded'}`);
      
      if (onToggleCollapse) {
        onToggleCollapse(normalizedPath, newCollapsedState);
        
        // If we're expanding a node and have rootSchema, perform bulk expand
        // But only if it's not the root level (to prevent expanding all top-level properties)
        if (!newCollapsedState && rootSchema && normalizedPath !== 'root') {
          console.log(`[DEBUG] Triggering bulk expand for path: ${normalizedPath} with maxDepth: ${maxDepth}`);
          console.log(`[DEBUG] Root schema available:`, !!rootSchema);
          console.log(`[DEBUG] Editor ref available:`, !!editorRef?.current);
          
          // Remove setTimeout and call immediately
          bulkExpand(normalizedPath, rootSchema, true, editorRef, collapsedPathsRef);
        } else {
          console.log(`[DEBUG] Not triggering bulk expand - newCollapsedState: ${newCollapsedState}, rootSchema: ${!!rootSchema}, path: ${normalizedPath}`);
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
  }, [getPathState, normalizePath, onToggleCollapse, setFoldingDebug, editorRef, bulkExpand, rootSchema, maxDepth, collapsedPaths]);

  return {
    createEditorEventHandlers,
    getPathState,
    collapsedPathsRef
  };
};
