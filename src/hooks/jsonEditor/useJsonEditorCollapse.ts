
import { useEffect } from 'react';
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';

interface UseJsonEditorCollapseProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  initialSetupDone: React.MutableRefObject<boolean>;
  collapsedPaths: CollapsedState;
  masterCollapsedPathsRef?: React.MutableRefObject<Record<string, boolean>>;
}

export const useJsonEditorCollapse = ({
  editorRef,
  initialSetupDone,
  collapsedPaths,
  masterCollapsedPathsRef
}: UseJsonEditorCollapseProps) => {
  // Effect to apply collapsedPaths changes to the editor
  useEffect(() => {
    // Skip during initial setup
    if (!editorRef.current || !initialSetupDone.current) return;
    
    try {
      const editor = editorRef.current;
      const pathsToUse = masterCollapsedPathsRef?.current || collapsedPaths;
      
      if (editor && editor.node) {
        console.log('Applying collapsed paths to editor', pathsToUse);
        
        // Handle root node's collapsed state
        if (pathsToUse.root !== undefined) {
          if (pathsToUse.root === true && !editor.node.collapsed) {
            console.log('Collapsing root node based on collapsedPaths');
            editor.collapseAll();
          } else if (pathsToUse.root === false && editor.node.collapsed) {
            console.log('Expanding root node based on collapsedPaths');
            editor.expandAll();
          }
        }
        
        // Attempt to apply other path collapses
        // This requires the editor to support path-based expansion/collapse
        // If available, we'd iterate through collapsedPaths and apply each state
      }
    } catch (e) {
      console.error('Error applying collapsed paths to editor:', e);
    }
  }, [collapsedPaths, editorRef, initialSetupDone, masterCollapsedPathsRef]);
};
