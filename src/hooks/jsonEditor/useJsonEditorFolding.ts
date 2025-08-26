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
    console.log('Updated collapsedPathsRef in useJsonEditorFolding:', collapsedPathsRef.current);
  }, [collapsedPaths]);

  
  // Helper function to get all possible paths from the schema
  const getAllSchemaPaths = useCallback((schema: any, currentPath = 'root'): string[] => {
    const paths: string[] = [currentPath];
    
    if (!schema || typeof schema !== 'object') {
      return paths;
    }

    // For objects with properties
    if (schema.properties && typeof schema.properties === 'object') {
      Object.keys(schema.properties).forEach(propName => {
        const propPath = currentPath === 'root' ? `root.${propName}` : `${currentPath}.${propName}`;
        const subPaths = getAllSchemaPaths(schema.properties[propName], propPath);
        paths.push(...subPaths);
      });
    }

    // For arrays with items
    if (schema.items) {
      const itemPath = currentPath === 'root' ? 'root.items' : `${currentPath}.items`;
      const subPaths = getAllSchemaPaths(schema.items, itemPath);
      paths.push(...subPaths);
    }

    // For allOf, anyOf, oneOf
    ['allOf', 'anyOf', 'oneOf'].forEach(keyword => {
      if (Array.isArray(schema[keyword])) {
        schema[keyword].forEach((subSchema: any, index: number) => {
          const subPath = currentPath === 'root' ? `root.${keyword}.${index}` : `${currentPath}.${keyword}.${index}`;
          const subPaths = getAllSchemaPaths(subSchema, subPath);
          paths.push(...subPaths);
        });
      }
    });

    return paths;
  }, []);

  // Expand all nodes in the editor and update diagram state
  const expandAll = useCallback(() => {
    if (!editorRef.current || !onToggleCollapse) {
      return;
    }
    
    try {
      console.log('Starting bulk expand all operation');
      
      // Get all possible paths from the schema
      let allPaths: string[] = [];
      if (parsedSchema) {
        allPaths = getAllSchemaPaths(parsedSchema);
        console.log('Found schema paths for expansion:', allPaths);
      }
      
      // Update all paths to expanded state
      allPaths.forEach(path => {
        onToggleCollapse(path, false); // false = expanded
      });
      
      // Also expand the editor using its native method
      editorRef.current.expand({
        path: [],  // Empty path for root
        isExpand: true,
        recursive: true
      });
      
      console.log('Expanded all nodes - both editor and diagram state updated');
    } catch (err) {
      console.error('Error expanding all nodes:', err);
    }
  }, [editorRef, onToggleCollapse, parsedSchema, getAllSchemaPaths]);

  // Collapse all nodes in the editor and update diagram state
  const collapseAll = useCallback(() => {
    if (!editorRef.current || !onToggleCollapse) {
      return;
    }
    
    try {
      console.log('Starting bulk collapse all operation');
      
      // Get all possible paths from the schema
      let allPaths: string[] = [];
      if (parsedSchema) {
        allPaths = getAllSchemaPaths(parsedSchema);
        console.log('Found schema paths for collapse:', allPaths);
      }
      
      // Update all paths to collapsed state (except root, which should be expanded to show the collapsed children)
      allPaths.forEach(path => {
        if (path === 'root') {
          onToggleCollapse(path, false); // Keep root expanded so we can see it has children
        } else {
          onToggleCollapse(path, true); // true = collapsed
        }
      });
      
      // Also collapse the editor using its native method
      editorRef.current.expand({
        path: [],  // Empty path for root
        isExpand: false,
        recursive: true
      });
      
      console.log('Collapsed all nodes - both editor and diagram state updated');
    } catch (err) {
      console.error('Error collapsing all nodes:', err);
    }
  }, [editorRef, onToggleCollapse, parsedSchema, getAllSchemaPaths]);

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
