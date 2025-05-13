import { useRef, useCallback } from 'react';
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
  if (collapsedPaths !== collapsedPathsRef.current) {
    collapsedPathsRef.current = collapsedPaths;
    console.log('Updated collapsedPathsRef in useJsonEditorEvents:', collapsedPathsRef.current);
  }
  
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
    
    // Strip any array indices from the path
    const cleanPath = normalizedPath.replace(/\[\d+\]/g, '');
    console.log('Normalized path:', path, '→', cleanPath);
    return cleanPath;
  }, []);

  // Helper to get the current state of a path
  const getPathState = useCallback((path: string): boolean => {
    const normalizedPath = normalizePath(path);
    const currentState = collapsedPathsRef.current[normalizedPath] !== undefined ? 
      collapsedPathsRef.current[normalizedPath] : 
      true; // Default to collapsed if not specified
    
    return currentState;
  }, [normalizePath]);

  // Create event handlers for JSONEditor
  const createEditorEventHandlers = useCallback(() => {
    console.log('Creating JSONEditor event handlers');
    
    // Function to track folding changes
    const onFoldChange = (path: string, isCollapsed: boolean) => {
      console.log(`onFoldChange called: path=${path}, isCollapsed=${isCollapsed}`);
      
      // For direct paths, make sure we have a consistent format
      if (!path || path === '') {
        path = 'root';
      }
      
      const normalizedPath = normalizePath(path);
      const trackedState = getPathState(normalizedPath);
      
      console.log(`Fold change event - path: ${normalizedPath}, new state: ${isCollapsed ? 'collapsed' : 'expanded'}`);
      
      // If the state has changed, notify the parent component
      if (onToggleCollapse) {
        onToggleCollapse(normalizedPath, isCollapsed);
      }
      
      // Update debug state if needed
      if (setFoldingDebug) {
        setFoldingDebug({
          timestamp: Date.now(),
          path: normalizedPath,
          lastOperation: isCollapsed ? 'collapse' : 'expand',
          isCollapsed,
          previousState: trackedState
        });
      }
    };
    
    return { 
      onExpand: (node: any) => {
        // Get path from node
        const path = node.path.length > 0 ? node.path.join('.') : 'root';
        onFoldChange(path, false);
      },
      
      onCollapse: (node: any) => {
        // Get path from node
        const path = node.path.length > 0 ? node.path.join('.') : 'root';
        onFoldChange(path, true);
      },
      
      onFoldChange
    };
  }, [getPathState, normalizePath, onToggleCollapse, setFoldingDebug]);

  return {
    createEditorEventHandlers,
    getPathState
  };
};
