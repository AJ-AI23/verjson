
import { useRef, useCallback, useEffect } from 'react';
import { CollapsedState } from '@/lib/diagram/types';
import { FoldingDebugInfo } from './types';
import { useBulkExpandCollapse } from './useBulkExpandCollapse';
import { useDebug } from '@/contexts/DebugContext';

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
  const { debugToast } = useDebug();
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
    // Default to expanded (false) if not specified, so diagram shows child nodes
    const currentState = valueInRef !== undefined ? valueInRef : false;
    
    return currentState;
  }, [normalizePath, collapsedPathsRef]);

  // Initialize bulk expand/collapse functionality
  const { bulkExpand } = useBulkExpandCollapse({
    onToggleCollapse,
    maxDepth
  });
  // Remove debug toast that runs on every initialization

  // Create event handlers for JSONEditor
  const createEditorEventHandlers = useCallback(() => {
    // Remove debug toast that runs frequently
    
    // Handle expand event from JSONEditor - read the actual node state
    const onExpand = (node: any) => {
      const path = node.path.length > 0 ? node.path.join('.') : 'root';
      const normalizedPath = normalizePath(path);
      
      // Read the actual collapsed state from the JSONEditor node
      // JSONEditor sets node.collapsed to true when collapsed, false when expanded
      const actualCollapsedState = node.collapsed === true;
      
      console.log(`🔧 JSONEditor onExpand event: ${normalizedPath}`);
      console.log(`🔧 Node actual state: ${actualCollapsedState ? 'collapsed' : 'expanded'}`);
      
      if (onToggleCollapse) {
        onToggleCollapse(normalizedPath, actualCollapsedState);
      }
      
      // Update debug state if needed
      if (setFoldingDebug) {
        setFoldingDebug({
          timestamp: Date.now(),
          path: normalizedPath,
          lastOperation: actualCollapsedState ? 'collapse' : 'expand',
          isCollapsed: actualCollapsedState,
          previousState: !actualCollapsedState // Previous state was opposite
        });
      }
      
      // Remove the manual editor sync that fights with user actions
      // Let React handle the state updates through normal flow
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
