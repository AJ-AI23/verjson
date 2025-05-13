
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
  // Additional effect to apply collapsedPaths changes to the editor
  useEffect(() => {
    // Skip during initial setup
    if (!editorRef.current || !initialSetupDone.current) return;
    
    try {
      const editor = editorRef.current;
      
      if (editor && editor.node) {
        // Handle root node's collapsed state
        if (collapsedPaths.root !== undefined) {
          if (collapsedPaths.root === true && !editor.node.collapsed) {
            editor.collapseAll();
          } else if (collapsedPaths.root === false && editor.node.collapsed) {
            editor.expandAll();
          }
        }
      }
    } catch (e) {
      console.error('Error applying collapsed paths to editor:', e);
    }
  }, [collapsedPaths]);
};
