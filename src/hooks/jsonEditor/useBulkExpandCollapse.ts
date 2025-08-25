import { useCallback } from 'react';
import { CollapsedState } from '@/lib/diagram/types';

interface UseBulkExpandCollapseProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth: number;
}

export const useBulkExpandCollapse = ({
  onToggleCollapse,
  maxDepth
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
    console.log(`[DEBUG] bulkExpand received maxDepth: ${maxDepth}`);
    
    if (!editorRef?.current || !rootSchema) {
      console.log(`[BULK-DIRECT] Missing editor ref or schema`);
      return;
    }
    
    // Handle the case where basePath ends with .properties
    // When clicking on a .properties node, we want to expand its children
    let schemaPath = basePath;
    let actualBasePath = basePath;
    
    if (basePath.endsWith('.properties')) {
      // Get the parent object schema for structure info
      schemaPath = basePath.replace(/\.properties$/, '');
      // But keep the actual base path as the properties container
      actualBasePath = basePath;
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
    // Clicked node is considered level 1, we expand relative to it
    const generateExpansionPaths = (
      currentSchema: any, 
      currentPath: string, 
      currentLevel: number
    ) => {
      if (currentLevel > maxDepth || !currentSchema) return;
      
      if (currentSchema.type === 'object' && currentSchema.properties) {
        // Level N+1: Add properties container
        const propertiesPath = `${currentPath}.properties`;
        const propertiesLevel = currentLevel + 1;
        
        if (propertiesLevel <= maxDepth) {
          pathsToExpand.push(propertiesPath);
          
          // Level N+2: Add each property
          Object.keys(currentSchema.properties).forEach(propName => {
            const propPath = `${propertiesPath}.${propName}`;
            const propLevel = propertiesLevel + 1;
            
            if (propLevel <= maxDepth) {
              pathsToExpand.push(propPath);
              
              // Continue recursively from this property
              const propSchema = currentSchema.properties[propName];
              generateExpansionPaths(propSchema, propPath, propLevel);
            }
          });
        }
      }
      
      if (currentSchema.type === 'array' && currentSchema.items) {
        // Level N+1: Add items container
        const itemsPath = `${currentPath}.items`;
        const itemsLevel = currentLevel + 1;
        
        if (itemsLevel <= maxDepth) {
          pathsToExpand.push(itemsPath);
          
          // Continue recursively from array items
          generateExpansionPaths(currentSchema.items, itemsPath, itemsLevel);
        }
      }
    };
    
    // Special handling when clicking on a .properties node
    if (basePath.endsWith('.properties')) {
      // When clicking on a properties container, treat it as the starting point
      if (schemaAtPath.type === 'object' && schemaAtPath.properties) {
        Object.keys(schemaAtPath.properties).forEach(propName => {
          const propPath = `${actualBasePath}.${propName}`;
          // Individual properties are level 1 from the clicked .properties node
          const propLevel = 1; 
          
          if (propLevel <= maxDepth) {
            pathsToExpand.push(propPath);
            
            // Continue recursively from this property if we have more depth
            if (maxDepth > 1) {
              const propSchema = schemaAtPath.properties[propName];
              generateExpansionPaths(propSchema, propPath, propLevel);
            }
          }
        });
      }
    } else {
      // Normal expansion for non-.properties nodes
      generateExpansionPaths(schemaAtPath, actualBasePath, 1);
    }
    
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
        
        // Don't call onToggleCollapse for bulk-expanded paths to avoid triggering
        // additional expansion events - we're already handling the expansion directly
        
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