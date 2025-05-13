
import { useEffect, useRef } from 'react';
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';

interface UseJsonEditorSetupProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths: CollapsedState;
  expandFirstLevel: () => void;
  maxDepth?: number; // Add maxDepth parameter
}

export const useJsonEditorSetup = ({
  editorRef,
  onToggleCollapse,
  collapsedPaths,
  expandFirstLevel,
  maxDepth = 3 // Default to 3 if not provided
}: UseJsonEditorSetupProps) => {
  // Track collapsedPaths in a ref for debugging
  const collapsedPathsRef = useRef<Record<string, boolean>>(collapsedPaths);
  
  // Initial setup done flag
  const initialSetupDone = useRef<boolean>(false);
  
  // Update the ref when collapsedPaths changes
  useEffect(() => {
    collapsedPathsRef.current = { ...collapsedPaths };
    console.log('collapsedPathsRef updated in useJsonEditorSetup:', collapsedPathsRef.current);
  }, [collapsedPaths]);

  // Helper function to determine if a path exceeds the maximum depth
  const pathExceedsMaxDepth = (path: string): boolean => {
    // Count the number of segments (split by dots, excluding 'root')
    const segments = path.split('.');
    // The first segment is 'root', so we exclude it from the count
    // If the segments are > maxDepth + 1, it exceeds the max depth
    return segments.length > maxDepth + 1;
  };

  // Effect to handle initial folding state after initialization
  useEffect(() => {
    if (editorRef.current && !initialSetupDone.current) {
      console.log("Running initial folding setup...");
      console.log("Initial collapsedPaths:", collapsedPathsRef.current);
      console.log("Max depth:", maxDepth);
      
      // Make sure we have the root state set properly first
      if (onToggleCollapse && collapsedPathsRef.current['root'] === undefined) {
        console.log("Setting initial root state to collapsed");
        onToggleCollapse('root', true);
        // Update our local reference as well
        collapsedPathsRef.current = { ...collapsedPathsRef.current, root: true };
      }
      
      // Wait a moment for the editor to fully initialize
      const timer = setTimeout(() => {
        // First, collapse everything to ensure we start from a known state
        if (editorRef.current && editorRef.current.collapseAll) {
          console.log("Collapsing all nodes in editor during initialization");
          editorRef.current.collapseAll();
          
          // Update collapsed paths for all nodes
          if (onToggleCollapse) {
            // We're setting everything to collapsed initially
            console.log("Setting all paths to collapsed in state");
            onToggleCollapse('root', true);
          }
        }
        
        // Mark initial setup as done
        initialSetupDone.current = true;
        console.log('Initial folding setup completed - all properties collapsed');
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [editorRef.current, onToggleCollapse, expandFirstLevel, maxDepth]);

  return {
    initialSetupDone,
    collapsedPathsRef,
    pathExceedsMaxDepth
  };
};
