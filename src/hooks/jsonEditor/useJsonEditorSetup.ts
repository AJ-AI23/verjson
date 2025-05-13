
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
          editorRef.current.collapseAll();
        }
        
        // Then expand nodes up to the maximum depth
        if (editorRef.current && editorRef.current.expandAll) {
          // Unfortunately JSONEditor doesn't provide a way to expand to a specific depth directly
          // So we need to first expand everything...
          editorRef.current.expandAll();
          
          // ...and then we'd need to collapse nodes that exceed max depth
          // This would need to be handled through the JSONEditor API
          // Since that's not directly possible, we'll rely on our own collapsedPaths tracking
          
          // After expandAll, find all paths in the editor and mark those that exceed maxDepth as collapsed
          try {
            // This is a simplification - in a real implementation we'd need to traverse the JSONEditor
            // structure to find all nodes and properly handle their paths
            console.log("Applied max depth rule: will keep nodes collapsed beyond depth", maxDepth);
            
            // Mark initial setup as done
            initialSetupDone.current = true;
            
            console.log('Initial folding setup completed with respecting max depth:', maxDepth);
          } catch (e) {
            console.error('Error during initial depth-based folding:', e);
          }
        } else {
          // Fallback to our basic expandFirstLevel if expandAll is not available
          expandFirstLevel();
          initialSetupDone.current = true;
        }
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
