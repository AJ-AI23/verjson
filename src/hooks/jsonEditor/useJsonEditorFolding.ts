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

  // Expand all nodes in the editor
  const expandAll = useCallback(() => {
    console.log('Expand all triggered');
    if (!editorRef.current) {
      console.warn('Cannot expand all: editor ref is null');
      return;
    }
    
    try {
      editorRef.current.expandAll();
      console.log('expandAll executed on editor');
      
      // If we have a toggle callback, notify about the expansion of root
      if (onToggleCollapse) {
        console.log('Calling onToggleCollapse for root with isCollapsed=false');
        onToggleCollapse('root', false);
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
      editorRef.current.collapseAll();
      console.log('collapseAll executed on editor');
      
      // If we have a toggle callback, notify about the collapse of root
      if (onToggleCollapse) {
        console.log('Calling onToggleCollapse for root with isCollapsed=true');
        onToggleCollapse('root', true);
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
        
        // Notify about root expansion
        if (onToggleCollapse) {
          console.log('Calling onToggleCollapse for root with isCollapsed=false');
          onToggleCollapse('root', false);
        }
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
      if (editorRef.current.node) {
        const editorRootCollapsed = editorRef.current.node.collapsed;
        
        console.log(`Root collapsed state - our state: ${rootCollapsed}, editor state: ${editorRootCollapsed}`);
        
        if (rootCollapsed !== editorRootCollapsed) {
          if (rootCollapsed) {
            console.log('Collapsing editor root node');
            editorRef.current.node.collapse();
          } else {
            console.log('Expanding editor root node');
            editorRef.current.node.expand();
          }
        }
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
