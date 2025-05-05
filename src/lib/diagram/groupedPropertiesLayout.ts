
import { Node, Edge } from '@xyflow/react';
import { DiagramElements } from './types';
import { createGroupNode, createArrayNode } from './nodeGenerator';
import { createEdge } from './edgeGenerator';

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
    
    // Process nested objects
    Object.entries(objProperties).forEach(([propName, propSchema]: [string, any], index) => {
      // Calculate horizontal offset for multiple objects at same level
      const xOffset = (index % 2 === 0) ? -200 : 200;
      
      if (propSchema && propSchema.type === 'object' && propSchema.properties) {
        // Create a dedicated node for this object property
        const objectNodeId = `${groupNode.id}-${propName}-object`;
        const objectNode = {
          id: objectNodeId,
          type: 'schemaType',
          position: { x: xOffset, y: yPosition + 150 },
          data: {
            label: `${propName} (Object)`,
            type: 'object',
            description: propSchema.description,
            properties: Object.keys(propSchema.properties).length
          }
        };
        result.nodes.push(objectNode);
        
        // Edge from group to object
        const objEdge = createEdge(groupNode.id, objectNodeId);
        result.edges.push(objEdge);
        
        // Queue this object for processing
        objectsToProcess.push({
          parentId: objectNodeId,
          schema: {
            properties: propSchema.properties,
            required: propSchema.required || []
          },
          yPosition: yPosition + 300
        });
      }
      
      // Process arrays with object items
      else if (propSchema && propSchema.type === 'array' && propSchema.items && 
          propSchema.items.type === 'object' && propSchema.items.properties) {
        
        const arrayNode = createArrayNode(groupNode.id, propName, propSchema, yPosition + 150);
        // Adjust position based on index to avoid overlapping
        arrayNode.position.x = xOffset;
        result.nodes.push(arrayNode);
        
        // Edge from group to array
        const arrayEdge = createEdge(groupNode.id, arrayNode.id);
        result.edges.push(arrayEdge);
        
        // Add the array's item object to process
        objectsToProcess.push({
          parentId: arrayNode.id,
          schema: {
            properties: propSchema.items.properties,
            required: propSchema.items.required || []
          },
          yPosition: yPosition + 300
        });
      }
    });
  }
  
  return result;
};
