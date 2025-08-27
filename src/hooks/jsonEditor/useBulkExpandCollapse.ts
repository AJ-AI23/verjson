import { useCallback, useRef } from 'react';
import { CollapsedState } from '@/lib/diagram/types';
import { useDebug } from '@/contexts/DebugContext';

interface UseBulkExpandCollapseProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth: number;
}

export const useBulkExpandCollapse = ({ 
  onToggleCollapse, 
  maxDepth 
}: UseBulkExpandCollapseProps) => {
  const { debugToast } = useDebug();
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

  // Optimized bulk expand function with limits for performance
  const bulkExpand = useCallback((
    basePath: string, 
    rootSchema: any,
    isExpanding: boolean = true,
    editorRef?: React.MutableRefObject<any>,
    collapsedPathsRef?: React.MutableRefObject<CollapsedState>
  ) => {
    if (!editorRef?.current || !onToggleCollapse) {
      return;
    }

    // Limit bulk expansion to prevent performance issues with large objects like 227 properties
    const MAX_BULK_PATHS = 15; // Limit to 15 paths maximum
    const LARGE_OBJECT_THRESHOLD = 20; // If object has more than 20 properties, be more selective

    // Before expanding new paths, collapse any existing paths that are deeper than maxDepth
    if (collapsedPathsRef?.current) {
      const baseDepth = basePath === 'root' ? 0 : basePath.split('.').length - 1;
      const maxAllowedDepth = baseDepth + (maxDepth - 1);
      
      Object.entries(collapsedPathsRef.current).forEach(([path, isCollapsed]) => {
        if (!isCollapsed && path.startsWith(basePath) && path !== basePath) {
          const pathDepth = path === 'root' ? 0 : path.split('.').length - 1;
          if (pathDepth > maxAllowedDepth) {
            onToggleCollapse(path, true); // true = collapsed
          }
        }
      });
    }

    // Generate paths to expand based on maxDepth from the clicked path
    const pathsToExpand: string[] = [];
    const baseDepth = basePath === 'root' ? 0 : basePath.split('.').length - 1;

    // If maxDepth is 1, don't bulk expand any children
    if (maxDepth <= 1) {
      return;
    }

    // Optimized path generation with limits to prevent processing 227+ properties
    const generatePaths = (currentSchema: any, currentPath: string) => {
      const currentDepth = currentPath === 'root' ? 0 : currentPath.split('.').length - 1;
      
      // Stop if we've reached max depth or max paths
      if (currentDepth >= baseDepth + (maxDepth - 1) || 
          pathsToExpand.length >= MAX_BULK_PATHS ||
          !currentSchema || 
          typeof currentSchema !== 'object') {
        return;
      }

      const keys = Object.keys(currentSchema);
      
      // If this is a large object (like 227 properties), only expand the first few properties
      const keysToProcess = keys.length > LARGE_OBJECT_THRESHOLD 
        ? keys.slice(0, Math.min(10, MAX_BULK_PATHS - pathsToExpand.length))
        : keys.slice(0, MAX_BULK_PATHS - pathsToExpand.length);

      keysToProcess.forEach(propName => {
        const propPath = currentPath === 'root' ? `root.${propName}` : `${currentPath}.${propName}`;
        const propDepth = propPath.split('.').length - 1;
        
        if (propDepth <= baseDepth + (maxDepth - 1) && pathsToExpand.length < MAX_BULK_PATHS) {
          pathsToExpand.push(propPath);
          
          // Only recurse if we haven't hit our limits
          if (pathsToExpand.length < MAX_BULK_PATHS) {
            generatePaths(currentSchema[propName], propPath);
          }
        }
      });
    };

    // Get the schema for the clicked path and generate expansion paths
    const schemaAtPath = getSchemaAtPath(rootSchema, basePath);
    
    if (schemaAtPath) {
      generatePaths(schemaAtPath, basePath);
    }
    
    // Process each path with throttling for better performance
    pathsToExpand.forEach((path, index) => {
      // Stagger the operations to prevent UI blocking
      setTimeout(() => {
        try {
          const pathArray = convertPathToArray(path);
          
          // Call JSONEditor expand method directly
          editorRef.current?.expand({
            path: pathArray,
            isExpand: true,
            recursive: false
          });
          
          // Update the diagram state by calling onToggleCollapse
          if (onToggleCollapse) {
            onToggleCollapse(path, false); // false = expanded
          }
          
        } catch (error) {
          console.error(`Error expanding path ${path}:`, error);
        }
      }, index * 10); // 10ms delay between each operation to prevent UI blocking
    });
    
  }, [onToggleCollapse, maxDepth, getSchemaAtPath, convertPathToArray]);

  return {
    bulkExpand,
    isBulkExpandingRef
  };
};