import { useCallback, useRef } from 'react';
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
    console.log('Expanding all nodes');
    if (!editorRef.current) return;
    
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
    console.log('Collapsing all nodes');
    if (!editorRef.current) return;
    
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
    console.log('Expanding first level nodes');
    if (!editorRef.current) return;
    
    try {
      // First collapse all
      editorRef.current.collapseAll();
      
      // Then expand root node
      const rootNode = editorRef.current.node.childs?.[0];
      if (rootNode) {
        rootNode.expand(false);
        console.log('Expanded root node');
        
        // Notify about root expansion
        if (onToggleCollapse) {
          onToggleCollapse('root', false);
        }
      }
    } catch (err) {
      console.error('Error expanding first level:', err);
    }
  }, [editorRef, onToggleCollapse]);

  return {
    expandAll,
    collapseAll,
    expandFirstLevel,
    collapsedPathsRef
  };
};
