
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
  // Expand all nodes
  const expandAll = () => {
    try {
      editorRef.current?.expandAll();
      
      // Update collapsed state in parent component
      if (onToggleCollapse) {
        // Log in a cleaner format
        console.log('Collapse event:', { 
          path: 'root', 
          collapsed: false, 
          previousState: collapsedPaths['root']
        });
        
        // Mark root as expanded
        onToggleCollapse('root', false);
        
        // Mark properties as expanded
        console.log('Collapse event:', { 
          path: 'root.properties', 
          collapsed: false, 
          previousState: collapsedPaths['root.properties']
        });
        onToggleCollapse('root.properties', false);
      }
      
      toast.success('All nodes expanded');
    } catch (e) {
      console.error('Error expanding all:', e);
    }
  };

  // Collapse all nodes
  const collapseAll = () => {
    try {
      editorRef.current?.collapseAll();
      
      // Update collapsed state in parent component
      if (onToggleCollapse) {
        // Log in a cleaner format
        console.log('Collapse event:', { 
          path: 'root', 
          collapsed: true, 
          previousState: collapsedPaths['root']
        });
        
        // Mark root as collapsed
        onToggleCollapse('root', true);
      }
      
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
        // Expand the root node to show first level properties
        editorRef.current.expand([]);
        
        // For each top-level property, ensure it's collapsed
        if (onToggleCollapse) {
          // Log in a cleaner format
          console.log('Collapse event:', { 
            path: 'root', 
            collapsed: false, 
            previousState: collapsedPaths['root']
          });
          
          // Mark root as expanded
          onToggleCollapse('root', false);
          
          // But mark properties as collapsed if they are complex objects
          if (rootNode.properties && typeof rootNode.properties === 'object') {
            console.log('Collapse event:', { 
              path: 'root.properties', 
              collapsed: true, 
              previousState: collapsedPaths['root.properties']
            });
            onToggleCollapse('root.properties', true);
          }
          
          if (rootNode.required && Array.isArray(rootNode.required)) {
            console.log('Collapse event:', { 
              path: 'root.required', 
              collapsed: true, 
              previousState: collapsedPaths['root.required']
            });
            onToggleCollapse('root.required', true);
          }
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
