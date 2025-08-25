
import { useRef, useCallback, useEffect } from 'react';
import { CollapsedState } from '@/lib/diagram/types';
import { useBulkExpandCollapse } from './useBulkExpandCollapse';

interface UseJsonEditorEventsProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths: CollapsedState;
  editorRef?: React.MutableRefObject<any>;
  maxDepth: number,
  rootSchema?: any; // Schema for bulk expand operations
}

export const useJsonEditorEvents = ({
  onToggleCollapse,
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
    
    // Handle expand event from JSONEditor - we use this to toggle the collapsed state
    const onExpand = ({ path, isExpand, recursive }) => {
      const pathString = path.length > 0 ? path.join('.') : 'root';
      const normalizedPath = normalizePath(pathString);
      
      // Use the isExpand parameter from JSONEditor instead of toggling
      // isExpand = true means the node is being expanded
      // isExpand = false means the node is being collapsed
      const newCollapsedState = !isExpand; // collapsed state is inverse of isExpand
      
      if (onToggleCollapse) {
        onToggleCollapse(normalizedPath, newCollapsedState);
        
        // If we're expanding a node and have rootSchema, perform bulk expand
        if (isExpand && rootSchema) {
          // Remove setTimeout and call immediately
          bulkExpand(normalizedPath, rootSchema, true, editorRef, collapsedPathsRef);
        }
      }
      
      // If we have access to the editor, apply the change directly to the specific node
      if (editorRef && editorRef.current) {
        try {
          // Convert the path back to an array for the expand method
          const pathArray = Array.isArray(path) ? path : pathString.split('.');
          
          // Use the expand method with the correct parameters:
          // - pathArray: The path to the node
          // - !newCollapsedState: true for expand, false for collapse
          // - false: Don't do this recursively
          editorRef.current.expand({
            path: pathArray,
            isExpand: !newCollapsedState,
            recursive: false
          });
        } catch (err) {
          console.error('Error synchronizing editor node state:', err);
        }
      }
    };
    
    return { 
      onExpand
    };
  }, [getPathState, normalizePath, onToggleCollapse, editorRef, bulkExpand, rootSchema, maxDepth]);

  return {
    createEditorEventHandlers,
    getPathState,
    collapsedPathsRef
  };
};
