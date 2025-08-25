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
  
  // Bulk expand function
  const bulkExpand = useCallback((
    basePath: string, 
    rootSchema: any,
    isExpanding: boolean = true,
    editorRef?: React.MutableRefObject<any>
  ) => {
    try {
      console.log(`[BULK-START] Function called with basePath: ${basePath}, isExpanding: ${isExpanding}`);
      console.log(`[BULK-START] onToggleCollapse available:`, !!onToggleCollapse);
      console.log(`[BULK-START] rootSchema available:`, !!rootSchema);
      
      if (!onToggleCollapse || !rootSchema) {
        console.log(`[BULK-START] Early exit - missing dependencies`);
        return;
      }
      
      console.log(`[BULK-START] Bulk ${isExpanding ? 'expand' : 'collapse'} starting from path: ${basePath}`);
      console.log(`[BULK-START] Max relative depth: ${maxDepth}`);
      console.log(`[BULK-START] Root schema structure:`, {
        type: rootSchema?.type,
        hasProperties: !!rootSchema?.properties,
        propertyKeys: rootSchema?.properties ? Object.keys(rootSchema.properties) : []
      });
      
      console.log(`[BULK-START] Calling getSchemaAtPath with basePath: ${basePath}`);
      // Find the schema object at the base path
      const schemaAtPath = getSchemaAtPath(rootSchema, basePath);
      console.log(`[BULK-START] Schema lookup result:`, schemaAtPath ? {
        type: schemaAtPath.type,
        hasProperties: !!schemaAtPath.properties,
        propertyKeys: schemaAtPath.properties ? Object.keys(schemaAtPath.properties) : []
      } : 'null');
      
      if (!schemaAtPath) {
        console.log(`[BULK-START] No schema found at path: ${basePath} - exiting`);
        return;
      }
      
      console.log(`[BULK-START] Calling getAllNestedPaths...`);
      // Get all nested paths up to maxDepth
      const nestedPaths = getAllNestedPaths(schemaAtPath, basePath, 0, maxDepth);
      console.log(`[BULK-START] getAllNestedPaths returned ${nestedPaths.length} paths:`, nestedPaths);
      
      console.log(`[BULK-START] About to start forEach loop with ${nestedPaths.length} paths`);
      console.log(`[BULK-START] nestedPaths is array:`, Array.isArray(nestedPaths));
      console.log(`[BULK-START] First path:`, nestedPaths[0]);
      
      // Apply the expand/collapse action to all paths
      console.log(`[BULK-START] Processing ${nestedPaths.length} paths...`);
      nestedPaths.forEach((path, index) => {
        console.log(`[BULK-START] Processing path ${index + 1}/${nestedPaths.length}: ${path}`);
        console.log(`[BULK-START] Calling onToggleCollapse(${path}, ${!isExpanding})`);
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
            
            console.log(`[BULK-START] Applying expansion to JSONEditor for path: ${path} -> editor path: [${pathArray.join(', ')}]`);
            
            // Use the expand method to expand this specific node in the editor
            editorRef.current.expand({
              path: pathArray,
              isExpand: true,
              recursive: false
            });
            console.log(`[BULK-START] JSONEditor expand completed for path: ${path}`);
          } catch (error) {
            console.warn(`[BULK-START] Failed to expand path ${path} in JSONEditor:`, error);
          }
        }
      });
      
      console.log(`[BULK-START] Bulk ${isExpanding ? 'expand' : 'collapse'} completed - processed ${nestedPaths.length} paths`);
    } catch (error) {
      console.error(`[BULK-START] Error in bulk expand function:`, error);
      console.error(`[BULK-START] Error stack:`, error.stack);
    }
  }, [onToggleCollapse, maxDepth, getAllNestedPaths, getSchemaAtPath]);
  
  return {
    bulkExpand,
    getAllNestedPaths,
    getSchemaAtPath
  };
};