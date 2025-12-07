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
  
  // Handle root level notations
  if (path === 'root') {
    if (!updatedSchema.$notations) {
      updatedSchema.$notations = [];
    }
    updatedSchema.$notations.push({
      ...notation,
      id: `notation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    return updatedSchema;
  }
  
  // Handle OpenAPI paths
  if (path.startsWith('paths.')) {
    if (!updatedSchema.paths) {
      updatedSchema.paths = {};
    }
    const pathKey = path.split('.')[1]; // Get the actual path like '/pets'
    if (!updatedSchema.paths[pathKey]) {
      updatedSchema.paths[pathKey] = {};
    }
    if (!updatedSchema.paths[pathKey].$notations) {
      updatedSchema.paths[pathKey].$notations = [];
    }
    updatedSchema.paths[pathKey].$notations.push({
      ...notation,
      id: `notation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    return updatedSchema;
  }
  
  // Handle info section
  if (path === 'info') {
    if (!updatedSchema.info) {
      updatedSchema.info = {};
    }
    if (!updatedSchema.info.$notations) {
      updatedSchema.info.$notations = [];
    }
    updatedSchema.info.$notations.push({
      ...notation,
      id: `notation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    return updatedSchema;
  }

  // Handle JSON Schema properties that start with 'root.'
  let pathParts = path.split('.');
  if (pathParts[0] === 'root') {
    pathParts = pathParts.slice(1); // Remove 'root' from the beginning
  }
  
  let current = updatedSchema;
  
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
        return updatedSchema;
      } else {
        return updatedSchema;
      }
    } else {
      // Navigate deeper
      if (current.properties && current.properties[part]) {
        current = current.properties[part];
      } else if (current.items && part === 'items') {
        current = current.items;
      } else {
        return updatedSchema;
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
  
  // Handle endpoint nodeIds (like 'endpoint-/pets')
  if (nodeId.startsWith('endpoint-')) {
    const pathPart = nodeId.substring(9); // Remove 'endpoint-'
    return `paths.${pathPart}`;
  }
  
  // Handle info nodeId
  if (nodeId === 'info') {
    return 'info';
  }
  
  // Handle components nodeIDs
  if (nodeId.startsWith('components.')) {
    return nodeId;
  }
  
  // Remove the 'prop-' prefix if it exists
  if (nodeId.startsWith('prop-')) {
    return nodeId.substring(5);
  }
  
  // For other cases, return the nodeId as-is (it should already be a path)
  return nodeId;
};