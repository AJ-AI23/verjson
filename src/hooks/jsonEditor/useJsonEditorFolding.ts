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
  useEffect(() => {
    collapsedPathsRef.current = { ...collapsedPaths };
    console.log('Updated collapsedPathsRef in useJsonEditorFolding:', collapsedPathsRef.current);
  }, [collapsedPaths]);

  // Expand all nodes in the editor
  const expandAll = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    
    try {
      // Instead of using expandAll(), we use the expand method with recursive=true
      editorRef.current.expand({
        path: [],  // Empty path for root
        isExpand: true,
        recursive: true
      });
      
      // If we have a toggle callback, notify about the expansion of root
      if (onToggleCollapse) {
        onToggleCollapse('root', false);
      }
      
      console.log('Expanded all nodes using expand() with recursive=true');
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
      // Instead of using collapseAll(), use expand method with isExpand=false and recursive=true
      editorRef.current.expand({
        path: [],  // Empty path for root
        isExpand: false,
        recursive: true
      });
      
      // If we have a toggle callback, notify about the collapse of root
      if (onToggleCollapse) {
        onToggleCollapse('root', true);
      }
      
      console.log('Collapsed all nodes using expand() with isExpand=false, recursive=true');
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
      editorRef.current.expand({
        path: [],
        isExpand: false,
        recursive: true
      });
      
      // Then expand root node only (without recursion)
      editorRef.current.expand({
        path: [],
        isExpand: true,
        recursive: false
      });
      
      // Notify about root expansion
      if (onToggleCollapse) {
        onToggleCollapse('root', false);
      }
      
      console.log('Expanded first level nodes using targeted expand() calls');
    } catch (err) {
      console.error('Error expanding first level:', err);
    }
  }, [editorRef, onToggleCollapse]);
  
  // Force update the editor's collapsed state based on our collapsedPaths
  const forceUpdateEditorFoldState = useCallback(() => {
    if (!editorRef.current) {
      return;
    }

    try {
      const rootCollapsed = collapsedPaths.root === true;
      
      // Use the expand method for the root node
      editorRef.current.expand({
        path: [],
        isExpand: !rootCollapsed,
        recursive: false
      });
      
      console.log(`Force updated root node to ${rootCollapsed ? 'collapsed' : 'expanded'}`);
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
