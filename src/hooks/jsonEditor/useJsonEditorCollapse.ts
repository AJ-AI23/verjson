
import { useEffect } from 'react';
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';

interface UseJsonEditorCollapseProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  initialSetupDone: React.MutableRefObject<boolean>;
  collapsedPaths: CollapsedState;
}

export const useJsonEditorCollapse = ({
  editorRef,
  initialSetupDone,
  collapsedPaths
}: UseJsonEditorCollapseProps) => {
  // Effect to apply collapsedPaths changes to the editor
  useEffect(() => {
    // Skip during initial setup
    if (!editorRef.current || !initialSetupDone.current) return;
    
    try {
      const editor = editorRef.current;
      
      if (editor && editor.node) {
        console.log('Applying collapsed paths to editor', collapsedPaths);
        
        // Handle root node's collapsed state
        if (collapsedPaths.root !== undefined) {
          if (collapsedPaths.root === true && !editor.node.collapsed) {
            console.log('Collapsing root node based on collapsedPaths');
            editor.collapseAll();
          } else if (collapsedPaths.root === false && editor.node.collapsed) {
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
  }, [collapsedPaths, editorRef, initialSetupDone]);
};
