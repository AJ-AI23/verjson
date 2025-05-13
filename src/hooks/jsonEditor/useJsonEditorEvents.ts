
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
  // Different parts of the app may use slightly different path formats
  const normalizePath = useCallback((path: string): string => {
    // Strip any array indices from the path for now
    const normalizedPath = path.replace(/\[\d+\]/g, '');
    console.log('Normalized path for diagram:', normalizedPath);
    return normalizedPath;
  }, []);

  // Helper to get the current state of a path (defaults to true if not set)
  const getPathState = useCallback((path: string): boolean => {
    const normalizedPath = normalizePath(path);
    return collapsedPathsRef.current[normalizedPath] !== undefined ? 
      collapsedPathsRef.current[normalizedPath] : 
      true; // Default to collapsed if not specified
  }, [normalizePath]);

  // Create event handlers for JSONEditor
  const createEditorEventHandlers = useCallback(() => {
    // Function to track folding changes
    const onFoldChange = (path: string, isCollapsed: boolean) => {
      // Keep path as is, don't normalize yet
      console.log(`Toggle collapse for path: ${path}`);
      const trackedState = getPathState(path);
      console.log(`Current tracked state: ${trackedState ? 'collapsed' : 'expanded'}`);
      console.log(`Setting new state to: ${isCollapsed ? 'collapsed' : 'expanded'}`);
      
      const normalizedPath = normalizePath(path);
      console.log(`Current collapsedPaths object:`, collapsedPathsRef.current);
      
      // Log fold change event
      const foldEventInfo = {
        path: normalizedPath,
        collapsed: isCollapsed,
        previousState: trackedState
      };
      console.log('Collapse event:', foldEventInfo);
      
      // If the state has changed, notify the parent component
      if (onToggleCollapse && trackedState !== isCollapsed) {
        onToggleCollapse(normalizedPath, isCollapsed);
      }
      
      // Update debug state if needed
      if (setFoldingDebug) {
        setFoldingDebug({
          timestamp: Date.now(),
          path: normalizedPath,
          lastOperation: isCollapsed ? 'collapse' : 'expand', // Add the lastOperation
          isCollapsed,
          previousState: trackedState
        });
      }
    };
    
    return { 
      onFoldChange
    };
  }, [getPathState, normalizePath, onToggleCollapse, setFoldingDebug]);

  return {
    createEditorEventHandlers,
    getPathState
  };
};
