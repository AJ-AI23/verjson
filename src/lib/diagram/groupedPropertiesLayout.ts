
import { Node, Edge } from '@xyflow/react';
import { DiagramElements } from './types';
import { createGroupNode, createArrayNode } from './nodeGenerator';
import { createEdge } from './edgeGenerator';

/**
 * Automatically calculates a grid-based layout for nodes at the same level
 * to prevent overlapping
 */
const calculateGridPositions = (
  objects: Array<{ id: string; size?: number }>,
  baseYPosition: number,
  levelWidth = 1000
): Record<string, { x: number; y: number }> => {
  const positions: Record<string, { x: number; y: number }> = {};
  
  // Calculate how many items we can fit per row
  const itemsPerRow = Math.min(4, objects.length); // Max 4 items per row
  const horizontalSpacing = levelWidth / itemsPerRow;
  
  objects.forEach((object, index) => {
    // Calculate row and column position
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;
    
    // Calculate x position: centered around 0 with appropriate spacing
    const xBase = -levelWidth / 2 + horizontalSpacing / 2;
    const xPosition = xBase + col * horizontalSpacing;
    
    // Calculate y position with 200px vertical spacing between rows
    const yPosition = baseYPosition + row * 200;
    
    positions[object.id] = { x: xPosition, y: yPosition };
  });
  
  return positions;
};

export const generateGroupedLayout = (schema: any): DiagramElements => {
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
  
  let yOffset = 150;
  const objectsToProcess = [
    { 
      parentId: 'root', 
      schema: { properties, required: requiredProps },
      yPosition: yOffset
    }
  ];
  
  // Process all objects in the schema
  while (objectsToProcess.length > 0) {
    const current = objectsToProcess.shift();
    if (!current) continue;
    
    const { parentId, schema: objSchema, yPosition } = current;
    const objProperties = objSchema.properties;
    const objRequired = objSchema.required || [];

    // Create a group node for all properties of this object
    const groupNode = createGroupNode(parentId, objProperties, objRequired, yPosition);
    result.nodes.push(groupNode);
    
    // Create edge from parent to group
    const edge = createEdge(parentId, groupNode.id);
    result.edges.push(edge);
    
    // Collect all nested objects and arrays at this level
    const nestedSchemas = [];
    
    // Process nested objects
    Object.entries(objProperties).forEach(([propName, propSchema]: [string, any]) => {
      if (propSchema && propSchema.type === 'object' && propSchema.properties) {
        // Add to nestedSchemas for layout calculation
        nestedSchemas.push({
          id: `${groupNode.id}-${propName}`,
          name: propName,
          schema: propSchema,
          type: 'object',
          size: Object.keys(propSchema.properties).length
        });
      }
      // Process arrays with object items
      else if (propSchema && propSchema.type === 'array' && propSchema.items && 
          propSchema.items.type === 'object' && propSchema.items.properties) {
        
        // Add to nestedSchemas for layout calculation
        nestedSchemas.push({
          id: `${groupNode.id}-${propName}`,
          name: propName,
          schema: propSchema,
          type: 'array',
          size: Object.keys(propSchema.items.properties).length
        });
      }
    });
    
    // Calculate grid positions for all nested items at this level
    const positions = calculateGridPositions(
      nestedSchemas, 
      yPosition + 150,
      Math.max(600, nestedSchemas.length * 200) // Dynamic level width based on number of items
    );
    
    // Now create nodes using the calculated positions
    nestedSchemas.forEach(item => {
      const position = positions[item.id];
      
      if (item.type === 'object') {
        // Queue this object for processing with its calculated position
        objectsToProcess.push({
          parentId: groupNode.id,
          schema: {
            properties: item.schema.properties,
            required: item.schema.required || []
          },
          yPosition: position.y + 150
        });
        
        // Create edge from group to next level group
        const objEdge = createEdge(groupNode.id, `${groupNode.id}-props`);
        result.edges.push(objEdge);
      } 
      else if (item.type === 'array') {
        // Create array node with calculated position
        const arrayNode = createArrayNode(groupNode.id, item.name, item.schema, position.y);
        // Apply calculated X position
        arrayNode.position.x = position.x;
        result.nodes.push(arrayNode);
        
        // Edge from group to array
        const arrayEdge = createEdge(groupNode.id, arrayNode.id);
        result.edges.push(arrayEdge);
        
        // Add the array's item object to process
        objectsToProcess.push({
          parentId: arrayNode.id,
          schema: {
            properties: item.schema.items.properties,
            required: item.schema.items.required || []
          },
          yPosition: position.y + 150
        });
      }
    });
  }
  
  return result;
};
