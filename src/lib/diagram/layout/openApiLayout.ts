import { Node, Edge } from '@xyflow/react';
import { DiagramElements, CollapsedState } from '../types';
import { 
  createPropertyNode, 
  createNestedPropertyNode, 
  createArrayItemNode,
  createInfoNode,
  createEndpointNode,
  createComponentsNode,
  createMethodNode,
  createResponseNode,
  createRequestBodyNode,
  createConsolidatedResponseNode,
  createGroupedPropertiesNode
} from '../nodeGenerator';
import { createEdge } from '../edgeGenerator';
import { processWithGrouping, processPropertiesWithGrouping } from '../utils/propertyGroupingUtils';

// OpenAPI 3.1 required structure properties
const OPENAPI_REQUIRED_PROPERTIES = ['openapi', 'info', 'paths'];
const OPENAPI_OPTIONAL_PROPERTIES = ['servers', 'components', 'security', 'tags', 'externalDocs'];

export const generateOpenApiLayout = (
  schema: any, 
  maxDepth: number,
  collapsedPaths: CollapsedState = {}
): DiagramElements => {
  
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };

  if (!schema || !isOpenApiSchema(schema)) {
    return result;
  }

  // Check if root itself is collapsed - it should default to expanded (false) if not set
  const rootCollapsed = collapsedPaths['root'] === true;
  
  // If root is collapsed, we should skip generating child nodes
  if (rootCollapsed) {
    return result;
  }
  
  // For OpenAPI schemas, when root is expanded, we should show the OpenAPI structure
  // Check if we have any expanded OpenAPI properties OR if root is simply expanded (making properties visible)
  const hasExpandedOpenApiProps = Object.keys(collapsedPaths).some(path => 
    path.startsWith('root.') && 
    !path.startsWith('root.properties') && 
    path !== 'root' &&
    collapsedPaths[path] === false
  );
  
  // If root is expanded (not collapsed), we should show OpenAPI structure boxes
  const shouldShowOpenApiStructure = !rootCollapsed || hasExpandedOpenApiProps;
  
  
  // Process OpenAPI properties if root is expanded or if we have specific expanded properties
  if (shouldShowOpenApiStructure) {
    
    let yOffset = 150;
    const nodeSpacing = 400;
    
    // Create special nodes for info, paths, and components based on collapsed state
    const specialNodes = [];
    
    // Always create Info node when showing OpenAPI structure (regardless of individual collapse state)
    if (schema.info) {
      const infoPath = 'root.info';
      const infoExplicitlyExpanded = collapsedPaths[infoPath] === false || 
        (collapsedPaths[infoPath] && typeof collapsedPaths[infoPath] === 'object');
      
      // Always create info box when showing OpenAPI structure
      const infoNode = createInfoNode(schema.info, -400, yOffset);
      const infoEdge = createEdge('root', infoNode.id, undefined, false, {}, 'default');
      result.nodes.push(infoNode);
      result.edges.push(infoEdge);
      specialNodes.push('info');
      
      // If info is explicitly expanded, process its internal structure (if any)
      // Note: Info typically doesn't have expandable children, but keeping this for consistency
    }
    
    // Always create Components node when showing OpenAPI structure (regardless of individual collapse state)
    if (schema.components?.schemas) {
      const componentsPath = 'root.components';
      const componentsExplicitlyExpanded = collapsedPaths[componentsPath] === false || 
        (collapsedPaths[componentsPath] && typeof collapsedPaths[componentsPath] === 'object');
      
      // Always create components box when showing OpenAPI structure
      const componentsNode = createComponentsNode(schema.components.schemas, 0, yOffset);
      const componentsEdge = createEdge('root', componentsNode.id, undefined, false, {}, 'default');
      result.nodes.push(componentsNode);
      result.edges.push(componentsEdge);
      specialNodes.push('components');
      
      // Only create individual schema nodes if components is explicitly expanded
      if (componentsExplicitlyExpanded) {
        // Create individual schema nodes connected to components if components.schemas is expanded
        const componentsSchemasPath = 'root.components.schemas';
        const componentsSchemasExpanded = collapsedPaths[componentsSchemasPath] === false;
        
        
        
        if (componentsSchemasExpanded) {
          processComponentsSchemas(
            schema.components.schemas,
            componentsNode.id,
            0,
            yOffset + 200,
            200,
            result,
            maxDepth,
            collapsedPaths,
            'root.components.schemas'
          );
        }
      }
    }
    
    // Always create Paths container box when showing OpenAPI structure
    if (schema.paths) {
      const pathsPath = 'root.paths';
      const pathsExplicitlyExpanded = collapsedPaths[pathsPath] === false || 
        (collapsedPaths[pathsPath] && typeof collapsedPaths[pathsPath] === 'object');
      
      
      
      // Always create the Paths container box
      const pathsContainerNode = createPropertyNode(
        'Paths',
        { 
          type: 'object', 
          description: `API endpoints (${Object.keys(schema.paths).length} endpoints)`,
          properties: schema.paths
        },
        [],
        400,
        yOffset,
        false
      );
      
      const pathsContainerEdge = createEdge('root', pathsContainerNode.id, undefined, false, {}, 'default');
      result.nodes.push(pathsContainerNode);
      result.edges.push(pathsContainerEdge);
      
      // If paths is explicitly expanded, also create individual endpoint boxes connected to the container
      if (pathsExplicitlyExpanded) {
        processOpenApiPaths(
          schema.paths,
          pathsContainerNode.id, // Connect to paths container
          400,
          yOffset + 200, // Position below the paths container
          200,
          result,
          maxDepth,
          collapsedPaths,
          'root.paths'
        );
      }
    }
    
    // Process any other top-level properties that aren't special
    const processedProps = ['info', 'paths', 'components', 'openapi', 'swagger'];
    const otherProps = Object.keys(schema).filter(prop => !processedProps.includes(prop));
    
    if (otherProps.length > 0) {
      processOtherOpenApiProperties(
        schema,
        otherProps,
        -600,
        yOffset + 300,
        200,
        result,
        maxDepth,
        collapsedPaths
      );
    }
  }
  
  return result;
};

