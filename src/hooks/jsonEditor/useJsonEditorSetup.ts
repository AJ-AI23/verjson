
import { useEffect, useRef } from 'react';
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';

interface UseJsonEditorSetupProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths: CollapsedState;
  expandFirstLevel: () => void;
}

export const useJsonEditorSetup = ({
  editorRef,
  onToggleCollapse,
  collapsedPaths,
  expandFirstLevel
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

  // Effect to handle initial folding state after initialization
  useEffect(() => {
    if (editorRef.current && !initialSetupDone.current) {
      console.log("Running initial folding setup...");
      console.log("Initial collapsedPaths:", collapsedPathsRef.current);
      
      // Make sure we have the root state set properly first
      if (onToggleCollapse && collapsedPathsRef.current['root'] === undefined) {
        console.log("Setting initial root state to collapsed");
        onToggleCollapse('root', true);
        // Update our local reference as well
        collapsedPathsRef.current = { ...collapsedPathsRef.current, root: true };
      }
      
      // Wait a moment for the editor to fully initialize
      const timer = setTimeout(() => {
        // Perform expandFirstLevel which will:
        // 1. Collapse all nodes
        // 2. Then expand just the root node
        console.log("Performing initial expand first level");
        expandFirstLevel();
        
        // Mark initial setup as done
        initialSetupDone.current = true;
        
        console.log('Initial folding setup completed with state:', collapsedPathsRef.current);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [editorRef.current, onToggleCollapse, expandFirstLevel]);

  return {
    initialSetupDone,
    collapsedPathsRef
  };
};
