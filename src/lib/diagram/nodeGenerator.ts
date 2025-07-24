
import { Node } from '@xyflow/react';
import { PropertyDetails } from './types';

export const createRootNode = (schema: any): Node => {
  return {
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
};

export const createGroupNode = (
  parentId: string, 
  properties: Record<string, any>, 
  requiredProps: string[], 
  yPosition: number
): Node => {
  const groupNodeId = parentId === 'root' ? 'props' : `${parentId}-props`;
  
  return {
    id: groupNodeId,
    type: 'schemaType',
    position: { x: 0, y: yPosition },
    data: {
      label: parentId === 'root' ? 'Properties' : 'Nested Properties',
      type: 'object',
      isGroup: true,
      properties: Object.keys(properties).length,
      propertyDetails: Object.entries(properties).map(([name, prop]: [string, any]) => ({
        name,
        type: prop.type || (prop.$ref ? 'reference' : 'unknown'),
        required: requiredProps.includes(name),
        format: prop.format,
        description: prop.description,
        reference: prop.$ref
      } as PropertyDetails))
    }
  };
};

export const createArrayNode = (
  groupNodeId: string,
  propName: string,
  propSchema: any,
  yPosition: number
): Node => {
  const arrayNodeId = `${groupNodeId}-${propName}-array`;
  
  return {
    id: arrayNodeId,
    type: 'schemaType',
    position: { x: -200, y: yPosition },
    data: {
      label: `${propName} (Array)`,
      type: 'array',
      minItems: propSchema.minItems,
      maxItems: propSchema.maxItems
    }
  };
};

export const createPropertyNode = (
  propName: string,
  propSchema: any,
  requiredProps: string[],
  xPos: number,
  yOffset: number
): Node => {
  const nodeId = `prop-${propName}`;
  
  // Detect additional properties (excluding standard JSON Schema properties)
  const standardProps = ['type', 'description', 'properties', 'items', 'required', 'format', 
                        'minItems', 'maxItems', '$ref', 'enum', 'const', 'examples', 'default',
                        'minimum', 'maximum', 'pattern', 'minLength', 'maxLength', 'additionalProperties'];
  
  const additionalProps = Object.entries(propSchema)
    .filter(([key]) => !standardProps.includes(key))
    .map(([key, value]) => ({
      name: key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value)
    }));

  console.log(`Creating node for ${propName}:`, {
    propSchema: Object.keys(propSchema),
    additionalProps,
    additionalPropsCount: additionalProps.length
  });

  return {
    id: nodeId,
    type: 'schemaType',
    position: { x: xPos, y: yOffset },
    data: {
      label: propName,
      type: propSchema.type || 'object', // Default to object for OAS refs
      description: propSchema.description,
      required: requiredProps.includes(propName),
      format: propSchema.format,
      additionalProperties: additionalProps,
      additionalPropsCount: additionalProps.length,
      hasCollapsibleContent: (propSchema.type === 'object' && propSchema.properties) || 
                            (propSchema.type === 'array' && propSchema.items)
    }
  };
};

export const createNestedPropertyNode = (
  parentNodeId: string,
  nestedName: string,
  nestedSchema: any,
  nestedRequired: string[],
  nestedXPos: number,
  nestedYOffset: number
): Node => {
  const nestedNodeId = `${parentNodeId}-${nestedName}`;
  
  return {
    id: nestedNodeId,
    type: 'schemaType',
    position: { x: nestedXPos, y: nestedYOffset },
    data: {
      label: nestedName,
      type: nestedSchema.type || 'unknown',
      description: nestedSchema.description,
      required: nestedRequired.includes(nestedName),
      format: nestedSchema.format
    }
  };
};

export const createArrayItemNode = (
  parentNodeId: string,
  itemSchema: any,
  xPos: number,
  yOffset: number
): Node => {
  const itemNodeId = `${parentNodeId}-items`;
  
  return {
    id: itemNodeId,
    type: 'schemaType',
    position: { x: xPos, y: yOffset + 150 },
    data: {
      label: 'Array Item',
      type: itemSchema.type || (itemSchema.$ref ? 'reference' : 'unknown'),
      description: itemSchema.description,
      format: itemSchema.format,
      reference: itemSchema.$ref
    }
  };
};
