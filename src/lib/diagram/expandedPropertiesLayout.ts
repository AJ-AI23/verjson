
import { Node, Edge } from '@xyflow/react';
import { DiagramElements, DiagramOptions } from './types';
import { 
  createPropertyNode, 
  createNestedPropertyNode, 
  createArrayItemNode 
} from './nodeGenerator';
import { createEdge } from './edgeGenerator';

export const generateExpandedLayout = (schema: any, options: DiagramOptions = { maxDepth: 3, expandedNodes: [] }): DiagramElements => {
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
  
  // Track current depth as we process the schema
  const processProperties = (
    parentId: string, 
    props: Record<string, any>, 
    required: string[], 
    baseXPos: number, 
    baseYPos: number, 
    currentDepth: number
  ) => {
    // Skip if we've exceeded max depth and this node is not explicitly expanded
    if (currentDepth > options.maxDepth && !options.expandedNodes.includes(parentId)) {
      return;
    }
    
    Object.entries(props).forEach(([propName, propSchema]: [string, any], index) => {
      // Skip if propSchema is null or undefined
      if (!propSchema) return;
      
      const xPos = baseXPos + index * xSpacing;
      
      // Create node for property
      const propNode = createPropertyNode(propName, propSchema, required, xPos, baseYPos);
      
      // Add indicator if this node might have children that would exceed depth
      if ((propSchema.type === 'object' && propSchema.properties) || 
          (propSchema.type === 'array' && propSchema.items && 
           propSchema.items.type === 'object')) {
        propNode.data.hasMoreChildren = currentDepth + 1 >= options.maxDepth;
      }
      
      // Add edge from parent to property
      const edge = createEdge(parentId, propNode.id);
      
      result.nodes.push(propNode);
      result.edges.push(edge);
      
      // If the property is an object with nested properties
      if (propSchema.type === 'object' && propSchema.properties) {
        const nestedProps = propSchema.properties;
        const nestedRequired = propSchema.required || [];
        const nestedYOffset = baseYPos + 150;
        
        // Update the parent node data with property count
        propNode.data.properties = Object.keys(nestedProps).length;
        
        // Process nested properties if within depth limit or explicitly expanded
        if (currentDepth < options.maxDepth || options.expandedNodes.includes(propNode.id)) {
          // Calculate nested properties positioning
          const totalNestedWidth = Object.keys(nestedProps).length * (xSpacing * 0.8);
          let nestedXOffset = xPos - totalNestedWidth / 2 + (xSpacing * 0.8) / 2;
          
          // Recursively process the nested properties
          processProperties(
            propNode.id,
            nestedProps,
            nestedRequired,
            nestedXOffset,
            nestedYOffset,
            currentDepth + 1
          );
        }
      }
      
      // If the property is an array, add its items
      if (propSchema.type === 'array' && propSchema.items) {
        const itemSchema = propSchema.items;
        
        // Update the parent node with minItems/maxItems if defined
        propNode.data.minItems = propSchema.minItems;
        propNode.data.maxItems = propSchema.maxItems;
        
        // Process array items if within depth limit or explicitly expanded
        if (currentDepth < options.maxDepth || options.expandedNodes.includes(propNode.id)) {
          // Create node for array items
          const itemNode = createArrayItemNode(propNode.id, itemSchema, xPos, baseYPos + 150);
          
          // Add edge from array to items
          const itemsEdge = createEdge(propNode.id, itemNode.id, 'items');
          
          result.nodes.push(itemNode);
          result.edges.push(itemsEdge);
          
          // If the array item is an object, process its properties
          if (itemSchema.type === 'object' && itemSchema.properties) {
            const itemProps = itemSchema.properties;
            const itemRequired = itemSchema.required || [];
            
            // Recursively process the item properties
            processProperties(
              itemNode.id,
              itemProps,
              itemRequired,
              xPos - (Object.keys(itemProps).length * xSpacing * 0.8) / 2,
              baseYPos + 300,
              currentDepth + 2
            );
          }
        }
      }
    });
  };
  
  // Start processing from the root level (depth 1)
  processProperties('root', properties, requiredProps, xOffset, yOffset, 1);
  
  return result;
};
