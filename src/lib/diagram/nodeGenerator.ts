
import { Node, Edge } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { DiagramElements, PropertyDetails } from './types';

// Constants for layout
const BASE_X_OFFSET = 200;
const BASE_Y_OFFSET = 100;
const X_OFFSET = 300;
const Y_OFFSET = 150;
const COLUMNS_PER_ROW = 3;

// Helper function to generate a unique ID
const uniqueId = () => uuidv4();

// Helper function to determine the type of a schema
const determineType = (schema: any): string => {
  if (schema.$ref) return 'reference';
  if (schema.type) return schema.type;
  if (schema.properties) return 'object';
  if (schema.items) return 'array';
  return 'unknown';
};

// Helper function to create an edge
export const createEdge = (source: string, target: string): Edge => {
  return {
    id: `edge-${source}-${target}`,
    source: source,
    target: target,
    type: 'smoothstep',
    animated: true,
  };
};

// Add the jsonPath to the node data
export const createRootNode = (schema: any, basePath: string = ''): Node => {
  const { type, title, description, properties } = schema;
  const nodeId = 'root';

  return {
    id: nodeId,
    type: 'schemaType',
    position: { x: 0, y: 0 },
    data: {
      label: title || 'Root Schema',
      type: type || 'object',
      description,
      isRoot: true,
      properties: properties ? Object.keys(properties).length : 0,
      jsonPath: basePath || 'root'  // Add the JSON path
    }
  };
};

export const createPropertyNode = (
  propertyName: string,
  propertySchema: any,
  x: number,
  y: number,
  required: boolean = false,
  basePath: string = ''
): Node => {
  const hasProperties = propertySchema.properties !== undefined;
  
  // Create the JSON path for this property
  const jsonPath = basePath 
    ? `${basePath}.properties.${propertyName}` 
    : `properties.${propertyName}`;
  
  return {
    id: `${propertyName}-${uniqueId()}`,
    type: 'schemaType',
    position: { x, y },
    data: {
      label: propertyName,
      type: propertySchema.type || determineType(propertySchema),
      description: propertySchema.description,
      format: propertySchema.format,
      required,
      reference: propertySchema.$ref,
      properties: hasProperties ? Object.keys(propertySchema.properties).length : undefined,
      minItems: propertySchema.minItems,
      maxItems: propertySchema.maxItems,
      jsonPath   // Add the JSON path
    }
  };
};

export const createGroupNode = (
  groupName: string,
  properties: { [key: string]: any },
  required: string[] = [],
  x: number,
  y: number,
  basePath: string = ''
): Node => {
  const propertyDetails: PropertyDetails[] = Object.entries(properties).map(([key, schema]) => ({
    name: key,
    type: schema.type || determineType(schema),
    required: required.includes(key),
    format: schema.format,
    description: schema.description,
    reference: schema.$ref,
  }));
  
  // Create the JSON path for this group
  const jsonPath = basePath 
    ? `${basePath}.properties` 
    : 'properties';

  return {
    id: `group-${groupName}-${uniqueId()}`,
    type: 'schemaType',
    position: { x, y },
    data: {
      label: `${groupName} Properties`,
      type: 'object',
      isGroup: true,
      propertyDetails: propertyDetails,
      jsonPath   // Add the JSON path
    }
  };
};

// Add the missing functions for the tests
export const createArrayNode = (
  parentId: string,
  propertyName: string,
  propertySchema: any,
  y: number
): Node => {
  return {
    id: `${parentId}-${propertyName}-array`,
    type: 'schemaType',
    position: { x: -200, y },
    data: {
      label: `${propertyName} (Array)`,
      type: 'array',
      minItems: propertySchema.minItems,
      maxItems: propertySchema.maxItems,
      jsonPath: `${parentId}.${propertyName}`
    }
  };
};

export const createNestedPropertyNode = (
  parentId: string,
  propertyName: string,
  propertySchema: any,
  y: number,
  required: boolean = false
): Node => {
  return {
    id: `${parentId}-${propertyName}`,
    type: 'schemaType',
    position: { x: 0, y },
    data: {
      label: propertyName,
      type: propertySchema.type || determineType(propertySchema),
      description: propertySchema.description,
      format: propertySchema.format,
      required,
      reference: propertySchema.$ref,
      jsonPath: `${parentId}.properties.${propertyName}`
    }
  };
};

export const createArrayItemNode = (
  parentId: string,
  itemSchema: any
): Node => {
  return {
    id: `${parentId}-items`,
    type: 'schemaType',
    position: { x: 0, y: 300 },
    data: {
      label: 'Array Item',
      type: itemSchema.type || determineType(itemSchema),
      description: itemSchema.description,
      jsonPath: `${parentId}.items`
    }
  };
};
