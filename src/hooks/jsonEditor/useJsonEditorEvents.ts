
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
    console.log('Normalizing path:', path);
    
    // If path is empty, return 'root'
    if (!path || path === '') {
      console.log('Empty path normalized to "root"');
      return 'root';
    }
    
    // If path doesn't start with 'root', prepend it
    const normalizedPath = path.startsWith('root') ? path : `root.${path}`;
    
    // Strip any array indices from the path for now
    const cleanPath = normalizedPath.replace(/\[\d+\]/g, '');
    console.log('Normalized path for diagram:', cleanPath);
    return cleanPath;
  }, []);

  // Helper to get the current state of a path (defaults to true if not set)
  const getPathState = useCallback((path: string): boolean => {
    const normalizedPath = normalizePath(path);
    const currentState = collapsedPathsRef.current[normalizedPath] !== undefined ? 
      collapsedPathsRef.current[normalizedPath] : 
      true; // Default to collapsed if not specified
    
    console.log(`Getting path state for ${path} (normalized: ${normalizedPath}): ${currentState ? 'collapsed' : 'expanded'}`);
    return currentState;
  }, [normalizePath]);

  // Create event handlers for JSONEditor
  const createEditorEventHandlers = useCallback(() => {
    console.log('Creating JSONEditor event handlers');
    
    // Function to track folding changes
    const onFoldChange = (path: string, isCollapsed: boolean) => {
      console.log(`onFoldChange called with: path=${path}, isCollapsed=${isCollapsed}`);
      
      // For direct paths, make sure we have a consistent format
      if (!path || path === '') {
        path = 'root';
        console.log('Empty path converted to "root"');
      }
      
      const normalizedPath = normalizePath(path);
      const trackedState = getPathState(normalizedPath);
      
      console.log(`Toggle collapse for path: ${path} to ${isCollapsed ? 'collapsed' : 'expanded'}`);
      console.log(`Normalized path: ${normalizedPath}`);
      console.log(`Current tracked state: ${trackedState ? 'collapsed' : 'expanded'}`);
      console.log(`Setting new state to: ${isCollapsed ? 'collapsed' : 'expanded'}`);
      
      // Log fold change event
      const foldEventInfo = {
        path: normalizedPath,
        isCollapsed,
        previousState: trackedState
      };
      console.log('Collapse event:', foldEventInfo);
      
      // If the state has changed, notify the parent component
      if (onToggleCollapse) {
        console.log(`Calling onToggleCollapse with path: ${normalizedPath}, isCollapsed: ${isCollapsed}`);
        onToggleCollapse(normalizedPath, isCollapsed);
      } else {
        console.warn('No onToggleCollapse handler provided');
      }
      
      // Update debug state if needed
      if (setFoldingDebug) {
        console.log('Updating folding debug info');
        setFoldingDebug({
          timestamp: Date.now(),
          path: normalizedPath,
          lastOperation: isCollapsed ? 'collapse' : 'expand',
          isCollapsed,
          previousState: trackedState
        });
      } else {
        console.warn('No setFoldingDebug handler provided');
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
