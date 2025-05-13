
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
    
    // This effect monitors collapsedPaths changes and applies them to the editor
    console.log('collapsedPaths changed, applying to editor:', collapsedPaths);
    
    try {
      const editor = editorRef.current;
      
      if (editor) {
        // First, get a list of currently expanded nodes
        const expandedNodes: string[] = [];
        const collapsedNodes: string[] = [];
        
        // Categorize nodes based on our state
        Object.entries(collapsedPaths).forEach(([path, isCollapsed]) => {
          if (isCollapsed) {
            collapsedNodes.push(path);
          } else {
            expandedNodes.push(path);
          }
        });
        
        console.log('Will apply the following state to editor:');
        console.log('- Expanded nodes:', expandedNodes);
        console.log('- Collapsed nodes:', collapsedNodes);
        
        // Try to navigate to and toggle nodes that are in the incorrect state
        if (editor.node) {
          // When root itself is toggled
          if (collapsedPaths.root !== undefined) {
            if (collapsedPaths.root === false && editor.node.collapsed) {
              console.log('Expanding root node in editor');
              editor.node.expand();
            } else if (collapsedPaths.root === true && !editor.node.collapsed) {
              console.log('Collapsing root node in editor');
              editor.node.collapse();
            }
          }
        }
      }
    } catch (e) {
      console.error('Error applying collapsed paths to editor:', e);
    }
  }, [collapsedPaths]);
};
