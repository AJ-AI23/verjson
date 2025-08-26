import { useMemo } from 'react';
import { extractNotations, hasNotations } from '@/lib/diagram/notationUtils';
import { NotationComment } from '@/types/notations';

interface GroupedNotation {
  path: string;
  nodeId: string;
  notations: NotationComment[];
}

export const useNotationsManager = (schema: string) => {
  const groupedNotations = useMemo(() => {
    try {
      const parsed = JSON.parse(schema);
      const groups: GroupedNotation[] = [];

      const traverseSchema = (obj: any, path: string = 'root') => {
        if (!obj || typeof obj !== 'object') return;

        // Check if current object has notations
        if (hasNotations(obj)) {
          const notations = extractNotations(obj);
          if (notations.length > 0) {
            groups.push({
              path,
              nodeId: path,
              notations
            });
          }
        }

        // Traverse properties
        if (obj.properties) {
          Object.entries(obj.properties).forEach(([key, value]) => {
            traverseSchema(value, `${path}.${key}`);
          });
        }

        // Traverse items (for arrays)
        if (obj.items) {
          traverseSchema(obj.items, `${path}.items`);
        }

        // Traverse additional properties
        if (obj.additionalProperties && typeof obj.additionalProperties === 'object') {
          traverseSchema(obj.additionalProperties, `${path}.additionalProperties`);
        }

        // Traverse OpenAPI specific structures
        if (obj.paths) {
          Object.entries(obj.paths).forEach(([pathKey, pathValue]: [string, any]) => {
            if (hasNotations(pathValue)) {
              const notations = extractNotations(pathValue);
              if (notations.length > 0) {
                groups.push({
                  path: `paths.${pathKey}`,
                  nodeId: `endpoint-${pathKey.replace(/[^a-zA-Z0-9]/g, '-')}`,
                  notations
                });
              }
            }
            
            if (pathValue && typeof pathValue === 'object') {
              Object.entries(pathValue).forEach(([method, methodValue]: [string, any]) => {
                if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) {
                  traverseSchema(methodValue, `paths.${pathKey}.${method}`);
                }
              });
            }
          });
        }

        // Traverse components
        if (obj.components?.schemas) {
          Object.entries(obj.components.schemas).forEach(([key, value]) => {
            traverseSchema(value, `components.schemas.${key}`);
          });
        }

        // Traverse info
        if (obj.info) {
          traverseSchema(obj.info, 'info');
        }
      };

      traverseSchema(parsed);
      return groups;
    } catch (error) {
      console.error('Error extracting notations:', error);
      return [];
    }
  }, [schema]);

  return { groupedNotations };
};