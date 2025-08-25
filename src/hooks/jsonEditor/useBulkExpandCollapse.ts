import { useCallback } from 'react';
import { CollapsedState } from '@/lib/diagram/types';

interface UseBulkExpandCollapseProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth?: number;
}

export const useBulkExpandCollapse = ({
  onToggleCollapse,
  maxDepth = 3
}: UseBulkExpandCollapseProps) => {
  
  // Function to get all nested paths from a given schema object
  const getAllNestedPaths = useCallback((
    schema: any, 
    basePath: string, 
    currentDepth: number = 0,
    maxRelativeDepth: number = maxDepth
  ): string[] => {
    const paths: string[] = [];
    
    if (!schema || currentDepth >= maxRelativeDepth) {
      return paths;
    }
    
    // Handle object properties
    if (schema.type === 'object' && schema.properties) {
      const propertiesPath = `${basePath}.properties`;
      paths.push(propertiesPath);
      
      // Recursively get paths for each property
      Object.entries(schema.properties).forEach(([propName, propSchema]: [string, any]) => {
        if (propSchema) {
          const propPath = `${propertiesPath}.${propName}`;
          paths.push(propPath);
          
          // Get nested paths for this property
          const nestedPaths = getAllNestedPaths(
            propSchema, 
            propPath, 
            currentDepth + 1, 
            maxRelativeDepth
          );
          paths.push(...nestedPaths);
        }
      });
    }
    
    // Handle array items
    if (schema.type === 'array' && schema.items) {
      const itemsPath = `${basePath}.items`;
      paths.push(itemsPath);
      
      // Get nested paths for array items
      const itemPaths = getAllNestedPaths(
        schema.items, 
        itemsPath, 
        currentDepth + 1, 
        maxRelativeDepth
      );
      paths.push(...itemPaths);
    }
    
    return paths;
  }, [maxDepth]);
  
  // Function to find the schema object at a given path
  const getSchemaAtPath = useCallback((
    rootSchema: any, 
    targetPath: string
  ): any => {
    if (!rootSchema || !targetPath) return null;
    
    const pathParts = targetPath.split('.');
    let current = rootSchema;
    
    for (let i = 1; i < pathParts.length; i++) { // Skip 'root'
      const part = pathParts[i];
      
      if (part === 'properties' && current.properties) {
        // Stay at current level, properties is just a container
        continue;
      } else if (part === 'items' && current.items) {
        current = current.items;
      } else if (current.properties && current.properties[part]) {
        current = current.properties[part];
      } else {
        return null; // Path not found
      }
    }
    
    return current;
  }, []);
  
  // Bulk expand function
  const bulkExpand = useCallback((
    basePath: string, 
    rootSchema: any,
    isExpanding: boolean = true,
    editorRef?: React.MutableRefObject<any>
  ) => {
    if (!onToggleCollapse || !rootSchema) return;
    
    console.log(`Bulk ${isExpanding ? 'expand' : 'collapse'} starting from path: ${basePath}`);
    console.log(`Max relative depth: ${maxDepth}`);
    
    // Find the schema object at the base path
    const schemaAtPath = getSchemaAtPath(rootSchema, basePath);
    if (!schemaAtPath) {
      console.log(`No schema found at path: ${basePath}`);
      return;
    }
    
    console.log(`Schema at path ${basePath}:`, {
      type: schemaAtPath.type,
      hasProperties: !!schemaAtPath.properties,
      hasItems: !!schemaAtPath.items
    });
    
    // Get all nested paths up to maxDepth
    const nestedPaths = getAllNestedPaths(schemaAtPath, basePath, 0, maxDepth);
    
    console.log(`Found ${nestedPaths.length} nested paths to bulk ${isExpanding ? 'expand' : 'collapse'}:`, nestedPaths);
    
    // Apply the expand/collapse action to all paths
    nestedPaths.forEach(path => {
      console.log(`Bulk ${isExpanding ? 'expanding' : 'collapsing'} path: ${path}`);
      onToggleCollapse(path, !isExpanding);
      
      // Also apply the expansion to the JSONEditor instance if available
      if (editorRef && editorRef.current && isExpanding) {
        try {
          // Convert the path to an array format for JSONEditor
          // Remove 'root.' prefix and handle special cases
          let editorPath = path.replace(/^root\./, '');
          
          // Skip 'properties' containers as they're not actual nodes in the editor
          if (editorPath.includes('.properties.')) {
            editorPath = editorPath.replace(/\.properties\./g, '.');
          }
          if (editorPath.endsWith('.properties')) {
            editorPath = editorPath.replace(/\.properties$/, '');
          }
          if (editorPath.startsWith('properties.')) {
            editorPath = editorPath.replace(/^properties\./, '');
          }
          
          // Convert to array path
          const pathArray = editorPath === '' ? [] : editorPath.split('.');
          
          console.log(`Applying expansion to JSONEditor for path: ${path} -> editor path: [${pathArray.join(', ')}]`);
          
          // Use the expand method to expand this specific node in the editor
          editorRef.current.expand({
            path: pathArray,
            isExpand: true,
            recursive: false
          });
        } catch (error) {
          console.warn(`Failed to expand path ${path} in JSONEditor:`, error);
        }
      }
    });
    
    console.log(`Bulk ${isExpanding ? 'expand' : 'collapse'} completed`);
  }, [onToggleCollapse, maxDepth, getAllNestedPaths, getSchemaAtPath]);
  
  return {
    bulkExpand,
    getAllNestedPaths,
    getSchemaAtPath
  };
};