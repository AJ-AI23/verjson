
import JSONEditor from 'jsoneditor';
import { toast } from 'sonner';

interface UseJsonEditorFoldingProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const useJsonEditorFolding = ({
  editorRef,
  onToggleCollapse
}: UseJsonEditorFoldingProps) => {
  // Expand all nodes
  const expandAll = () => {
    try {
      editorRef.current?.expandAll();
      toast.success('All nodes expanded');
    } catch (e) {
      console.error('Error expanding all:', e);
    }
  };

  // Collapse all nodes
  const collapseAll = () => {
    try {
      editorRef.current?.collapseAll();
      toast.success('All nodes collapsed');
    } catch (e) {
      console.error('Error collapsing all:', e);
    }
  };

  // Expand only the first level nodes
  const expandFirstLevel = () => {
    if (!editorRef.current) return;
    
    try {
      // First get the root node paths
      const rootNode = editorRef.current.get();
      
      // Check if it's an object
      if (rootNode && typeof rootNode === 'object') {
        // Expand the root node
        editorRef.current.expand(['']);
        
        // For each top-level property, expand it
        if (onToggleCollapse) {
          onToggleCollapse('root.', false);
        }
        
        console.log('Expanded first level nodes');
      }
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
