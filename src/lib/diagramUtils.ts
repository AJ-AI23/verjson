
import { Node, Edge } from '@xyflow/react';

interface DiagramElements {
  nodes: Node[];
  edges: Edge[];
}

export const generateNodesAndEdges = (schema: any): DiagramElements => {
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };

  if (!schema || !schema.type) {
    return result;
  }

  // Start with the root node
  const rootNode: Node = {
    id: 'root',
    type: 'schemaType',
    position: { x: 0, y: 0 },
    data: {
      label: schema.title || 'Root Schema',
      type: schema.type,
      description: schema.description,
      isRoot: true,
      properties: schema.properties ? Object.keys(schema.properties).length : 0
    }
  };

  result.nodes.push(rootNode);

  // Process properties if this is an object
  if (schema.type === 'object' && schema.properties) {
    const properties = schema.properties;
    const requiredProps = schema.required || [];
    
    let xOffset = -200;
    const yOffset = 150;
    const xSpacing = 200;
    
    // Calculate starting x position to center the nodes
    const totalWidth = Object.keys(properties).length * xSpacing;
    xOffset = -totalWidth / 2 + xSpacing / 2;
    
    Object.entries(properties).forEach(([propName, propSchema]: [string, any], index) => {
      const nodeId = `prop-${propName}`;
      const xPos = xOffset + index * xSpacing;
      
      // Create node for property
      const propNode: Node = {
        id: nodeId,
        type: 'schemaType',
        position: { x: xPos, y: yOffset },
        data: {
          label: propName,
          type: propSchema.type,
          description: propSchema.description,
          required: requiredProps.includes(propName),
          format: propSchema.format,
        }
      };
      
      // Add edge from root to property
      const edge: Edge = {
        id: `edge-root-${nodeId}`,
        source: 'root',
        target: nodeId,
        animated: false,
        style: { stroke: '#64748b' }
      };
      
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
          const nestedNodeId = `${nodeId}-${nestedName}`;
          const nestedXPos = nestedXOffset + nestedIndex * (xSpacing * 0.8);
          
          // Create node for nested property
          const nestedNode: Node = {
            id: nestedNodeId,
            type: 'schemaType',
            position: { x: nestedXPos, y: nestedYOffset },
            data: {
              label: nestedName,
              type: nestedSchema.type,
              description: nestedSchema.description,
              required: nestedRequired.includes(nestedName),
              format: nestedSchema.format
            }
          };
          
          // Add edge from parent property to nested property
          const nestedEdge: Edge = {
            id: `edge-${nodeId}-${nestedNodeId}`,
            source: nodeId,
            target: nestedNodeId,
            animated: false,
            style: { stroke: '#64748b' }
          };
          
          result.nodes.push(nestedNode);
          result.edges.push(nestedEdge);
        });
      }
      
      // If the property is an array, add its items
      if (propSchema.type === 'array' && propSchema.items) {
        const itemSchema = propSchema.items;
        const itemNodeId = `${nodeId}-items`;
        
        // Update the parent node with minItems/maxItems if defined
        propNode.data.minItems = propSchema.minItems;
        propNode.data.maxItems = propSchema.maxItems;
        
        // Create node for array items
        const itemNode: Node = {
          id: itemNodeId,
          type: 'schemaType',
          position: { x: xPos, y: yOffset + 150 },
          data: {
            label: 'Array Item',
            type: itemSchema.type,
            description: itemSchema.description,
            format: itemSchema.format
          }
        };
        
        // Add edge from array to items
        const itemsEdge: Edge = {
          id: `edge-${nodeId}-${itemNodeId}`,
          source: nodeId,
          target: itemNodeId,
          animated: false,
          label: 'items',
          style: { stroke: '#64748b' }
        };
        
        result.nodes.push(itemNode);
        result.edges.push(itemsEdge);
      }
    });
  }
  
  return result;
};