// Check if schema is an OpenAPI schema
function isOpenApiSchema(schema: any): boolean {
  return schema && 
         typeof schema === 'object' && 
         (schema.openapi || schema.swagger) &&
         (schema.info || schema.paths);
}

// Create a pseudo-schema for OpenAPI properties
function createOpenApiPropertySchema(propertyName: string, propertyValue: any) {
  if (propertyValue === null || propertyValue === undefined) {
    return { type: 'null', description: `OpenAPI ${propertyName}` };
  }
  
  if (Array.isArray(propertyValue)) {
    return { 
      type: 'array', 
      description: `OpenAPI ${propertyName} array`,
      items: { type: 'object' }
    };
  }
  
  if (typeof propertyValue === 'object') {
    const propCount = Object.keys(propertyValue).length;
    return { 
      type: 'object', 
      description: `OpenAPI ${propertyName} (${propCount} properties)`,
      properties: propertyValue
    };
  }
  
  return { 
    type: typeof propertyValue, 
    description: `OpenAPI ${propertyName}`,
    default: propertyValue
  };
}

// Process components.schemas - these should be treated as JSON schemas
function processComponentsSchemas(
  schemas: Record<string, any>,
  parentNodeId: string,
  xPos: number,
  yPos: number,
  xSpacing: number,
  result: DiagramElements,
  maxDepth: number,
  collapsedPaths: CollapsedState,
  parentPath: string
) {
  // Count how many schemas are already individually expanded
  const schemaEntries = Object.entries(schemas);
  const expandedSchemasCount = schemaEntries.filter(([schemaName]) => {
    const schemaPath = `${parentPath}.${schemaName}`;
    return collapsedPaths[schemaPath] === false; // explicitly expanded
  }).length;
  
  // Only group if we're not showing individual expanded schemas
  const shouldGroup = expandedSchemasCount === 0 && schemaEntries.length > 5;
  
  const groupingResult = processWithGrouping(
    schemas,
    parentNodeId,
    xPos,
    yPos,
    xSpacing,
    result,
    5, // Max individual schemas before grouping
    collapsedPaths,
    parentPath,
    [] // schemas don't have required props
  );
  
  
  
  return;
}

