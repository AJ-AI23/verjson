import { useCallback, useRef, useEffect } from 'react';
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';

interface UseJsonEditorFoldingProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths: CollapsedState;
  parsedSchema?: any;
}

export const useJsonEditorFolding = ({
  editorRef,
  onToggleCollapse,
  collapsedPaths = {},
  parsedSchema
}: UseJsonEditorFoldingProps) => {
  // Keep a reference to the latest collapsedPaths
  const collapsedPathsRef = useRef<Record<string, boolean>>(collapsedPaths);
  
  // Update ref when props change
  useEffect(() => {
    collapsedPathsRef.current = { ...collapsedPaths };
  }, [collapsedPaths]);

  
  // Helper function to get diagram-relevant paths from the schema
  const getDiagramPaths = useCallback((schema: any, currentPath = 'root'): string[] => {
    const paths: string[] = [currentPath];
    
    if (!schema || typeof schema !== 'object') {
      return paths;
    }

    // For JSON schema properties - these become the actual diagram nodes
    if (schema.properties && typeof schema.properties === 'object') {
      Object.keys(schema.properties).forEach(propName => {
        const propPath = currentPath === 'root' ? `root.${propName}` : `${currentPath}.${propName}`;
        paths.push(propPath);
        
        // Recursively process nested properties
        const propSchema = schema.properties[propName];
        if (propSchema.properties) {
          const subPaths = getDiagramPaths(propSchema, propPath);
          paths.push(...subPaths.slice(1)); // Skip the current path as we already added it
        }
        
        // Handle array items
        if (propSchema.items) {
          const itemPath = `${propPath}.items`;
          paths.push(itemPath);
          if (propSchema.items.properties) {
            const itemPaths = getDiagramPaths(propSchema.items, itemPath);
            paths.push(...itemPaths.slice(1));
          }
        }
      });
    }

    // For arrays with items at root level
    if (schema.items && currentPath === 'root') {
      const itemPath = 'root.items';
      paths.push(itemPath);
      if (schema.items.properties) {
        const itemPaths = getDiagramPaths(schema.items, itemPath);
        paths.push(...itemPaths.slice(1));
      }
    }

    return paths;
  }, []);

  // Expand all nodes in the editor and update diagram state
  const expandAll = useCallback(() => {
    if (!editorRef.current || !onToggleCollapse) {
      return;
    }
    
    try {
      // Get all possible paths from the schema
      let allPaths: string[] = [];
      if (parsedSchema) {
        allPaths = getDiagramPaths(parsedSchema);
        
        // Update all paths to expanded state
        allPaths.forEach(path => {
          onToggleCollapse(path, false); // false = expanded
        });
      } else {
        // Fallback: just expand root
        onToggleCollapse('root', false);
      }
      
      // Also expand the editor using its native method
      editorRef.current.expand({
        path: [],  // Empty path for root
        isExpand: true,
        recursive: true
      });
    } catch (err) {
      console.error('Error expanding all nodes:', err);
    }
  }, [editorRef, onToggleCollapse, parsedSchema, getDiagramPaths]);

  // Collapse all nodes in the editor and update diagram state
  const collapseAll = useCallback(() => {
    if (!editorRef.current || !onToggleCollapse) {
      return;
    }
    
    try {
      // First, use the editor's native collapseAll method
      editorRef.current.collapseAll();
      
      // Get all currently expanded paths (those that are false in collapsedPathsRef)
      const currentlyExpandedPaths: string[] = [];
      Object.entries(collapsedPathsRef.current).forEach(([path, isCollapsed]) => {
        if (!isCollapsed) {
          currentlyExpandedPaths.push(path);
        }
      });
      
      // If we have parsed schema, also get all possible paths to ensure we cover everything
      if (parsedSchema) {
        const allPossiblePaths = getDiagramPaths(parsedSchema);
        allPossiblePaths.forEach(path => {
          if (!currentlyExpandedPaths.includes(path)) {
            currentlyExpandedPaths.push(path);
          }
        });
      }
      
      // Update all paths to collapsed state except root (which we keep expanded to show the structure)
      currentlyExpandedPaths.forEach(path => {
        if (path === 'root') {
          onToggleCollapse(path, false); // Keep root expanded so we can see the structure
        } else {
          onToggleCollapse(path, true); // Collapse all other paths
        }
      });
      
    } catch (err) {
      console.error('Error collapsing all nodes:', err);
    }
  }, [editorRef, onToggleCollapse, parsedSchema, getDiagramPaths, collapsedPathsRef]);

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
