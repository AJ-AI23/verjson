
import { useEffect, useRef } from 'react';
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';

interface UseJsonEditorSetupProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths: CollapsedState;
  expandFirstLevel: () => void;
  maxDepth?: number;
}

export const useJsonEditorSetup = ({
  editorRef,
  onToggleCollapse,
  collapsedPaths,
  expandFirstLevel,
  maxDepth = 3
}: UseJsonEditorSetupProps) => {
  // Track collapsedPaths in a ref for debugging
  const collapsedPathsRef = useRef<Record<string, boolean>>(collapsedPaths);
  
  // Initial setup done flag
  const initialSetupDone = useRef<boolean>(false);
  
  // Update the ref when collapsedPaths changes
  useEffect(() => {
    collapsedPathsRef.current = { ...collapsedPaths };
    console.log('Updated collapsedPathsRef in useJsonEditorSetup:', collapsedPathsRef.current);
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
      console.log('Setting up initial editor folding state');
      
      // Make sure we have the root state set properly first
      if (onToggleCollapse && collapsedPathsRef.current['root'] === undefined) {
        console.log('Setting initial root collapsed state to true');
        onToggleCollapse('root', true);
        // Update our local reference as well
        collapsedPathsRef.current = { ...collapsedPathsRef.current, root: true };
      }
      
      // Wait a moment for the editor to fully initialize
      const timer = setTimeout(() => {
        // First, collapse everything to ensure we start from a known state
        if (editorRef.current && editorRef.current.collapseAll) {
          editorRef.current.collapseAll();
          console.log('Initially collapsed all nodes');
          
          // After collapsing all, check if root should be expanded
          if (collapsedPathsRef.current['root'] === false) {
            console.log('Root should be expanded according to collapsedPaths');
            expandFirstLevel();
          }
        }
        
        // Mark initial setup as done
        initialSetupDone.current = true;
        console.log('Initial editor setup complete');
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
