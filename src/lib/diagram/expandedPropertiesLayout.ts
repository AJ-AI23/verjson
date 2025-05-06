
import { Node, Edge } from '@xyflow/react';
import { DiagramElements } from './types';
import { 
  createPropertyNode, 
  createNestedPropertyNode, 
  createArrayItemNode 
} from './nodeGenerator';
import { createEdge } from './edgeGenerator';

export const generateExpandedLayout = (schema: any): DiagramElements => {
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };

  if (!schema || !schema.type || schema.type !== 'object' || !schema.properties) {
    return result;
  }

  // We assume the root node is already added to the result nodes
  
  const properties = schema.properties;
  const requiredProps = schema.required || [];
  let xOffset = -200;
  const yOffset = 150;
  const xSpacing = 200;
  
  // Calculate starting x position to center the nodes
  const totalWidth = Object.keys(properties).length * xSpacing;
  xOffset = -totalWidth / 2 + xSpacing / 2;
  
  Object.entries(properties).forEach(([propName, propSchema]: [string, any], index) => {
    // Skip if propSchema is null or undefined
    if (!propSchema) return;
    
    const xPos = xOffset + index * xSpacing;
    
    // Create node for property
    const propNode = createPropertyNode(propName, propSchema, requiredProps, xPos, yOffset);
    
    // Add edge from root to property
    const edge = createEdge('root', propNode.id);
    
    result.nodes.push(propNode);
    result.edges.push(edge);
    
    // If the property is an object with nested properties
    if (propSchema.type === 'object' && propSchema.properties) {
      const nestedProps = propSchema.properties;
      const nestedRequired = propSchema.required || [];
      const nestedYOffset = yOffset + 150;
      
      // Update the parent node data with property count
      propNode.data.properties = Object.keys(nestedProps).length;
      
      // Calculate nested properties positioning
      const totalNestedWidth = Object.keys(nestedProps).length * (xSpacing * 0.8);
      let nestedXOffset = xPos - totalNestedWidth / 2 + (xSpacing * 0.8) / 2;
      
      Object.entries(nestedProps).forEach(([nestedName, nestedSchema]: [string, any], nestedIndex) => {
        // Skip if nestedSchema is null or undefined
        if (!nestedSchema) return;
        
        const nestedXPos = nestedXOffset + nestedIndex * (xSpacing * 0.8);
        
        // Create node for nested property
        const nestedNode = createNestedPropertyNode(
          propNode.id, 
          nestedName, 
          nestedSchema, 
          nestedRequired, 
          nestedXPos, 
          nestedYOffset
        );
        
        // Add edge from parent property to nested property
        const nestedEdge = createEdge(propNode.id, nestedNode.id);
        
        result.nodes.push(nestedNode);
        result.edges.push(nestedEdge);
      });
    }
    
    // If the property is an array, add its items
    if (propSchema.type === 'array' && propSchema.items) {
      const itemSchema = propSchema.items;
      
      // Update the parent node with minItems/maxItems if defined
      propNode.data.minItems = propSchema.minItems;
      propNode.data.maxItems = propSchema.maxItems;
      
      // Create node for array items
      const itemNode = createArrayItemNode(propNode.id, itemSchema, xPos, yOffset);
      
      // Add edge from array to items
      const itemsEdge = createEdge(propNode.id, itemNode.id, 'items');
      
      result.nodes.push(itemNode);
      result.edges.push(itemsEdge);
    }
  });
  
  return result;
};