// Process regular JSON schema properties (used for components.schemas)
function processJsonSchemaProperties(
  properties: Record<string, any>,
  required: string[],
  parentNodeId: string,
  xPos: number,
  yPos: number,
  xSpacing: number,
  result: DiagramElements,
  maxDepth: number,
  collapsedPaths: CollapsedState,
  parentPath: string,
  allSchemas?: Record<string, any> // Pass all schemas to detect references
) {
  // Use property grouping utility instead of processing individually
  const groupingResult = processPropertiesWithGrouping(
    properties,
    required,
    result,
    {
      maxIndividualProperties: 6, // Allow more individual properties for schema properties
      xSpacing,
      parentNodeId,
      parentPath: `${parentPath}.properties`,
      yPosition: yPos,
      startXPosition: xPos
    }
  );
  
  
  
  // Handle schema references for created nodes
  if (allSchemas) {
    result.nodes.forEach(node => {
      if (node.id.startsWith('prop-') && node.data?.schema) {
        const referencedSchemaName = extractSchemaReference(node.data.schema);
        if (referencedSchemaName && allSchemas[referencedSchemaName]) {
          // Find the target schema node using the correct ID format
          const targetSchemaNodeId = `prop-${referencedSchemaName}`;
          
          // Create dotted reference edge
          const referenceEdge = createEdge(
            node.id, 
            targetSchemaNodeId, 
            'references',
            false,
            {},
            'reference'
          );
          
          result.edges.push(referenceEdge);
        }
      }
    });
  }
}

// Process OpenAPI paths structure - handles both consolidated and expanded views
function processOpenApiPaths(
  paths: Record<string, any>,
  parentNodeId: string,
  xPos: number,
  yPos: number,
  xSpacing: number,
  result: DiagramElements,
  maxDepth: number,
  collapsedPaths: CollapsedState,
  parentPath: string
) {
  
  
  const pathNames = Object.keys(paths);
  const startX = xPos - (pathNames.length * xSpacing) / 2 + xSpacing / 2;
  
  pathNames.forEach((pathName, pathIndex) => {
    const pathData = paths[pathName];
    const pathX = startX + pathIndex * xSpacing;
    const individualPathPath = `${parentPath}.${pathName}`;
    
    // Check if this individual path is expanded
    const isIndividualPathExpanded = collapsedPaths[individualPathPath] === false || 
      (collapsedPaths[individualPathPath] && typeof collapsedPaths[individualPathPath] === 'object');
    
    
    
    if (isIndividualPathExpanded) {
      // EXPANDED MODE: Show individual method boxes for this path
      
      const methods = Object.entries(pathData || {})
        .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase()));
      
      const methodStartX = pathX - (methods.length * 150) / 2 + 75;
      
      methods.forEach(([method, methodData], methodIndex) => {
        const methodX = methodStartX + methodIndex * 150;
        const methodPath = `${individualPathPath}.${method.toLowerCase()}`;
        
        // Check if this specific method is collapsed
        const isMethodCollapsed = collapsedPaths[methodPath] === true;
        
        if (!isMethodCollapsed) {
          const methodNode = createMethodNode(
            pathName,
            method.toLowerCase(),
            methodData,
            methodX,
            yPos
          );
          
          const edge = createEdge(parentNodeId, methodNode.id, undefined, false, {}, 'default');
          
          result.nodes.push(methodNode);
          result.edges.push(edge);
          
          // Process responses and request bodies for individual method nodes
          processMethodDetails(methodData, methodNode, methodX, yPos, result, collapsedPaths, methodPath);
        }
      });
    } else {
      // CONSOLIDATED MODE: Show single endpoint box with all methods
      
      const endpointNode = createEndpointNode(
        pathName,
        pathData,
        pathX,
        yPos
      );
      
      const edge = createEdge(parentNodeId, endpointNode.id, undefined, false, {}, 'default');
      
      result.nodes.push(endpointNode);
      result.edges.push(edge);
    }
  });
}

