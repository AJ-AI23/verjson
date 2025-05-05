import { Node, Edge } from '@xyflow/react';
import { DiagramElements } from './types';
import { createPropertyNode, createEdge } from './nodeGenerator';

const BASE_X_OFFSET = 200;
const BASE_Y_OFFSET = 150;
const X_OFFSET = 250;
const Y_OFFSET = 120;
const COLUMNS_PER_ROW = 3;

export const generateExpandedLayout = (schema: any): DiagramElements => {
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };

  if (schema.properties) {
    const propertyNames = Object.keys(schema.properties);
    const requiredProps = schema.required || [];
    
    propertyNames.forEach((propName, index) => {
      const propertySchema = schema.properties[propName];
      
      // Build nodes for this property
      const propertyNode = createPropertyNode(
        propName,
        propertySchema,
        BASE_X_OFFSET + (index % COLUMNS_PER_ROW) * X_OFFSET,
        BASE_Y_OFFSET + Math.floor(index / COLUMNS_PER_ROW) * Y_OFFSET,
        requiredProps.includes(propName),
        'root'  // Pass the base path
      );
      
      result.nodes.push(propertyNode);
      
      // Add edge connecting this property to the root schema
      result.edges.push(
        createEdge('root', propertyNode.id)
      );
      
      // Recursively process nested properties if they exist
      if (propertySchema.type === 'object' && propertySchema.properties) {
        const nestedElements = processNestedObject(
          propertySchema,
          propertyNode.id,
          `root.properties.${propName}`  // Pass the full path
        );
        result.nodes.push(...nestedElements.nodes);
        result.edges.push(...nestedElements.edges);
      }
      
      // Process array items if they exist
      if (propertySchema.type === 'array' && propertySchema.items) {
        const itemsElements = processArrayItems(
          propertySchema.items,
          propertyNode.id,
          `root.properties.${propName}.items`  // Pass the full path
        );
        result.nodes.push(...itemsElements.nodes);
        result.edges.push(...itemsElements.edges);
      }
    });
  }
  
  return result;
};

// Process a nested object schema and its properties
const processNestedObject = (
  schema: any, 
  parentId: string,
  basePath: string = ''
): DiagramElements => {
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };
  
  if (schema.properties) {
    const propertyNames = Object.keys(schema.properties);
    const requiredProps = schema.required || [];
    
    propertyNames.forEach((propName, index) => {
      const propertySchema = schema.properties[propName];
      
      // Build nodes for this property
      const propertyNode = createPropertyNode(
        propName,
        propertySchema,
        BASE_X_OFFSET + (index % COLUMNS_PER_ROW) * X_OFFSET,
        BASE_Y_OFFSET + Math.floor(index / COLUMNS_PER_ROW) * Y_OFFSET,
        requiredProps.includes(propName),
        basePath
      );
      
      result.nodes.push(propertyNode);
      
      // Add edge connecting this property to the parent
      result.edges.push(
        createEdge(parentId, propertyNode.id)
      );
      
      // Recursively process nested properties if they exist
      if (propertySchema.type === 'object' && propertySchema.properties) {
        const nestedElements = processNestedObject(
          propertySchema,
          propertyNode.id,
          `${basePath}.properties.${propName}`
        );
        result.nodes.push(...nestedElements.nodes);
        result.edges.push(...nestedElements.edges);
      }
      
      // Process array items if they exist
      if (propertySchema.type === 'array' && propertySchema.items) {
        const itemsElements = processArrayItems(
          propertySchema.items,
          propertyNode.id,
          `${basePath}.properties.${propName}.items`
        );
        result.nodes.push(...itemsElements.nodes);
        result.edges.push(...itemsElements.edges);
      }
    });
  }
  
  return result;
};

// Process array item schema
const processArrayItems = (
  itemsSchema: any,
  parentId: string,
  basePath: string = ''
): DiagramElements => {
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };
  
  if (itemsSchema.type === 'object' || itemsSchema.properties) {
    const itemNode = createPropertyNode(
      'items',
      itemsSchema,
      BASE_X_OFFSET,
      BASE_Y_OFFSET,
      false,
      basePath
    );
    
    result.nodes.push(itemNode);
    
    // Add edge connecting this item to the parent
    result.edges.push(
      createEdge(parentId, itemNode.id)
    );
    
    // Process nested properties if they exist
    if (itemsSchema.type === 'object' && itemsSchema.properties) {
      const nestedElements = processNestedObject(
        itemsSchema,
        itemNode.id,
        `${basePath}.properties`
      );
      result.nodes.push(...nestedElements.nodes);
      result.edges.push(...nestedElements.edges);
    }
  }
  
  return result;
};
