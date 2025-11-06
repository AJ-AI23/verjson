
import { Node } from '@xyflow/react';
import { PropertyDetails } from './types';
import { extractNotations, getNotationCount, STANDARD_SCHEMA_PROPS } from './notationUtils';

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
  // Extract notations for root schema
  const notations = extractNotations(schema);
  const notationCount = getNotationCount(schema);
  
  console.log('createRootNode - notations:', {
    notations,
    notationCount,
    hasNotations: notationCount > 0,
    schemaKeys: Object.keys(schema)
  });
  
  return {
    id: 'root',
    type: 'schemaType',
    position: { x: 0, y: 0 },
    data: {
      label: schema.title || 'Root Schema',
      type: schema.type,
      description: schema.description,
      isRoot: true,
      properties: schema.properties ? Object.keys(schema.properties).length : 0,
      notations: notations,
      notationCount: notationCount,
      hasNotations: notationCount > 0
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
  
  // Extract notations
  const notations = extractNotations(propSchema);
  const notationCount = getNotationCount(propSchema);
  
  // Detect additional properties (excluding standard JSON Schema properties and $notations)
  const additionalProps = Object.entries(propSchema)
    .filter(([key]) => !STANDARD_SCHEMA_PROPS.includes(key))
    .map(([key, value]) => ({
      name: key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value)
    }));

  console.log(`Creating node for ${propName}:`, {
    propSchema: Object.keys(propSchema),
    additionalProps,
    additionalPropsCount: additionalProps.length,
    notations,
    notationCount,
    hasNotations: notationCount > 0,
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
      notations: notations,
      notationCount: notationCount,
      hasNotations: notationCount > 0,
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
  // Extract notations from info data
  const notations = extractNotations(infoData);
  const notationCount = getNotationCount(infoData);
  
  const properties = Object.entries(infoData)
    .filter(([key]) => !['title', 'version', '$notations'].includes(key))
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
      properties,
      notations: notations,
      notationCount: notationCount,
      hasNotations: notationCount > 0
    }
  };
};

export const createEndpointNode = (
  path: string,
  pathData: any,
  xPos: number,
  yOffset: number
): Node => {
  // Extract notations from pathData
  const notations = extractNotations(pathData);
  const notationCount = getNotationCount(pathData);
  
  const methods = Object.entries(pathData)
    .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase()))
    .map(([method, methodData]: [string, any]) => ({
      method: method.toLowerCase(),
      summary: methodData.summary,
      description: methodData.description,
      requestBody: methodData.requestBody,
      responses: methodData.responses
    }));

  // Create a label that shows all methods for consolidated view
  const methodLabels = methods.map(m => m.method.toUpperCase()).join(' ');
  const nodeLabel = methods.length > 0 ? `${methodLabels} ${path}` : path;

  return {
    id: `endpoint-${path.replace(/[^\w]/g, '-')}`,
    type: 'endpoint',
    position: { x: xPos, y: yOffset },
    data: {
      path,
      methods,
      label: nodeLabel, // Add explicit label for the endpoint
      notations: notations,
      notationCount: notationCount,
      hasNotations: notationCount > 0
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
  // Extract notations from methodData
  const notations = extractNotations(methodData);
  const notationCount = getNotationCount(methodData);
  
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
      label: methodLabel,
      notations: notations,
      notationCount: notationCount,
      hasNotations: notationCount > 0
    }
  };
};

export const createServerNode = (
  serverData: any,
  index: number,
  xPos: number,
  yOffset: number,
  isExpanded?: boolean
): Node => {
  // Extract notations from server data
  const notations = extractNotations(serverData);
  const notationCount = getNotationCount(serverData);
  
  const url = serverData.url || 'No URL';
  const description = serverData.description || '';
  const variables = serverData.variables ? Object.keys(serverData.variables) : [];
  
  return {
    id: `server-${index}`,
    type: 'schemaType',
    position: { x: xPos, y: yOffset },
    data: {
      label: `Server ${index + 1}`,
      type: 'server',
      nodeType: 'server',
      url,
      description,
      variables,
      notations: notations,
      notationCount: notationCount,
      hasNotations: notationCount > 0,
      hasMoreLevels: isExpanded // Add dashed border when expanded
    }
  };
};

export const createTagNode = (
  tagData: any,
  index: number,
  xPos: number,
  yOffset: number,
  isExpanded?: boolean
): Node => {
  // Extract notations from tag data
  const notations = extractNotations(tagData);
  const notationCount = getNotationCount(tagData);
  
  const name = tagData.name || `Tag ${index + 1}`;
  const description = tagData.description || '';
  const hasExternalDocs = !!tagData.externalDocs;
  
  return {
    id: `tag-${index}`,
    type: 'schemaType',
    position: { x: xPos, y: yOffset },
    data: {
      label: name,
      type: 'tag',
      nodeType: 'tag',
      tagName: name,
      description,
      hasExternalDocs,
      notations: notations,
      notationCount: notationCount,
      hasNotations: notationCount > 0,
      hasMoreLevels: isExpanded // Add dashed border when expanded
    }
  };
};

