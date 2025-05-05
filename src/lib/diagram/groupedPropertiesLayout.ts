import { Node, Edge } from '@xyflow/react';
import { DiagramElements, PropertyDetails } from './types';
import { createPropertyNode, createEdge, createGroupNode } from './nodeGenerator';

const BASE_X_OFFSET = 0;
const BASE_Y_OFFSET = 150;
const X_OFFSET = 250;
const Y_OFFSET = 150;
const COLUMNS_PER_ROW = 3;

// Helper function to group properties by their parent object
const groupPropertiesByParent = (properties: { [key: string]: any }): { [key: string]: { [key: string]: any } } => {
  const grouped: { [key: string]: { [key: string]: any } } = {};

  Object.entries(properties).forEach(([key, property]) => {
    const parent = property['x-walrus-parent'] || 'Ungrouped';
    if (!grouped[parent]) {
      grouped[parent] = {};
    }
    grouped[parent][key] = property;
  });

  return grouped;
};

export const generateGroupedLayout = (schema: any): DiagramElements => {
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };

  if (schema.properties) {
    // Group properties by parent object
    const groupedProperties = groupPropertiesByParent(schema.properties);
    
    // Create nodes for each group
    Object.entries(groupedProperties).forEach(([groupName, properties], index) => {
      const groupNode = createGroupNode(
        groupName,
        properties,
        schema.required || [],
        BASE_X_OFFSET + (index % COLUMNS_PER_ROW) * X_OFFSET,
        BASE_Y_OFFSET + Math.floor(index / COLUMNS_PER_ROW) * Y_OFFSET,
        'root'  // Pass the base path
      );
      
      result.nodes.push(groupNode);
      
      // Add edge connecting this group to the root schema
      result.edges.push(
        createEdge('root', groupNode.id)
      );
      
      // Process nested objects and arrays inside this group
      Object.entries(properties).forEach(([propName, propSchema]) => {
        // Process nested objects
        if (propSchema.type === 'object' && propSchema.properties) {
          const nestedElements = processGroupedObject(
            propSchema,
            groupNode.id,
            `root.properties.${propName}`  // Pass the full path
          );
          result.nodes.push(...nestedElements.nodes);
          result.edges.push(...nestedElements.edges);
        }
        
        // Process arrays
        if (propSchema.type === 'array' && propSchema.items) {
          const itemsElements = processGroupedArray(
            propSchema.items,
            groupNode.id,
            `root.properties.${propName}.items`  // Pass the full path
          );
          result.nodes.push(...itemsElements.nodes);
          result.edges.push(...itemsElements.edges);
        }
      });
    });
  }
  
  return result;
};

// Process a nested object schema when using grouped mode
const processGroupedObject = (
  schema: any, 
  parentId: string,
  basePath: string = ''
): DiagramElements => {
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };
  
  // Process nested object groups
  if (schema.properties) {
    // Group the nested properties
    const groupedProperties = groupPropertiesByParent(schema.properties);
    
    // Create nodes for each nested group
    Object.entries(groupedProperties).forEach(([groupName, properties], index) => {
      const groupNode = createGroupNode(
        groupName,
        properties,
        schema.required || [],
        BASE_X_OFFSET + (index % COLUMNS_PER_ROW) * X_OFFSET,
        BASE_Y_OFFSET + Math.floor(index / COLUMNS_PER_ROW) * Y_OFFSET,
        basePath  // Pass the path
      );
      
      result.nodes.push(groupNode);
      
      // Create an edge from the parent to this group
      result.edges.push(createEdge(parentId, groupNode.id));
      
      // Process nested properties within this group
      Object.entries(properties).forEach(([propName, propSchema]) => {
        // Process nested objects
        if (propSchema.type === 'object' && propSchema.properties) {
          const nestedElements = processGroupedObject(
            propSchema,
            groupNode.id,
            `${basePath}.properties.${propName}`  // Pass the full path
          );
          result.nodes.push(...nestedElements.nodes);
          result.edges.push(...nestedElements.edges);
        }
        
        // Process arrays
        if (propSchema.type === 'array' && propSchema.items) {
          const itemsElements = processGroupedArray(
            propSchema.items,
            groupNode.id,
            `${basePath}.properties.${propName}.items`  // Pass the full path
          );
          result.nodes.push(...itemsElements.nodes);
          result.edges.push(...itemsElements.edges);
        }
      });
    });
  }
  
  return result;
};

// Process an array items schema when using grouped mode
const processGroupedArray = (
  itemsSchema: any,
  parentId: string,
  basePath: string = ''
): DiagramElements => {
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };
  
  // Create a node for the array items
  if (itemsSchema.type === 'object' || itemsSchema.properties) {
    // For objects in arrays, create a node representing the array items
    const itemNode = createPropertyNode(
      'items',
      itemsSchema,
      BASE_X_OFFSET,
      BASE_Y_OFFSET,
      false,
      basePath  // Pass the path
    );
    
    result.nodes.push(itemNode);
    
    // Create an edge from the parent to the array items
    result.edges.push(createEdge(parentId, itemNode.id));
  }
  
  return result;
};