// Helper function to process method details (responses, request bodies, references)
function processMethodDetails(
  methodData: any,
  methodNode: any,
  methodX: number,
  yPos: number,
  result: DiagramElements,
  collapsedPaths: CollapsedState,
  methodPath: string
) {
  let responseOffset = 0;
  
  // Process request body if it has application/json content
  if (methodData.requestBody?.content?.['application/json']) {
    const requestBodyPath = `${methodPath}.requestBody`;
    const requestBodyExpanded = collapsedPaths[requestBodyPath] === false || 
      (collapsedPaths[requestBodyPath] && typeof collapsedPaths[requestBodyPath] === 'object');
    
    if (requestBodyExpanded) {
      const requestBodyNode = createRequestBodyNode(
        methodData.requestBody,
        methodX - 200,
        yPos + 150
      );
      
      const requestBodyEdge = createEdge(methodNode.id, requestBodyNode.id, undefined, false, {}, 'default');
      
      result.nodes.push(requestBodyNode);
      result.edges.push(requestBodyEdge);
      
      // Process request body schema if expanded
      const requestBodySchema = methodData.requestBody.content['application/json'].schema;
      if (requestBodySchema) {
        const schemaPath = `${requestBodyPath}.content.application/json.schema`;
        const schemaExpanded = collapsedPaths[schemaPath] === false || 
          (collapsedPaths[schemaPath] && typeof collapsedPaths[schemaPath] === 'object');
        
        if (schemaExpanded) {
          const schemaNode = createPropertyNode(
            'Schema',
            requestBodySchema,
            [],
            methodX - 400,
            yPos + 150,
            false
          );
          
          const schemaEdge = createEdge(requestBodyNode.id, schemaNode.id, undefined, false, {}, 'default');
          
          result.nodes.push(schemaNode);
          result.edges.push(schemaEdge);
          
          // Handle references for request body schema
          handleSchemaReferences(requestBodySchema, schemaNode.id, result);
        }
      }
    }
  }
  
  // Process responses that have application/json content
  if (methodData.responses) {
    const responsesPath = `${methodPath}.responses`;
    const responsesExpanded = collapsedPaths[responsesPath] === false || 
      (collapsedPaths[responsesPath] && typeof collapsedPaths[responsesPath] === 'object');
    
    
    
    const responseEntries = Object.entries(methodData.responses)
      .filter(([_, responseData]: [string, any]) => 
        responseData?.content?.['application/json']
      );
    
    if (responseEntries.length > 0) {
      if (responsesExpanded) {
        // EXPANDED MODE: Show individual response boxes
        console.log(`🔥 [OPENAPI LAYOUT] Creating individual response boxes`);
        
        responseEntries.forEach(([statusCode, responseData]: [string, any], responseIndex) => {
          const responseNode = createResponseNode(
            statusCode,
            responseData,
            methodX + 200 + (responseIndex * 150),
            yPos + 150 + responseOffset
          );
          
          const responseEdge = createEdge(methodNode.id, responseNode.id, undefined, false, {}, 'default');
          
          result.nodes.push(responseNode);
          result.edges.push(responseEdge);
          
          // Check if the schema property is expanded for this response
          const schemaPath = `${methodPath}.responses.${statusCode}.content.application/json.schema`;
          const schemaExpanded = collapsedPaths[schemaPath] === false || 
            (collapsedPaths[schemaPath] && typeof collapsedPaths[schemaPath] === 'object');
          
          
          
          // If response has a schema and schema property is expanded, create a schema node
          const responseSchema = responseData.content['application/json'].schema;
          if (responseSchema && schemaExpanded) {
            const schemaNode = createPropertyNode(
              'Schema',
              responseSchema,
              [],
              methodX + 400 + (responseIndex * 150),
              yPos + 150 + responseOffset,
              false
            );
            
            const schemaEdge = createEdge(responseNode.id, schemaNode.id, undefined, false, {}, 'default');
            
            result.nodes.push(schemaNode);
            result.edges.push(schemaEdge);
            
            // Handle references for response schema
            handleSchemaReferences(responseSchema, schemaNode.id, result);
            
            console.log(`🔥 [OPENAPI LAYOUT] Created schema node for response ${statusCode}`);
          }
          
          responseOffset += 100;
        });
      } else {
        // CONSOLIDATED MODE: Show single consolidated response box
        
        const consolidatedResponseNode = createConsolidatedResponseNode(
          methodData.responses,
          methodX + 200,
          yPos + 150
        );
        
        const responseEdge = createEdge(methodNode.id, consolidatedResponseNode.id, undefined, false, {}, 'default');
        
        result.nodes.push(consolidatedResponseNode);
        result.edges.push(responseEdge);
        
        // For consolidated view, check if any response has references and create dotted edges
        responseEntries.forEach(([statusCode, responseData]: [string, any]) => {
          const responseSchema = responseData.content['application/json'].schema;
          if (responseSchema) {
            handleSchemaReferences(responseSchema, consolidatedResponseNode.id, result);
          }
        });
      }
    }
  }
}

