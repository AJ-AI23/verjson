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
  console.log('Adding notation to path:', path, 'with notation:', notation);
  
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
    console.log('Added notation to root, result:', current.$notations);
    return updatedSchema;
  }
  
  // Handle OpenAPI paths
  if (path.startsWith('paths.')) {
    if (!current.paths) {
      current.paths = {};
    }
    const pathKey = pathParts[1]; // Get the actual path like '/pets'
    if (!current.paths[pathKey]) {
      current.paths[pathKey] = {};
    }
    if (!current.paths[pathKey].$notations) {
      current.paths[pathKey].$notations = [];
    }
    current.paths[pathKey].$notations.push({
      ...notation,
      id: `notation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    console.log('Added notation to path:', pathKey, 'result:', current.paths[pathKey].$notations);
    return updatedSchema;
  }
  
  // Handle info section
  if (path === 'info') {
    if (!current.info) {
      current.info = {};
    }
    if (!current.info.$notations) {
      current.info.$notations = [];
    }
    current.info.$notations.push({
      ...notation,
      id: `notation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    console.log('Added notation to info, result:', current.info.$notations);
    return updatedSchema;
  }

  // Navigate through the path to find the target property (for JSON Schema properties)
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
        console.log('Added notation to property:', part, 'result:', current.properties[part].$notations);
      }
    } else {
      // Navigate deeper
      if (current.properties && current.properties[part]) {
        current = current.properties[part];
      } else if (current.items && part === 'items') {
        current = current.items;
      } else {
        console.warn(`Could not navigate to path part: ${part} in path: ${path}`);
        break;
      }
    }
  }
  
  return updatedSchema;
};

/**
 * Gets the property path from a node ID
 */
export const getPropertyPathFromNodeId = (nodeId: string): string => {
  console.log('Converting nodeId to path:', nodeId);
  
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