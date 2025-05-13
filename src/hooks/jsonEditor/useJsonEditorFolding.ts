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
  }

  // Expand all nodes in the editor
  const expandAll = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    
    try {
      editorRef.current.expandAll();
      
      // If we have a toggle callback, notify about the expansion of root
      if (onToggleCollapse) {
        onToggleCollapse('root', false);
      }
    } catch (err) {
      console.error('Error expanding all nodes:', err);
    }
  }, [editorRef, onToggleCollapse]);

  // Collapse all nodes in the editor
  const collapseAll = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    
    try {
      editorRef.current.collapseAll();
      
      // If we have a toggle callback, notify about the collapse of root
      if (onToggleCollapse) {
        onToggleCollapse('root', true);
      }
    } catch (err) {
      console.error('Error collapsing all nodes:', err);
    }
  }, [editorRef, onToggleCollapse]);

  // Expand only the first level nodes
  const expandFirstLevel = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    
    try {
      // First collapse all
      editorRef.current.collapseAll();
      
      // Then expand root node
      const rootNode = editorRef.current.node;
      if (rootNode) {
        rootNode.expand(false);
        
        // Notify about root expansion
        if (onToggleCollapse) {
          onToggleCollapse('root', false);
        }
      }
    } catch (err) {
      console.error('Error expanding first level:', err);
    }
  }, [editorRef, onToggleCollapse]);
  
  // Force update the editor's collapsed state based on our collapsedPaths
  const forceUpdateEditorFoldState = useCallback(() => {
    if (!editorRef.current || !editorRef.current.node) {
      return;
    }

    try {
      const rootCollapsed = collapsedPaths.root === true;
      if (editorRef.current.node) {
        const editorRootCollapsed = editorRef.current.node.collapsed;
        
        if (rootCollapsed !== editorRootCollapsed) {
          if (rootCollapsed) {
            editorRef.current.node.collapse();
          } else {
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
