import { NotationComment } from '@/types/notations';

/**
 * Adds a new notation to a schema property at the specified path
 */
export const addNotationToSchema = (
  schema: any,
  path: string,
  notation: Omit<NotationComment, 'id'>
): any => {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const updatedSchema = JSON.parse(JSON.stringify(schema)); // Deep clone
  
  // Navigate to the correct property in the schema
  const pathParts = path.split('.');
  let current = updatedSchema;
  
  // Handle root level notations
  if (path === 'root') {
    if (!current.$notations) {
      current.$notations = [];
    }
    current.$notations.push({
      ...notation,
      id: `notation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    return updatedSchema;
  }

  // Navigate through the path to find the target property
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    
    if (i === pathParts.length - 1) {
      // This is the target property
      if (current.properties && current.properties[part]) {
        if (!current.properties[part].$notations) {
          current.properties[part].$notations = [];
        }
        current.properties[part].$notations.push({
          ...notation,
          id: `notation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
      }
    } else {
      // Navigate deeper
      if (current.properties && current.properties[part]) {
        current = current.properties[part];
      } else {
        // Path doesn't exist, can't add notation
        console.warn(`Path ${path} not found in schema`);
        return schema;
      }
    }
  }
  
  return updatedSchema;
};

/**
 * Gets the property path from a node ID
 */
export const getPropertyPathFromNodeId = (nodeId: string): string => {
  if (nodeId === 'root') {
    return 'root';
  }
  
  // Remove the 'prop-' prefix if it exists
  if (nodeId.startsWith('prop-')) {
    return nodeId.substring(5);
  }
  
  return nodeId;
};