
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
  // Effect to apply collapsedPaths changes to the editor - throttled
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Skip during initial setup
      if (!editorRef.current || !initialSetupDone.current) return;
      
      try {
        const editor = editorRef.current;
        const pathsToUse = masterCollapsedPathsRef?.current || collapsedPaths;
        
        if (editor && editor.node) {
          // Handle root node's collapsed state only
          if (pathsToUse.root !== undefined) {
            if (pathsToUse.root === true && !editor.node.collapsed) {
              editor.collapseAll();
            } else if (pathsToUse.root === false && editor.node.collapsed) {
              editor.expandAll();
            }
          }
        }
      } catch (e) {
        console.error('Error applying collapsed paths to editor:', e);
      }
    }, 150); // 150ms throttle
    
    return () => clearTimeout(timeoutId);
  }, [collapsedPaths, editorRef, initialSetupDone, masterCollapsedPathsRef]);
};
