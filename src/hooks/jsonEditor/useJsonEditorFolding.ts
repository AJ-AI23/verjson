
import { useCallback, useRef, useEffect } from 'react';
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';

interface UseJsonEditorFoldingProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths: CollapsedState;
}

export const useJsonEditorFolding = ({
  editorRef,
  onToggleCollapse,
  collapsedPaths = {}
}: UseJsonEditorFoldingProps) => {
  // Keep a reference to the latest collapsedPaths
  const collapsedPathsRef = useRef<Record<string, boolean>>(collapsedPaths);
  
  // Update ref when props change
  if (collapsedPaths !== collapsedPathsRef.current) {
    collapsedPathsRef.current = collapsedPaths;
    console.log('Updated collapsedPathsRef in useJsonEditorFolding:', collapsedPathsRef.current);
  }

  // Debug effect to observe editor state
  useEffect(() => {
    if (editorRef.current && editorRef.current.node) {
      const rootNodeCollapsed = editorRef.current.node.collapsed;
      console.log('Editor root node collapsed state:', rootNodeCollapsed);
      console.log('collapsedPaths root state:', collapsedPaths.root);
      
      // Check if there's a mismatch
      if ((rootNodeCollapsed && collapsedPaths.root === false) || 
          (!rootNodeCollapsed && collapsedPaths.root === true)) {
        console.warn('Mismatch between editor root node collapsed state and our tracked state!');
      }
    }
  }, [editorRef.current, collapsedPaths]);

  // Expand all nodes in the editor
  const expandAll = useCallback(() => {
    console.log('Expand all triggered');
    if (!editorRef.current) {
      console.warn('Cannot expand all: editor ref is null');
      return;
    }
    
    try {
      console.log('Before expandAll - editor root node collapsed:', 
        editorRef.current.node ? editorRef.current.node.collapsed : 'unknown');
      
      editorRef.current.expandAll();
      console.log('expandAll executed on editor');
      
      // Check result
      console.log('After expandAll - editor root node collapsed:', 
        editorRef.current.node ? editorRef.current.node.collapsed : 'unknown');
      
      // If we have a toggle callback, notify about the expansion of root
      if (onToggleCollapse) {
        console.log('Calling onToggleCollapse for root with isCollapsed=false');
        onToggleCollapse('root', false);
      } else {
        console.warn('No onToggleCollapse handler provided for expandAll');
      }
    } catch (err) {
      console.error('Error expanding all nodes:', err);
    }
  }, [editorRef, onToggleCollapse]);

  // Collapse all nodes in the editor
  const collapseAll = useCallback(() => {
    console.log('Collapse all triggered');
    if (!editorRef.current) {
      console.warn('Cannot collapse all: editor ref is null');
      return;
    }
    
    try {
      console.log('Before collapseAll - editor root node collapsed:', 
        editorRef.current.node ? editorRef.current.node.collapsed : 'unknown');
        
      editorRef.current.collapseAll();
      console.log('collapseAll executed on editor');
      
      // Check result
      console.log('After collapseAll - editor root node collapsed:', 
        editorRef.current.node ? editorRef.current.node.collapsed : 'unknown');
      
      // If we have a toggle callback, notify about the collapse of root
      if (onToggleCollapse) {
        console.log('Calling onToggleCollapse for root with isCollapsed=true');
        onToggleCollapse('root', true);
      } else {
        console.warn('No onToggleCollapse handler provided for collapseAll');
      }
    } catch (err) {
      console.error('Error collapsing all nodes:', err);
    }
  }, [editorRef, onToggleCollapse]);

  // Expand only the first level nodes
  const expandFirstLevel = useCallback(() => {
    console.log('Expand first level nodes triggered');
    if (!editorRef.current) {
      console.warn('Cannot expand first level: editor ref is null');
      return;
    }
    
    try {
      // First collapse all
      console.log('First collapsing all nodes');
      editorRef.current.collapseAll();
      
      // Then expand root node
      const rootNode = editorRef.current.node;
      if (rootNode) {
        console.log('Root node found, expanding');
        rootNode.expand(false);
        
        // Verify expansion worked
        console.log('Root node collapsed after expand:', rootNode.collapsed);
        
        // Notify about root expansion
        if (onToggleCollapse) {
          console.log('Calling onToggleCollapse for root with isCollapsed=false');
          onToggleCollapse('root', false);
        } else {
          console.warn('No onToggleCollapse handler provided for expandFirstLevel');
        }
      } else {
        console.warn('No root node found when trying to expand first level');
      }
    } catch (err) {
      console.error('Error expanding first level:', err);
    }
  }, [editorRef, onToggleCollapse]);
  
  // Force update the editor's collapsed state based on our collapsedPaths
  const forceUpdateEditorFoldState = useCallback(() => {
    console.log('Forcing update of editor fold state from collapsedPaths');
    if (!editorRef.current || !editorRef.current.node) {
      console.warn('Cannot force update: editor ref or node is null');
      return;
    }

    try {
      const rootCollapsed = collapsedPaths.root === true;
      const editorRootCollapsed = editorRef.current.node.collapsed;
      
      if (rootCollapsed !== editorRootCollapsed) {
        console.log(`Mismatch detected: collapsedPaths.root=${rootCollapsed}, editor root collapsed=${editorRootCollapsed}`);
        
        if (rootCollapsed) {
          console.log('Collapsing editor root node');
          editorRef.current.node.collapse();
        } else {
          console.log('Expanding editor root node');
          editorRef.current.node.expand();
        }
      } else {
        console.log('Editor root node collapsed state already matches our state');
      }
    } catch (err) {
      console.error('Error forcing update of editor fold state:', err);
    }
  }, [editorRef, collapsedPaths]);

  return {
    expandAll,
    collapseAll,
    expandFirstLevel,
    forceUpdateEditorFoldState,
    collapsedPathsRef
  };
};
