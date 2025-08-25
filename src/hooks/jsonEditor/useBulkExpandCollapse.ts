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
    
    console.log(`[BULK] Getting nested paths for basePath: ${basePath}, currentDepth: ${currentDepth}, maxRelativeDepth: ${maxRelativeDepth}`);
    
    if (!schema || currentDepth >= maxRelativeDepth) {
      console.log(`[BULK] Stopping - no schema or max depth reached`);
      return paths;
    }
    
    // Handle object properties
    if (schema.type === 'object' && schema.properties) {
      const propertiesPath = `${basePath}.properties`;
      paths.push(propertiesPath);
      console.log(`[BULK] Added properties path: ${propertiesPath}`);
      
      // Recursively get paths for each property
      Object.entries(schema.properties).forEach(([propName, propSchema]: [string, any]) => {
        if (propSchema) {
          const propPath = `${propertiesPath}.${propName}`;
          paths.push(propPath);
          console.log(`[BULK] Added property path: ${propPath}`);
          
          // Get nested paths for this property (increment depth here)
          const nestedPaths = getAllNestedPaths(
            propSchema, 
            propPath, 
            currentDepth + 1, 
            maxRelativeDepth
          );
          paths.push(...nestedPaths);
          console.log(`[BULK] Added ${nestedPaths.length} nested paths for ${propPath}`);
        }
      });
    }
    
    // Handle array items
    if (schema.type === 'array' && schema.items) {
      const itemsPath = `${basePath}.items`;
      paths.push(itemsPath);
      console.log(`[BULK] Added items path: ${itemsPath}`);
      
      // Get nested paths for array items (increment depth here)
      const itemPaths = getAllNestedPaths(
        schema.items, 
        itemsPath, 
        currentDepth + 1, 
        maxRelativeDepth
      );
      paths.push(...itemPaths);
      console.log(`[BULK] Added ${itemPaths.length} item paths for ${itemsPath}`);
    }
    
    console.log(`[BULK] Returning ${paths.length} paths for ${basePath}:`, paths);
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
  
  // Bulk expand function - simplified for reliability
  const bulkExpand = useCallback((
    basePath: string, 
    rootSchema: any,
    isExpanding: boolean = true,
    editorRef?: React.MutableRefObject<any>
  ) => {
    console.log(`[BULK-SIMPLE] Starting bulk expand for: ${basePath}`);
    
    if (!onToggleCollapse || !rootSchema) return;
    
    // Get schema at path
    const schemaAtPath = getSchemaAtPath(rootSchema, basePath);
    if (!schemaAtPath) return;
    
    // Generate paths directly without complex recursion
    const pathsToExpand: string[] = [];
    
    if (schemaAtPath.type === 'object' && schemaAtPath.properties) {
      // Add properties container
      pathsToExpand.push(`${basePath}.properties`);
      
      // Add each property
      Object.keys(schemaAtPath.properties).forEach(propName => {
        const propPath = `${basePath}.properties.${propName}`;
        pathsToExpand.push(propPath);
        
        // Check if this property has nested properties (depth 2)
        const propSchema = schemaAtPath.properties[propName];
        if (propSchema && propSchema.type === 'object' && propSchema.properties && maxDepth > 2) {
          pathsToExpand.push(`${propPath}.properties`);
          
          // Add nested properties (depth 3)
          if (maxDepth > 3) {
            Object.keys(propSchema.properties).forEach(nestedProp => {
              pathsToExpand.push(`${propPath}.properties.${nestedProp}`);
            });
          }
        }
        
        // Handle arrays
        if (propSchema && propSchema.type === 'array' && propSchema.items && maxDepth > 2) {
          pathsToExpand.push(`${propPath}.items`);
        }
      });
    }
    
    console.log(`[BULK-SIMPLE] Generated ${pathsToExpand.length} paths:`, pathsToExpand);
    
    // Process each path immediately
    pathsToExpand.forEach((path, index) => {
      console.log(`[BULK-SIMPLE] Processing ${index + 1}/${pathsToExpand.length}: ${path}`);
      onToggleCollapse(path, false); // false = expanded
    });
    
    console.log(`[BULK-SIMPLE] Completed processing ${pathsToExpand.length} paths`);
  }, [onToggleCollapse, maxDepth, getSchemaAtPath]);
  
  return {
    bulkExpand,
    getAllNestedPaths,
    getSchemaAtPath
  };
};