// Helper function to handle schema references ($ref)
function handleSchemaReferences(schema: any, sourceNodeId: string, result: DiagramElements) {
  // Check for direct $ref
  if (schema.$ref) {
    createReferenceEdge(schema.$ref, sourceNodeId, result);
  }
  
  // Check for $ref in items (for arrays)
  if (schema.items?.$ref) {
    createReferenceEdge(schema.items.$ref, sourceNodeId, result);
  }
  
  // Check for $ref in properties
  if (schema.properties) {
    Object.values(schema.properties).forEach((prop: any) => {
      if (prop.$ref) {
        createReferenceEdge(prop.$ref, sourceNodeId, result);
      }
    });
  }
}

// Helper function to create a reference edge
function createReferenceEdge(ref: string, sourceNodeId: string, result: DiagramElements) {
  if (ref.includes('#/components/schemas/')) {
    const refPath = ref.replace('#/components/schemas/', '');
    const componentNodeId = `prop-${refPath}`;
    
    // Check if the referenced component node exists
    const existingComponentNode = result.nodes.find(node => node.id === componentNodeId);
    if (existingComponentNode) {
      const refEdge = createEdge(
        sourceNodeId,
        componentNodeId,
        undefined,
        false,
        { strokeDasharray: '5,5' },
        'default'
      );
      result.edges.push(refEdge);
    }
  }
}

// Process other OpenAPI properties generically
function processOtherOpenApiProperties(
  schema: Record<string, any>,
  otherProps: string[],
  xPos: number,
  yPos: number,
  xSpacing: number,
  result: DiagramElements,
  maxDepth: number,
  collapsedPaths: CollapsedState
) {
  const startX = xPos - (otherProps.length * xSpacing) / 2 + xSpacing / 2;
  
  otherProps.forEach((propName, index) => {
    const propValue = schema[propName];
    const propX = startX + index * xSpacing;
    const propPath = `root.${propName}`;
    
    const isPropCollapsed = collapsedPaths[propPath] === true;
    
    console.log(`[OPENAPI LAYOUT] Processing other property ${propName}, path: ${propPath}, collapsed: ${isPropCollapsed}`);
    
    // Only create node if it's not collapsed
    if (!isPropCollapsed) {
      const propSchema = createOpenApiPropertySchema(propName, propValue);
      
      const propNode = createPropertyNode(
        propName,
        propSchema,
        [],
        propX,
        yPos,
        false // Don't mark as collapsed since we're already checking
      );
      
      const edge = createEdge('root', propNode.id, undefined, false, {}, 'structure');
      
      result.nodes.push(propNode);
      result.edges.push(edge);
      
      console.log(`[OPENAPI LAYOUT] Created other property node for ${propName}`);
    }
  });
}

