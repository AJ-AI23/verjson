
import { Node } from '@xyflow/react';
import { PropertyDetails } from './types';

export const createRootNode = (schema: any): Node => {
  // Handle OpenAPI schemas differently
  const isOpenApiSchema = schema && 
                          typeof schema === 'object' && 
                          (schema.openapi || schema.swagger) &&
                          (schema.info || schema.paths);
  
  console.log('createRootNode - OpenAPI detection:', {
    hasOpenapi: !!schema.openapi,
    hasSwagger: !!schema.swagger,
    hasInfo: !!schema.info,
    hasPaths: !!schema.paths,
    isOpenApiSchema
  });
  
  if (isOpenApiSchema) {
    const version = schema.openapi || schema.swagger;
    const title = schema.info?.title || 'OpenAPI Specification';
    const description = schema.info?.description || `OpenAPI ${version} specification`;
    
    return {
      id: 'root',
      type: 'schemaType',
      position: { x: 0, y: 0 },
      data: {
        label: title,
        type: 'openapi',
        description: description,
        isRoot: true,
        properties: Object.keys(schema).length,
        version: version
      }
    };
  }
  
  // Handle regular JSON schemas
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
  yOffset: number,
  isCollapsed?: boolean
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
    additionalPropsCount: additionalProps.length,
    isCollapsed
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
      isCollapsed: isCollapsed,
      hasCollapsibleContent: (propSchema.type === 'object' && propSchema.properties) || 
                            (propSchema.type === 'array' && propSchema.items)
    }
  };
};

export const createInfoNode = (
  infoData: any,
  xPos: number,
  yOffset: number
): Node => {
  const properties = Object.entries(infoData)
    .filter(([key]) => !['title', 'version'].includes(key))
    .map(([key, value]) => ({
      name: key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      type: typeof value
    }));

  return {
    id: 'info-node',
    type: 'info',
    position: { x: xPos, y: yOffset },
    data: {
      title: infoData.title || 'API',
      version: infoData.version || '1.0.0',
      description: infoData.description,
      properties
    }
  };
};

export const createEndpointNode = (
  path: string,
  pathData: any,
  xPos: number,
  yOffset: number
): Node => {
  const methods = Object.entries(pathData)
    .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase()))
    .map(([method, methodData]: [string, any]) => ({
      method: method.toLowerCase(),
      summary: methodData.summary,
      description: methodData.description,
      requestBody: methodData.requestBody,
      responses: methodData.responses
    }));

  // Create a label that shows the main method and path
  const primaryMethod = methods.length > 0 ? methods[0].method.toUpperCase() : '';
  const nodeLabel = primaryMethod ? `${primaryMethod} ${path}` : path;

  return {
    id: `endpoint-${path.replace(/[^\w]/g, '-')}`,
    type: 'endpoint',
    position: { x: xPos, y: yOffset },
    data: {
      path,
      methods,
      label: nodeLabel // Add explicit label for the endpoint
    }
  };
};

export const createMethodNode = (
  path: string,
  method: string,
  methodData: any,
  xPos: number,
  yOffset: number
): Node => {
  const methodLabel = `${method.toUpperCase()} ${path}`;
  
  return {
    id: `method-${method}-${path.replace(/[^\w]/g, '-')}`,
    type: 'method',
    position: { x: xPos, y: yOffset },
    data: {
      path,
      method: method.toLowerCase(),
      summary: methodData.summary,
      description: methodData.description,
      requestBody: methodData.requestBody,
      responses: methodData.responses,
      label: methodLabel
    }
  };
};

export const createComponentsNode = (
  schemasData: Record<string, any>,
  xPos: number,
  yOffset: number
): Node => {
  const schemas = Object.entries(schemasData).map(([name, schema]) => ({
    name,
    type: schema?.type || 'object',
    description: schema?.description,
    propertiesCount: schema?.properties ? Object.keys(schema.properties).length : 0
  }));

  return {
    id: 'components-node',
    type: 'components',
    position: { x: xPos, y: yOffset },
    data: {
      schemasCount: schemas.length,
      schemas
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

export const createResponseNode = (
  statusCode: string,
  responseData: any,
  x: number,
  y: number
): Node => {
  const nodeId = `response-${statusCode}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: nodeId,
    type: 'response',
    position: { x, y },
    data: {
      statusCode,
      description: responseData?.description,
      schema: responseData?.content?.['application/json']?.schema,
      label: `Response ${statusCode}`
    }
  };
};

export const createRequestBodyNode = (
  requestBodyData: any,
  x: number,
  y: number
): Node => {
  const nodeId = `request-body-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: nodeId,
    type: 'requestBody',
    position: { x, y },
    data: {
      description: requestBodyData?.description,
      required: requestBodyData?.required,
      schema: requestBodyData?.content?.['application/json']?.schema,
      label: 'Request Body'
    }
  };
};
