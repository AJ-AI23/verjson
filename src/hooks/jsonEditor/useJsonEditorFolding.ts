import { useRef } from 'react';
import JSONEditor from 'jsoneditor';
import { toast } from 'sonner';

interface UseJsonEditorFoldingProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths?: Record<string, boolean>;
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

  // Helper to get the current state of a path (defaults to true if not set)
  const getPathState = (path: string): boolean => {
    return collapsedPathsRef.current[path] !== undefined ? collapsedPathsRef.current[path] : true;
  };

  // Expand all nodes
  const expandAll = () => {
    try {
      if (!editorRef.current) return;
      
      // First, use JSONEditor's built-in expandAll
      editorRef.current.expandAll();
      
      // Update collapsed state in parent component
      if (onToggleCollapse) {
        // First handle the root node
        console.log('Expanding root node');
        onToggleCollapse('root', false);
        
        // Create a new local copy to track updates
        const updatedCollapsedPaths = { ...collapsedPathsRef.current, root: false };
        
        // Then handle any other known paths that were previously collapsed
        Object.keys(collapsedPathsRef.current).forEach(path => {
          if (collapsedPathsRef.current[path] === true) {
            console.log(`Expanding path: ${path}`);
            onToggleCollapse(path, false);
            updatedCollapsedPaths[path] = false;
          }
        });
        
        // Update our local reference
        collapsedPathsRef.current = updatedCollapsedPaths;
      }
      
      console.log('After expandAll, collapsedPaths object:', collapsedPathsRef.current);
      toast.success('All nodes expanded');
    } catch (e) {
      console.error('Error expanding all:', e);
    }
  };

  // Collapse all nodes
  const collapseAll = () => {
    try {
      if (!editorRef.current) return;
      
      // First, use JSONEditor's built-in collapseAll
      editorRef.current.collapseAll();
      
      // Update collapsed state in parent component
      if (onToggleCollapse) {
        // First handle the root node
        console.log('Collapsing root node');
        onToggleCollapse('root', true);
        
        // Create a new local copy to track updates
        const updatedCollapsedPaths = { ...collapsedPathsRef.current, root: true };
        
        // Then handle any other known paths that were previously expanded
        Object.keys(collapsedPathsRef.current).forEach(path => {
          if (collapsedPathsRef.current[path] === false) {
            console.log(`Collapsing path: ${path}`);
            onToggleCollapse(path, true);
            updatedCollapsedPaths[path] = true;
          }
        });
        
        // Update our local reference
        collapsedPathsRef.current = updatedCollapsedPaths;
      }
      
      console.log('After collapseAll, collapsedPaths object:', collapsedPathsRef.current);
      toast.success('All nodes collapsed');
    } catch (e) {
      console.error('Error collapsing all:', e);
    }
  };

  // Expand only the first level nodes
  const expandFirstLevel = () => {
    if (!editorRef.current) return;
    
    try {
      // First collapse everything
      console.log('First collapsing everything');
      
      // Use JSONEditor's built-in collapseAll
      editorRef.current.collapseAll();
      
      // Update all paths to collapsed in the state
      if (onToggleCollapse) {
        // Create a new local copy to track updates
        const updatedCollapsedPaths: Record<string, boolean> = {};
        
        // Set root to collapsed first (will be expanded after)
        onToggleCollapse('root', true);
        updatedCollapsedPaths['root'] = true;
        
        // Set all other paths to collapsed 
        Object.keys(collapsedPathsRef.current).forEach(path => {
          if (path !== 'root' && collapsedPathsRef.current[path] === false) {
            console.log(`Setting ${path} to collapsed during expandFirstLevel`);
            onToggleCollapse(path, true);
            updatedCollapsedPaths[path] = true;
          } else {
            updatedCollapsedPaths[path] = collapsedPathsRef.current[path];
          }
        });
        
        // Then expand only the root node
        console.log('Then expanding just the root node');
        onToggleCollapse('root', false);
        updatedCollapsedPaths['root'] = false;
        
        // Update local reference
        collapsedPathsRef.current = updatedCollapsedPaths;
        
        // Also ensure the editor UI reflects this
        if (editorRef.current) {
          // Use the editor's expand method for root node
          try {
            // Find the root node and expand it
            const rootNode = editorRef.current.node;
            if (rootNode && rootNode.expand) {
              rootNode.expand();
            }
          } catch (err) {
            console.error('Error expanding root node directly:', err);
          }
        }
      }
      
      console.log('After expandFirstLevel, collapsedPaths object:', collapsedPathsRef.current);
      console.log('Expanded first level nodes');
    } catch (e) {
      console.error('Error expanding first level:', e);
    }
  };

  return {
    expandAll,
    collapseAll,
    expandFirstLevel,
    collapsedPathsRef
  };
};