// Detect and create reference edges for $ref properties
function detectAndCreateReferences(
  obj: any,
  sourceNodeId: string,
  result: DiagramElements,
  xPos: number,
  yPos: number
): void {
  if (!obj || typeof obj !== 'object') return;
  
  const findReferences = (data: any, path: string[] = []): string[] => {
    const refs: string[] = [];
    
    if (data && typeof data === 'object') {
      if (data.$ref && typeof data.$ref === 'string') {
        refs.push(data.$ref);
      }
      
      Object.entries(data).forEach(([key, value]) => {
        refs.push(...findReferences(value, [...path, key]));
      });
    }
    
    return refs;
  };
  
  const references = findReferences(obj);
  
  references.forEach((ref, index) => {
    if (ref.includes('#/components/schemas/')) {
      const schemaName = ref.split('/').pop();
      if (schemaName) {
        const targetNodeId = `prop-${schemaName}`;
        
        // Create reference edge if target exists
        const referenceEdge = createEdge(
          sourceNodeId,
          targetNodeId,
          `ref: ${schemaName}`,
          false,
          {},
          'reference'
        );
        
        result.edges.push(referenceEdge);
      }
    }
  });
}

// Process OpenAPI info structure
function processOpenApiInfo(
  info: Record<string, any>,
  parentNodeId: string,
  xPos: number,
  yPos: number,
  xSpacing: number,
  result: DiagramElements,
  maxDepth: number,
  collapsedPaths: CollapsedState,
  parentPath: string
) {
  const infoPropertiesPath = `${parentPath}.properties`;
  const infoPropertiesExpanded = collapsedPaths[infoPropertiesPath] === false;
  
  if (!infoPropertiesExpanded) {
    return;
  }
  
  const infoProps = Object.keys(info);
  const startX = xPos - (infoProps.length * xSpacing) / 2 + xSpacing / 2;
  
  infoProps.forEach((propName, index) => {
    const propValue = info[propName];
    const propX = startX + index * xSpacing;
    const propPath = `${parentPath}.properties.${propName}`;
    
    const isPropCollapsed = collapsedPaths[propPath] === true;
    
    const propSchema = createOpenApiPropertySchema(propName, propValue);
    
    const propNode = createPropertyNode(
      propName,
      propSchema,
      ['title', 'version'], // Common required fields in info
      propX,
      yPos,
      isPropCollapsed
    );
    
    const edge = createEdge(parentNodeId, propNode.id);
    
    result.nodes.push(propNode);
    result.edges.push(edge);
  });
}

// Helper function to extract schema reference from a JSON schema property
function extractSchemaReference(propSchema: any): string | null {
  // Direct $ref
  if (propSchema?.$ref) {
    const match = propSchema.$ref.match(/#\/components\/schemas\/(.+)$/);
    return match ? match[1] : null;
  }
  
  // $ref in items (for arrays)
  if (propSchema?.items?.$ref) {
    const match = propSchema.items.$ref.match(/#\/components\/schemas\/(.+)$/);
    return match ? match[1] : null;
  }
  
  // $ref in allOf, anyOf, oneOf
  if (propSchema?.allOf?.[0]?.$ref) {
    const match = propSchema.allOf[0].$ref.match(/#\/components\/schemas\/(.+)$/);
    return match ? match[1] : null;
  }
  
  if (propSchema?.anyOf?.[0]?.$ref) {
    const match = propSchema.anyOf[0].$ref.match(/#\/components\/schemas\/(.+)$/);
    return match ? match[1] : null;
  }
  
  if (propSchema?.oneOf?.[0]?.$ref) {
    const match = propSchema.oneOf[0].$ref.match(/#\/components\/schemas\/(.+)$/);
    return match ? match[1] : null;
  }
  
  return null;
}