export const createGroupedServersNode = (
  groupedServers: any[],
  xPos: number,
  yOffset: number,
  parentNodeId: string
): Node => {
  const serverCount = groupedServers.length;
  
  return {
    id: `${parentNodeId}-grouped-servers`,
    type: 'schemaType',
    position: { x: xPos, y: yOffset },
    data: {
      label: `${serverCount} More Servers`,
      type: 'object',
      isGroupedItems: true,
      itemDetails: groupedServers.map((server, idx) => ({
        url: server.url || 'No URL',
        description: server.description || '',
        variables: server.variables ? Object.keys(server.variables).length : 0
      })),
      hasCollapsibleContent: true,
      isCollapsed: false,
      description: `View details of ${serverCount} grouped servers`
    }
  };
};

export const createGroupedTagsNode = (
  groupedTags: any[],
  xPos: number,
  yOffset: number,
  parentNodeId: string
): Node => {
  const tagCount = groupedTags.length;
  
  return {
    id: `${parentNodeId}-grouped-tags`,
    type: 'schemaType',
    position: { x: xPos, y: yOffset },
    data: {
      label: `${tagCount} More Tags`,
      type: 'object',
      isGroupedItems: true,
      itemDetails: groupedTags.map((tag) => ({
        name: tag.name || 'Unnamed',
        description: tag.description || '',
        hasExternalDocs: !!tag.externalDocs
      })),
      hasCollapsibleContent: true,
      isCollapsed: false,
      description: `View details of ${tagCount} grouped tags`
    }
  };
};

export const createComponentsNode = (
  schemasData: Record<string, any>,
  xPos: number,
  yOffset: number
): Node => {
  // Extract notations from the components section itself (if any)
  const notations = extractNotations(schemasData);
  const notationCount = getNotationCount(schemasData);
  
  const schemas = Object.entries(schemasData)
    .filter(([key]) => key !== '$notations') // Exclude $notations from schema list
    .map(([name, schema]: [string, any]) => ({
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
      schemas,
      notations: notations,
      notationCount: notationCount,
      hasNotations: notationCount > 0
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
  // Extract notations from responseData
  const notations = extractNotations(responseData);
  const notationCount = getNotationCount(responseData);
  
  const nodeId = `response-${statusCode}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: nodeId,
    type: 'response',
    position: { x, y },
    data: {
      statusCode,
      description: responseData?.description,
      schema: responseData?.content?.['application/json']?.schema,
      label: `Response ${statusCode}`,
      notations: notations,
      notationCount: notationCount,
      hasNotations: notationCount > 0
    }
  };
};

export const createConsolidatedResponseNode = (
  responses: Record<string, any>,
  x: number,
  y: number
): Node => {
  // Extract notations from the responses object itself (if any)
  const notations = extractNotations(responses);
  const notationCount = getNotationCount(responses);
  
  const statusCodes = Object.keys(responses).filter(code => 
    code !== '$notations' && responses[code]?.content?.['application/json']
  );
  
  const nodeId = `responses-consolidated-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: nodeId,
    type: 'response',
    position: { x, y },
    data: {
      statusCodes,
      responses,
      isConsolidated: true,
      label: `${statusCodes.length} Response${statusCodes.length !== 1 ? 's' : ''}`,
      notations: notations,
      notationCount: notationCount,
      hasNotations: notationCount > 0
    }
  };
};

export const createRequestBodyNode = (
  requestBodyData: any,
  x: number,
  y: number
): Node => {
  // Extract notations from requestBodyData
  const notations = extractNotations(requestBodyData);
  const notationCount = getNotationCount(requestBodyData);
  
  const nodeId = `request-body-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: nodeId,
    type: 'requestBody',
    position: { x, y },
    data: {
      description: requestBodyData?.description,
      required: requestBodyData?.required,
      schema: requestBodyData?.content?.['application/json']?.schema,
      label: 'Request Body',
      notations: notations,
      notationCount: notationCount,
      hasNotations: notationCount > 0
    }
  };
};

export const createGroupedPropertiesNode = (
  nodeId: string,
  properties: [string, any][],
  requiredProps: string[],
  xPos: number,
  yOffset: number
): Node => {
  const propertyDetails = properties.map(([name, prop]) => ({
    name,
    type: prop.type || (prop.$ref ? 'reference' : 'unknown'),
    required: requiredProps.includes(name),
    format: prop.format,
    description: prop.description,
    reference: prop.$ref
  }));

  return {
    id: nodeId,
    type: 'schemaType',
    position: { x: xPos, y: yOffset },
    data: {
      label: `${properties.length} More Properties`,
      type: 'grouped-properties',
      isGrouped: true,
      isGroupedProperties: true, // Special flag for enhanced styling
      propertyDetails: propertyDetails,
      hasCollapsibleContent: true,
      isCollapsed: false, // Grouped nodes show their content by default to display bullet points
      description: `View details of ${properties.length} grouped properties`
    }
  };
};
