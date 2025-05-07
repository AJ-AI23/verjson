
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
  // Helper to get the current state of a path (defaults to true if not set)
  const getPathState = (path: string): boolean => {
    return collapsedPaths[path] !== undefined ? collapsedPaths[path] : true;
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
        
        // Then handle any other known paths that were previously collapsed
        Object.keys(collapsedPaths).forEach(path => {
          if (collapsedPaths[path] === true) {
            console.log(`Expanding path: ${path}`);
            onToggleCollapse(path, false);
          }
        });
      }
      
      console.log('After expandAll, collapsedPaths object:', collapsedPaths);
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
        
        // Then handle any other known paths that were previously expanded
        Object.keys(collapsedPaths).forEach(path => {
          if (collapsedPaths[path] === false) {
            console.log(`Collapsing path: ${path}`);
            onToggleCollapse(path, true);
          }
        });
      }
      
      console.log('After collapseAll, collapsedPaths object:', collapsedPaths);
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
        // Set root to collapsed first (will be expanded after)
        onToggleCollapse('root', true);
        
        // Set all other paths to collapsed 
        Object.keys(collapsedPaths).forEach(path => {
          if (path !== 'root' && collapsedPaths[path] === false) {
            console.log(`Setting ${path} to collapsed during expandFirstLevel`);
            onToggleCollapse(path, true);
          }
        });
      }
      
      // Then expand only the root node
      if (onToggleCollapse) {
        console.log('Then expanding just the root node');
        onToggleCollapse('root', false);
        
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
      
      console.log('After expandFirstLevel, collapsedPaths object:', collapsedPaths);
      console.log('Expanded first level nodes');
    } catch (e) {
      console.error('Error expanding first level:', e);
    }
  };

  return {
    expandAll,
    collapseAll,
    expandFirstLevel
  };
};
