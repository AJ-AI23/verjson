import { useCallback } from 'react';

interface UseBulkExpandCollapseProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth: number;
  rootSchema?: any;
  editorRef: React.MutableRefObject<any>;
}

export const useBulkExpandCollapse = ({
  onToggleCollapse,
  maxDepth,
  rootSchema,
  editorRef
}: UseBulkExpandCollapseProps) => {
  
  const getSchemaAtPath = useCallback((schema: any, path: string): any => {
    if (!schema || path === 'root') return schema;
    
    const pathParts = path.replace(/^root\.?/, '').split('.');
    let current = schema;
    
    for (const part of pathParts) {
      if (part === 'properties' && current.properties) {
        current = current.properties;
      } else if (current.properties && current.properties[part]) {
        current = current.properties[part];
      } else if (current.items) {
        current = current.items;
      } else {
        return null;
      }
    }
    
    return current;
  }, []);

  const convertPathToArray = useCallback((path: string): string[] => {
    return path.replace(/^root\.?/, '').split('.').filter(Boolean);
  }, []);

  const bulkExpand = useCallback((basePath: string) => {
    if (!editorRef?.current || !onToggleCollapse) {
      return;
    }

    // Skip bulk expansion if maxDepth is too shallow
    if (maxDepth <= 1) {
      return;
    }

    const baseDepth = basePath === 'root' ? 0 : basePath.split('.').length - 1;
    const targetDepth = baseDepth + (maxDepth - 1);
    
    const pathsToExpand: string[] = [];
    
    const collectPaths = (currentPath: string, currentDepth: number, schemaNode: any) => {
      if (!schemaNode || currentDepth >= targetDepth) return;
      
      if (schemaNode.type === 'object' && schemaNode.properties) {
        Object.keys(schemaNode.properties).forEach(propName => {
          const propPath = currentPath === 'root' ? `root.properties.${propName}` : `${currentPath}.properties.${propName}`;
          const propSchema = schemaNode.properties[propName];
          
          if (propSchema.type === 'object' && propSchema.properties) {
            pathsToExpand.push(propPath);
            collectPaths(propPath, currentDepth + 1, propSchema);
          }
        });
      }
    };

    const schemaAtPath = getSchemaAtPath(rootSchema, basePath);
    if (schemaAtPath) {
      collectPaths(basePath, baseDepth, schemaAtPath);
    }

    // Process the collected paths
    pathsToExpand.forEach((path, index) => {
      try {
        const pathArray = convertPathToArray(path);
        
        const expandNode = () => {
          try {
            const editor = editorRef.current;
            if (editor && editor.expand) {
              editor.expand(pathArray);
            }
          } catch (error) {
            // Silently handle expand errors
          }
        };

        setTimeout(expandNode, index * 10);
        onToggleCollapse(path, false);
      } catch (error) {
        // Silently handle path processing errors
      }
    });
  }, [onToggleCollapse, maxDepth, getSchemaAtPath, convertPathToArray]);

  return {
    bulkExpand
  };
};