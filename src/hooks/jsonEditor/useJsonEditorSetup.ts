
import { useEffect, useRef } from 'react';
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';

interface UseJsonEditorSetupProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths: CollapsedState;
  maxDepth: number;
}

export const useJsonEditorSetup = ({
  editorRef,
  onToggleCollapse,
  collapsedPaths,
  maxDepth
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
      
      // Wait a moment for the editor to fully initialize
      const timer = setTimeout(() => {
        if (!editorRef.current) return;
        
        // Check if root is defined and apply initial state
        if (collapsedPaths.root !== undefined) {
          if (collapsedPaths.root === true) {
            console.log('Initially collapsing all nodes');
            editorRef.current.collapseAll();
          } else {
            console.log('Initially expanding first level');
            // Inline expandFirstLevel logic to maintain exact same behavior
            try {
              // First collapse all
              editorRef.current.expand({
                path: [],
                isExpand: false,
                recursive: true
              });
              
              // Then expand root node only (without recursion)
              editorRef.current.expand({
                path: [],
                isExpand: true,
                recursive: false
              });
              
              // Notify about root expansion
              if (onToggleCollapse) {
                onToggleCollapse('root', false);
              }
              
              console.log('Expanded first level nodes using targeted expand() calls');
            } catch (err) {
              console.error('Error expanding first level:', err);
            }
          }
        } else if (onToggleCollapse) {
          // If root state isn't defined, default to collapsed
          console.log('Setting initial root collapsed state to true');
          onToggleCollapse('root', true);
          // Collapse all nodes in the editor
          editorRef.current.collapseAll();
        }
        
        // Mark initial setup as done
        initialSetupDone.current = true;
        console.log('Initial editor setup complete');
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [editorRef.current, onToggleCollapse, collapsedPaths.root]);

  return {
    initialSetupDone,
    collapsedPathsRef,
    pathExceedsMaxDepth
  };
};
