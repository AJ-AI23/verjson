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
  
  // Helper to convert dot path to array path for JSONEditor
  const convertPathToArray = useCallback((path: string): string[] => {
    return path.split('.').filter(segment => segment !== 'root');
  }, []);

  // Bulk expand function using direct JSONEditor API calls
  const bulkExpand = useCallback((
    basePath: string, 
    rootSchema: any,
    isExpanding: boolean = true,
    editorRef?: React.MutableRefObject<any>
  ) => {
    console.log(`[BULK-DIRECT] Starting bulk expand for: ${basePath}`);
    
    if (!editorRef?.current || !rootSchema) {
      console.log(`[BULK-DIRECT] Missing editor ref or schema`);
      return;
    }
    
    // Handle the case where basePath ends with .properties
    // We need to get the parent object schema, not the properties container
    let schemaPath = basePath;
    let actualBasePath = basePath;
    
    if (basePath.endsWith('.properties')) {
      // Remove .properties to get the parent object path
      schemaPath = basePath.replace(/\.properties$/, '');
      actualBasePath = basePath.replace(/\.properties$/, '');
    }
    
    console.log(`[BULK-DIRECT] Schema path: ${schemaPath}, Actual base path: ${actualBasePath}`);
    
    // Get schema at the corrected path
    const schemaAtPath = getSchemaAtPath(rootSchema, schemaPath);
    if (!schemaAtPath) {
      console.log(`[BULK-DIRECT] No schema found at path: ${schemaPath}`);
      return;
    }
    
    // Generate paths directly with proper recursive expansion
    const pathsToExpand: string[] = [];
    
    // Helper function to recursively generate expansion paths
    const generateExpansionPaths = (
      currentSchema: any, 
      currentPath: string, 
      currentDepth: number
    ) => {
      if (currentDepth >= maxDepth || !currentSchema) return;
      
      if (currentSchema.type === 'object' && currentSchema.properties) {
        // Add properties container (this uses up one depth level)
        const propertiesPath = `${currentPath}.properties`;
        const propertiesDepth = currentDepth + 1;
        
        if (propertiesDepth <= maxDepth) {
          pathsToExpand.push(propertiesPath);
          
          // Add each property (this uses up another depth level)
          Object.keys(currentSchema.properties).forEach(propName => {
            const propPath = `${propertiesPath}.${propName}`;
            const propDepth = propertiesDepth + 1;
            
            if (propDepth <= maxDepth) {
              pathsToExpand.push(propPath);
              
              // Recursively expand nested content from this property
              const propSchema = currentSchema.properties[propName];
              generateExpansionPaths(propSchema, propPath, propDepth);
            }
          });
        }
      }
      
      if (currentSchema.type === 'array' && currentSchema.items) {
        // Add items container (this uses up one depth level)
        const itemsPath = `${currentPath}.items`;
        const itemsDepth = currentDepth + 1;
        
        if (itemsDepth <= maxDepth) {
          pathsToExpand.push(itemsPath);
          
          // Recursively expand array items content
          generateExpansionPaths(currentSchema.items, itemsPath, itemsDepth);
        }
      }
    };
    
    // Start recursive expansion from depth 1 (clicked node is depth 0)
    generateExpansionPaths(schemaAtPath, actualBasePath, 0);
    
    console.log(`[BULK-DIRECT] Generated ${pathsToExpand.length} paths:`, pathsToExpand);
    
    // Process each path using JSONEditor API directly
    pathsToExpand.forEach((path, index) => {
      try {
        const pathArray = convertPathToArray(path);
        console.log(`[BULK-DIRECT] Expanding ${index + 1}/${pathsToExpand.length}: ${path} -> [${pathArray.join(', ')}]`);
        
        // Call JSONEditor expand method directly
        editorRef.current.expand({
          path: pathArray,
          isExpand: true,
          recursive: false
        });
        
        // Also update the collapsed state for consistency
        onToggleCollapse?.(path, false);
        
      } catch (error) {
        console.error(`[BULK-DIRECT] Error expanding path ${path}:`, error);
      }
    });
    
    console.log(`[BULK-DIRECT] Completed processing ${pathsToExpand.length} paths`);
  }, [onToggleCollapse, maxDepth, getSchemaAtPath, convertPathToArray]);
  
  return {
    bulkExpand,
    getAllNestedPaths,
    getSchemaAtPath
  };
};