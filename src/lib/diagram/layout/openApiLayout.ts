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
  createConsolidatedResponseNode
} from '../nodeGenerator';
import { createEdge } from '../edgeGenerator';

// OpenAPI 3.1 required structure properties
const OPENAPI_REQUIRED_PROPERTIES = ['openapi', 'info', 'paths'];
const OPENAPI_OPTIONAL_PROPERTIES = ['servers', 'components', 'security', 'tags', 'externalDocs'];

export const generateOpenApiLayout = (
  schema: any, 
  maxDepth: number,
  collapsedPaths: CollapsedState = {}
): DiagramElements => {
  console.log(`🔥 [OPENAPI LAYOUT] Starting with maxDepth: ${maxDepth}`);
  console.log(`🔥 [OPENAPI LAYOUT] CollapsedPaths:`, collapsedPaths);
  console.log(`🔥 [OPENAPI LAYOUT] Schema keys:`, Object.keys(schema));
  console.log(`🔥 [OPENAPI LAYOUT] Schema paths:`, schema.paths ? Object.keys(schema.paths) : 'none');
  
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };

  if (!schema || !isOpenApiSchema(schema)) {
    console.log(`[OPENAPI LAYOUT] Early return - not a valid OpenAPI schema`);
    return result;
  }

  // Check if root itself is collapsed
  const rootCollapsed = collapsedPaths['root'] !== false;
  
  // If root is collapsed, we should skip generating child nodes
  if (rootCollapsed) {
    console.log('Root is collapsed, skipping OpenAPI structure generation');
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
  
  console.log(`🔥 [OPENAPI LAYOUT] Root collapsed: ${rootCollapsed}`);
  console.log(`🔥 [OPENAPI LAYOUT] Has expanded OpenAPI properties: ${hasExpandedOpenApiProps}`);
  console.log(`🔥 [OPENAPI LAYOUT] Should show OpenAPI structure: ${shouldShowOpenApiStructure}`);
  console.log(`🔥 [OPENAPI LAYOUT] Expanded OpenAPI paths:`, 
    Object.keys(collapsedPaths)
      .filter(path => path.startsWith('root.') && !path.startsWith('root.properties') && path !== 'root')
      .map(path => ({ path, expanded: collapsedPaths[path] === false }))
  );
  
  // Process OpenAPI properties if root is expanded or if we have specific expanded properties
  if (shouldShowOpenApiStructure) {
    console.log('[OPENAPI LAYOUT] Root properties are explicitly expanded, processing OpenAPI structure');
    
    let yOffset = 150;
    const nodeSpacing = 400;
    
    // Create special nodes for info, paths, and components based on collapsed state
    const specialNodes = [];
    
    // Create Info node if info exists and is not collapsed
    if (schema.info) {
      const infoPath = 'root.info';
      const infoCollapsed = collapsedPaths[infoPath] === true;
      
      console.log(`[OPENAPI LAYOUT] Info path: ${infoPath}, collapsed: ${infoCollapsed}`);
      
      if (!infoCollapsed) {
        const infoNode = createInfoNode(schema.info, -400, yOffset);
        const infoEdge = createEdge('root', infoNode.id, undefined, false, {}, 'default');
        result.nodes.push(infoNode);
        result.edges.push(infoEdge);
        specialNodes.push('info');
        console.log(`[OPENAPI LAYOUT] Created info node with ID: ${infoNode.id}`);
        console.log(`[OPENAPI LAYOUT] Created info edge:`, infoEdge);
      }
    }
    
    // Create Components node if components.schemas exists and is not collapsed
    if (schema.components?.schemas) {
      const componentsPath = 'root.components';
      const componentsCollapsed = collapsedPaths[componentsPath] === true;
      
      console.log(`[OPENAPI LAYOUT] Components path: ${componentsPath}, collapsed: ${componentsCollapsed}`);
      
      if (!componentsCollapsed) {
        const componentsNode = createComponentsNode(schema.components.schemas, 0, yOffset);
        const componentsEdge = createEdge('root', componentsNode.id, undefined, false, {}, 'default');
        result.nodes.push(componentsNode);
        result.edges.push(componentsEdge);
        specialNodes.push('components');
        console.log(`[OPENAPI LAYOUT] Created components node with ID: ${componentsNode.id}`);
        console.log(`[OPENAPI LAYOUT] Created components edge:`, componentsEdge);
        
        // Create individual schema nodes connected to components if components.schemas is expanded
        const componentsSchemasPath = 'root.components.schemas';
        const componentsSchemasExpanded = collapsedPaths[componentsSchemasPath] === false;
        
        console.log(`[OPENAPI LAYOUT] Components schemas path: ${componentsSchemasPath}, expanded: ${componentsSchemasExpanded}`);
        
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
    
    // Create Paths container box when showing OpenAPI structure
    if (schema.paths) {
      const pathsPath = 'root.paths';
      const pathsExplicitlyExpanded = collapsedPaths[pathsPath] === false || 
        (collapsedPaths[pathsPath] && typeof collapsedPaths[pathsPath] === 'object');
      
      console.log(`🔥 [OPENAPI LAYOUT] Paths path: ${pathsPath}, explicitly expanded: ${pathsExplicitlyExpanded}`);
      
      if (!pathsExplicitlyExpanded) {
        // Show Paths container box (when root.paths is NOT explicitly expanded)
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
        console.log(`🔥 [OPENAPI LAYOUT] Created paths container node with ID: ${pathsContainerNode.id}`);
      } else {
        // Show individual endpoint boxes (when root.paths IS explicitly expanded)
        console.log(`🔥 [OPENAPI LAYOUT] Creating individual endpoint boxes instead of container`);
        processOpenApiPaths(
          schema.paths,
          'root', // Connect directly to root instead of paths container
          400,
          yOffset, // Same level as other OpenAPI structure boxes
          200,
          result,
          maxDepth,
          collapsedPaths,
          'root.paths'
        );
        console.log(`🔥 [OPENAPI LAYOUT] Processed individual paths`);
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
  } else {
    console.log('[OPENAPI LAYOUT] No OpenAPI properties are expanded, skipping OpenAPI structure');
  }
  
  console.log(`[OPENAPI LAYOUT] Finished - generated ${result.nodes.length} nodes, ${result.edges.length} edges`);
  
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
  const schemaNames = Object.keys(schemas);
  const startX = xPos - (schemaNames.length * xSpacing) / 2 + xSpacing / 2;
  
  schemaNames.forEach((schemaName, index) => {
    const schemaValue = schemas[schemaName];
    const schemaX = startX + index * xSpacing;
    const schemaPath = `${parentPath}.${schemaName}`;
    
    const isSchemaCollapsed = collapsedPaths[schemaPath] === true;
    
    console.log(`[OPENAPI LAYOUT] Processing schema ${schemaName}, path: ${schemaPath}, collapsed: ${isSchemaCollapsed}`);
    
    // Only create schema node if it's not collapsed
    if (!isSchemaCollapsed) {
      // Treat this as a regular JSON schema
      const schemaNode = createPropertyNode(
        schemaName,
        schemaValue,
        [],
        schemaX,
        yPos,
        false // Don't mark as collapsed since we're already checking
      );
      
      const edge = createEdge(parentNodeId, schemaNode.id, undefined, false, {}, 'structure');
      
      result.nodes.push(schemaNode);
      result.edges.push(edge);
      
      console.log(`[OPENAPI LAYOUT] Created schema node for ${schemaName}`);
      
      // If the schema has properties and properties are expanded, process them as regular JSON schema
      if (schemaValue?.type === 'object' && schemaValue?.properties && maxDepth > 1) {
        const schemaPropertiesPath = `${schemaPath}.properties`;
        const schemaPropertiesExpanded = collapsedPaths[schemaPropertiesPath] === false;
        
        console.log(`[OPENAPI LAYOUT] Schema ${schemaName} properties path: ${schemaPropertiesPath}, expanded: ${schemaPropertiesExpanded}`);
        
        if (schemaPropertiesExpanded) {
          processJsonSchemaProperties(
            schemaValue.properties,
            schemaValue.required || [],
            schemaNode.id,
            schemaX,
            yPos + 150,
            xSpacing * 0.8,
            result,
            maxDepth - 1,
            collapsedPaths,
            schemaPath
          );
        }
      }
    }
  });
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
  parentPath: string
) {
  const propNames = Object.keys(properties);
  const startX = xPos - (propNames.length * xSpacing) / 2 + xSpacing / 2;
  
  propNames.forEach((propName, index) => {
    const propSchema = properties[propName];
    const propX = startX + index * xSpacing;
    const propPath = `${parentPath}.properties.${propName}`;
    
    const isPropCollapsed = collapsedPaths[propPath] === true;
    
    const propNode = createPropertyNode(
      propName,
      propSchema,
      required,
      propX,
      yPos,
      isPropCollapsed
    );
    
    const edge = createEdge(parentNodeId, propNode.id);
    
    result.nodes.push(propNode);
    result.edges.push(edge);
    
    // Recursively process nested properties if not collapsed and within depth
    if (!isPropCollapsed && maxDepth > 0) {
      if (propSchema?.type === 'object' && propSchema?.properties) {
        const nestedPropertiesPath = `${propPath}.properties`;
        const nestedPropertiesExpanded = collapsedPaths[nestedPropertiesPath] === false;
        
        if (nestedPropertiesExpanded) {
          processJsonSchemaProperties(
            propSchema.properties,
            propSchema.required || [],
            propNode.id,
            propX,
            yPos + 150,
            xSpacing * 0.8,
            result,
            maxDepth - 1,
            collapsedPaths,
            propPath
          );
        }
      }
    }
  });
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
  console.log(`🔥 [OPENAPI LAYOUT] Processing paths:`, Object.keys(paths));
  
  const pathNames = Object.keys(paths);
  const startX = xPos - (pathNames.length * xSpacing) / 2 + xSpacing / 2;
  
  pathNames.forEach((pathName, pathIndex) => {
    const pathData = paths[pathName];
    const pathX = startX + pathIndex * xSpacing;
    const individualPathPath = `${parentPath}.${pathName}`;
    
    // Check if this individual path is expanded
    const isIndividualPathExpanded = collapsedPaths[individualPathPath] === false || 
      (collapsedPaths[individualPathPath] && typeof collapsedPaths[individualPathPath] === 'object');
    
    console.log(`🔥 [OPENAPI LAYOUT] Path "${pathName}": expanded=${isIndividualPathExpanded}`);
    
    if (isIndividualPathExpanded) {
      // EXPANDED MODE: Show individual method boxes for this path
      console.log(`🔥 [OPENAPI LAYOUT] Creating individual method boxes for path: ${pathName}`);
      
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
          
          console.log(`🔥 [OPENAPI LAYOUT] Created individual method node: ${method.toUpperCase()} ${pathName}`);
          
          // Process responses and request bodies for individual method nodes
          processMethodDetails(methodData, methodNode, methodX, yPos, result, collapsedPaths, methodPath);
        }
      });
    } else {
      // CONSOLIDATED MODE: Show single endpoint box with all methods
      console.log(`🔥 [OPENAPI LAYOUT] Creating consolidated endpoint box for path: ${pathName}`);
      
      const endpointNode = createEndpointNode(
        pathName,
        pathData,
        pathX,
        yPos
      );
      
      const edge = createEdge(parentNodeId, endpointNode.id, undefined, false, {}, 'default');
      
      result.nodes.push(endpointNode);
      result.edges.push(edge);
      
      console.log(`🔥 [OPENAPI LAYOUT] Created consolidated endpoint node for: ${pathName}`);
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
      
      console.log(`🔥 [OPENAPI LAYOUT] Created request body node for method`);
      
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
    
    console.log(`🔥 [OPENAPI LAYOUT] Responses path: ${responsesPath}, expanded: ${responsesExpanded}`);
    
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
          
          console.log(`🔥 [OPENAPI LAYOUT] Created individual response node for ${statusCode}`);
          
          // Check if the schema property is expanded for this response
          const schemaPath = `${methodPath}.responses.${statusCode}.content.application/json.schema`;
          const schemaExpanded = collapsedPaths[schemaPath] === false || 
            (collapsedPaths[schemaPath] && typeof collapsedPaths[schemaPath] === 'object');
          
          console.log(`🔥 [OPENAPI LAYOUT] Schema path: ${schemaPath}, expanded: ${schemaExpanded}`);
          
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
        console.log(`🔥 [OPENAPI LAYOUT] Creating consolidated response box`);
        
        const consolidatedResponseNode = createConsolidatedResponseNode(
          methodData.responses,
          methodX + 200,
          yPos + 150
        );
        
        const responseEdge = createEdge(methodNode.id, consolidatedResponseNode.id, undefined, false, {}, 'default');
        
        result.nodes.push(consolidatedResponseNode);
        result.edges.push(responseEdge);
        
        console.log(`🔥 [OPENAPI LAYOUT] Created consolidated response node`);
        
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
      console.log(`🔥 [OPENAPI LAYOUT] Created dotted reference edge from ${sourceNodeId} to ${componentNodeId}`);
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

// Process generic OpenAPI objects
function processGenericOpenApiObject(
  obj: Record<string, any>,
  parentNodeId: string,
  xPos: number,
  yPos: number,
  xSpacing: number,
  result: DiagramElements,
  maxDepth: number,
  collapsedPaths: CollapsedState,
  parentPath: string
) {
  const objPropertiesPath = `${parentPath}.properties`;
  const objPropertiesExpanded = collapsedPaths[objPropertiesPath] === false;
  
  if (!objPropertiesExpanded) {
    return;
  }
  
  const objProps = Object.keys(obj);
  const startX = xPos - (objProps.length * xSpacing) / 2 + xSpacing / 2;
  
  objProps.forEach((propName, index) => {
    const propValue = obj[propName];
    const propX = startX + index * xSpacing;
    const propPath = `${parentPath}.properties.${propName}`;
    
    const isPropCollapsed = collapsedPaths[propPath] === true;
    
    const propSchema = createOpenApiPropertySchema(propName, propValue);
    
    const propNode = createPropertyNode(
      propName,
      propSchema,
      [],
      propX,
      yPos,
      isPropCollapsed
    );
    
    const edge = createEdge(parentNodeId, propNode.id);
    
    result.nodes.push(propNode);
    result.edges.push(edge);
  });
}