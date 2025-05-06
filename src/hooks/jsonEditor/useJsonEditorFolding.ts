
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
        // Track state changes for each known path
        Object.keys(collapsedPaths).forEach(path => {
          // Get previous state
          const previousState = collapsedPaths[path];
          
          if (previousState === true) {
            // Only log and update paths that were previously collapsed
            console.log('Collapse event:', { 
              path, 
              collapsed: false, 
              previousState
            });
            
            // Mark path as expanded
            onToggleCollapse(path, false);
          }
        });
        
        // Always ensure root is expanded
        const rootPreviousState = collapsedPaths['root'];
        console.log('Collapse event:', { 
          path: 'root', 
          collapsed: false, 
          previousState: rootPreviousState
        });
        onToggleCollapse('root', false);
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
        // First handle the root node
        const rootPreviousState = collapsedPaths['root'];
        
        console.log('Collapse event:', { 
          path: 'root', 
          collapsed: true, 
          previousState: rootPreviousState
        });
        
        // Mark root as collapsed
        onToggleCollapse('root', true);
        
        // Now handle any other known paths
        Object.keys(collapsedPaths).forEach(path => {
          if (path !== 'root') {
            const previousState = collapsedPaths[path];
            
            if (previousState === false) {
              // Only log and update paths that were previously expanded
              console.log('Collapse event:', { 
                path, 
                collapsed: true, 
                previousState
              });
              
              // Mark path as collapsed
              onToggleCollapse(path, true);
            }
          }
        });
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
          // Get previous state for root
          const rootPreviousState = collapsedPaths['root'];
          
          // Log in a cleaner format
          console.log('Collapse event:', { 
            path: 'root', 
            collapsed: false, 
            previousState: rootPreviousState
          });
          
          // Mark root as expanded
          onToggleCollapse('root', false);
          
          // But mark properties as collapsed if they are complex objects
          if (rootNode.properties && typeof rootNode.properties === 'object') {
            // Get previous state for properties
            const propertiesPreviousState = collapsedPaths['root.properties'];
            
            console.log('Collapse event:', { 
              path: 'root.properties', 
              collapsed: true, 
              previousState: propertiesPreviousState
            });
            onToggleCollapse('root.properties', true);
          }
          
          if (rootNode.required && Array.isArray(rootNode.required)) {
            // Get previous state for required
            const requiredPreviousState = collapsedPaths['root.required'];
            
            console.log('Collapse event:', { 
              path: 'root.required', 
              collapsed: true, 
              previousState: requiredPreviousState
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
