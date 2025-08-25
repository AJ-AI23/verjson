import { useCallback, useRef } from 'react';
import { CollapsedState } from '@/lib/diagram/types';

interface UseBulkExpandCollapseProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth: number;
}

export const useBulkExpandCollapse = ({ 
  onToggleCollapse, 
  maxDepth 
}: UseBulkExpandCollapseProps) => {
  const isBulkExpandingRef = useRef(false);

  // Convert path to JSONEditor array format
  const convertPathToArray = useCallback((path: string): string[] => {
    if (path === 'root') return [];
    return path.replace('root.', '').split('.');
  }, []);

  // Get schema at specific path
  const getSchemaAtPath = useCallback((schema: any, path: string): any => {
    if (path === 'root') return schema;
    
    const parts = path.replace('root.', '').split('.');
    let current = schema;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && current.hasOwnProperty(part)) {
        current = current[part];
      } else {
        return null;
      }
    }
    return current;
  }, []);

  // Bulk expand function - focuses on structural depth levels
  const bulkExpand = useCallback((
    basePath: string, 
    rootSchema: any,
    isExpanding: boolean = true,
    editorRef?: React.MutableRefObject<any>,
    collapsedPathsRef?: React.MutableRefObject<CollapsedState>
  ) => {
    if (!editorRef?.current || !onToggleCollapse) {
      console.log('[BULK-DIRECT] Missing editor or onToggleCollapse callback');
      return;
    }

    console.log(`[BULK-DIRECT] Starting bulk expand for: ${basePath}`);
    console.log(`[DEBUG] bulkExpand received maxDepth: ${maxDepth}`);

    // Before expanding new paths, collapse any existing paths that are deeper than maxDepth
    if (collapsedPathsRef?.current) {
      const baseDepth = basePath === 'root' ? 0 : basePath.split('.').length - 1;
      const maxAllowedDepth = baseDepth + maxDepth;
      
      Object.entries(collapsedPathsRef.current).forEach(([path, isCollapsed]) => {
        if (!isCollapsed && path.startsWith(basePath) && path !== basePath) {
          const pathDepth = path === 'root' ? 0 : path.split('.').length - 1;
          if (pathDepth > maxAllowedDepth) {
            console.log(`[BULK-CLEANUP] Collapsing deep path: ${path} (depth ${pathDepth} > max ${maxAllowedDepth})`);
            onToggleCollapse(path, true); // true = collapsed
          }
        }
      });
    }

    // Generate paths to expand based on maxDepth from the clicked path
    const pathsToExpand: string[] = [];
    const baseDepth = basePath === 'root' ? 0 : basePath.split('.').length - 1;

    // Recursively generate all possible paths from the schema
    const generatePaths = (currentSchema: any, currentPath: string) => {
      const currentDepth = currentPath === 'root' ? 0 : currentPath.split('.').length - 1;
      
      if (currentDepth >= baseDepth + maxDepth || !currentSchema || typeof currentSchema !== 'object') return;

      // For any object, iterate through all its keys as potential expandable paths
      Object.keys(currentSchema).forEach(propName => {
        const propPath = currentPath === 'root' ? `root.${propName}` : `${currentPath}.${propName}`;
        const propDepth = propPath.split('.').length - 1;
        
        if (propDepth <= baseDepth + maxDepth) {
          pathsToExpand.push(propPath);
          generatePaths(currentSchema[propName], propPath);
        }
      });
    };

    // Get the schema for the clicked path and generate expansion paths
    const schemaAtPath = getSchemaAtPath(rootSchema, basePath);
    console.log(`[BULK-DIRECT] Schema at path ${basePath}:`, schemaAtPath);
    
    if (schemaAtPath) {
      generatePaths(schemaAtPath, basePath);
    } else {
      console.log(`[BULK-DIRECT] No schema found at path: ${basePath}`);
    }

    console.log(`[BULK-DIRECT] Generated ${pathsToExpand.length} paths for baseDepth ${baseDepth} + maxDepth ${maxDepth}:`, pathsToExpand);
    
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
        
        // Update the diagram state by calling onToggleCollapse
        if (onToggleCollapse) {
          onToggleCollapse(path, false); // false = expanded
        }
        
      } catch (error) {
        console.error(`[BULK-DIRECT] Error expanding path ${path}:`, error);
      }
    });
    
    console.log(`[BULK-DIRECT] Completed processing ${pathsToExpand.length} paths`);
  }, [onToggleCollapse, maxDepth, getSchemaAtPath, convertPathToArray]);

  return {
    bulkExpand,
    isBulkExpandingRef
  };
};