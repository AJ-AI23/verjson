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
  createContentTypeNode,
  createConsolidatedContentTypeNode,
  createGroupedPropertiesNode,
  createServerNode,
  createTagNode,
  createGroupedServersNode,
  createGroupedTagsNode,
  createParametersNode,
  createTagsNode,
  createSecurityNode
} from '../nodeGenerator';
import { createEdge } from '../edgeGenerator';
import { processWithGrouping, processPropertiesWithGrouping } from '../utils/propertyGroupingUtils';
import { processArrayItemsWithGrouping } from '../utils/arrayItemGroupingUtils';

// OpenAPI 3.1 required structure properties
const OPENAPI_REQUIRED_PROPERTIES = ['openapi', 'info', 'paths'];
const OPENAPI_OPTIONAL_PROPERTIES = ['servers', 'components', 'security', 'tags', 'externalDocs'];

export const generateOpenApiLayout = (
  schema: any, 
  maxDepth: number,
  collapsedPaths: CollapsedState = {},
  maxIndividualProperties: number = 5,
  maxIndividualArrayItems: number = 4
): DiagramElements => {
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };

  if (!schema || !isOpenApiSchema(schema)) {
    return result;
  }

  // Check if root itself is collapsed
  const rootCollapsed = collapsedPaths['root'] !== false;
  
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
      
      // Always create info box when showing OpenAPI structure, pass expanded state
      const infoNode = createInfoNode(schema.info, -400, yOffset, infoExplicitlyExpanded);
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
      const componentsNode = createComponentsNode(schema.components.schemas, 0, yOffset, componentsExplicitlyExpanded);
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
            'root.components.schemas',
            maxIndividualProperties
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
        collapsedPaths,
        maxIndividualArrayItems
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
  parentPath: string,
  maxIndividualProperties: number = 5
) {
  console.log(`[OPENAPI LAYOUT] Processing ${Object.keys(schemas).length} schemas with grouping, maxIndividualProperties: ${maxIndividualProperties}`);
  
  // Count how many schemas are already individually expanded
  const schemaEntries = Object.entries(schemas);
  const expandedSchemasCount = schemaEntries.filter(([schemaName]) => {
    const schemaPath = `${parentPath}.${schemaName}`;
    return collapsedPaths[schemaPath] === false; // explicitly expanded
  }).length;
  
  // Only group if we're not showing individual expanded schemas
  const shouldGroup = expandedSchemasCount === 0 && schemaEntries.length > maxIndividualProperties;
  
  console.log('🔥 [OPENAPI LAYOUT] Schema grouping decision:', {
    parentPath,
    expandedSchemasCount,
    totalSchemas: schemaEntries.length,
    shouldGroup
  });
  
  // Track nodes before processing to identify newly created schema nodes
  const nodeCountBefore = result.nodes.length;
  
  const groupingResult = processWithGrouping(
    schemas,
    parentNodeId,
    xPos,
    yPos,
    xSpacing,
    result,
    maxIndividualProperties,
    collapsedPaths,
    parentPath,
    []
  );
  
  console.log(`[OPENAPI LAYOUT] Created ${groupingResult.totalNodesCreated} nodes for ${groupingResult.nodesProcessed} schemas`);
  
  // Get the newly created schema nodes
  const newSchemaNodes = result.nodes.slice(nodeCountBefore);
  
  // For each schema node, check if it has expanded properties and process them recursively
  newSchemaNodes.forEach((schemaNode) => {
    // Extract schema name from node ID (format: prop-SchemaName)
    const schemaName = schemaNode.id.replace('prop-', '');
    const schemaPath = `${parentPath}.${schemaName}`;
    const schemaData = schemas[schemaName];
    
    // Check if this schema is expanded
    const isSchemaExpanded = collapsedPaths[schemaPath] === false;
    
    // Apply expanded styling (dashed borders) when schema itself is expanded
    if (isSchemaExpanded) {
      schemaNode.data = {
        ...schemaNode.data,
        hasMoreLevels: true, // Show dashed border to indicate expanded state
      };
    }
    
    if (isSchemaExpanded && schemaData?.properties) {
      console.log(`🔥 [OPENAPI LAYOUT] Schema "${schemaName}" is expanded, checking properties expansion`);
      
      const propertiesPath = `${schemaPath}.properties`;
      const propertiesExpanded = collapsedPaths[propertiesPath] === false;
      
      // Find which individual properties are explicitly expanded
      const expandedPropertyNames = new Set<string>();
      Object.keys(collapsedPaths).forEach(path => {
        if (path.startsWith(`${propertiesPath}.`) && collapsedPaths[path] === false) {
          const propName = path.substring(`${propertiesPath}.`.length);
          // Only add if it's a direct property (not nested deeper)
          if (!propName.includes('.')) {
            expandedPropertyNames.add(propName);
          }
        }
      });
      
      const hasIndividualPropertyExpanded = expandedPropertyNames.size > 0;
      
      console.log(`🔥 [OPENAPI LAYOUT] Properties analysis for "${schemaName}":`, {
        propertiesExpanded,
        hasIndividualPropertyExpanded,
        expandedPropertyNames: Array.from(expandedPropertyNames)
      });
      
      if (propertiesExpanded) {
        // Properties container is expanded - show non-expanded properties inline
        const allPropertyNames = Object.keys(schemaData.properties);
        const nonExpandedProperties = allPropertyNames.filter(name => !expandedPropertyNames.has(name));
        
        console.log(`🔥 [OPENAPI LAYOUT] Properties for "${schemaName}": ${allPropertyNames.length} total, ${expandedPropertyNames.size} expanded, ${nonExpandedProperties.length} inline`);
        
        // Show non-expanded properties as a list inside the schema box
        if (nonExpandedProperties.length > 0) {
          const propertyDetails = nonExpandedProperties.map((propName) => {
            const propSchema = schemaData.properties[propName];
            return {
              name: propName,
              type: propSchema?.type || 'any',
              required: schemaData.required?.includes(propName) || false,
              format: propSchema?.format,
              description: propSchema?.description,
              reference: propSchema?.$ref
            };
          });
          
          // Update the schema node to include property details
          schemaNode.data = {
            ...schemaNode.data,
            propertyDetails,
            hasCollapsibleContent: true,
            isCollapsed: false,
          };
        }
        
        // Create separate boxes ONLY for explicitly expanded properties
        if (hasIndividualPropertyExpanded) {
          console.log(`🔥 [OPENAPI LAYOUT] Creating separate boxes for ${expandedPropertyNames.size} explicitly expanded properties`);
          
          // Filter to only include expanded properties
          const expandedPropertiesOnly = Object.fromEntries(
            Object.entries(schemaData.properties).filter(([propName]) => expandedPropertyNames.has(propName))
          );
          
          processJsonSchemaProperties(
            expandedPropertiesOnly,
            schemaData.required || [],
            schemaNode.id,
            schemaNode.position.x,
            schemaNode.position.y + 200,
            200,
            result,
            maxDepth,
            collapsedPaths,
            schemaPath,
            schemas,
            maxIndividualProperties
          );
        }
      }
    }
  });
  
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
  allSchemas?: Record<string, any>, // Pass all schemas to detect references
  maxIndividualProperties: number = 5
) {
  // Use property grouping utility instead of processing individually
  const groupingResult = processPropertiesWithGrouping(
    properties,
    required,
    result,
    {
      maxIndividualProperties: maxIndividualProperties + 1, // Allow more individual properties for schema properties
      xSpacing,
      parentNodeId,
      parentPath: `${parentPath}.properties`,
      yPosition: yPos,
      startXPosition: xPos
    }
  );
  
  console.log(`[OPENAPI LAYOUT] Created ${groupingResult.totalNodesCreated} property nodes for ${groupingResult.nodesProcessed} properties in schema`);
  
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
          console.log(`🔗 [REFERENCE] Created reference edge: ${node.id} -> ${referencedSchemaName}`);
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
  let yOffset = yPos + 150;
  const leftColumnX = methodX - 250;
  const rightColumnX = methodX + 250;
  
  // Process parameters if they exist
  const methodExpanded = collapsedPaths[methodPath] === false;
  
  if (methodData.parameters && methodData.parameters.length > 0 && methodExpanded) {
      const parametersNode = createParametersNode(
        methodData.parameters,
        leftColumnX,
        yOffset
      );
      
    const parametersEdge = createEdge(methodNode.id, parametersNode.id, undefined, false, {}, 'default');
    
    result.nodes.push(parametersNode);
    result.edges.push(parametersEdge);
    
    console.log(`🔥 [OPENAPI LAYOUT] Created parameters node for method`);
    yOffset += 120;
  }
  
  // Process tags if they exist
  if (methodData.tags && methodData.tags.length > 0 && methodExpanded) {
      const tagsNode = createTagsNode(
        methodData.tags,
        leftColumnX,
        yOffset
      );
      
    const tagsEdge = createEdge(methodNode.id, tagsNode.id, undefined, false, {}, 'default');
    
    result.nodes.push(tagsNode);
    result.edges.push(tagsEdge);
    
    console.log(`🔥 [OPENAPI LAYOUT] Created tags node for method`);
    yOffset += 100;
  }
  
  // Process security if it exists
  if (methodData.security && methodData.security.length > 0 && methodExpanded) {
      const securityNode = createSecurityNode(
        methodData.security,
        leftColumnX,
        yOffset
      );
      
    const securityEdge = createEdge(methodNode.id, securityNode.id, undefined, false, {}, 'default');
    
    result.nodes.push(securityNode);
    result.edges.push(securityEdge);
    
    console.log(`🔥 [OPENAPI LAYOUT] Created security node for method`);
  }
  
  // Reset yOffset for right column (request body and responses)
  yOffset = yPos + 150;
  
  // Process request body if it has application/json content
  if (methodData.requestBody?.content?.['application/json'] && methodExpanded) {
      const requestBodyNode = createRequestBodyNode(
        methodData.requestBody,
        rightColumnX,
        yOffset
      );
      
    const requestBodyEdge = createEdge(methodNode.id, requestBodyNode.id, undefined, false, {}, 'default');
    
    result.nodes.push(requestBodyNode);
    result.edges.push(requestBodyEdge);
    
    console.log(`🔥 [OPENAPI LAYOUT] Created request body node for method`);
    
    // Process request body schema if expanded
    const requestBodySchema = methodData.requestBody.content['application/json'].schema;
    if (requestBodySchema) {
      const requestBodyPath = `${methodPath}.requestBody`;
      const schemaPath = `${requestBodyPath}.content.application/json.schema`;
      const schemaExpanded = collapsedPaths[schemaPath] === false || 
        (collapsedPaths[schemaPath] && typeof collapsedPaths[schemaPath] === 'object');
      
      if (schemaExpanded) {
        const schemaNode = createPropertyNode(
          'Schema',
          requestBodySchema,
          [],
          rightColumnX + 200,
          yOffset,
          false
        );
        
        const schemaEdge = createEdge(requestBodyNode.id, schemaNode.id, undefined, false, {}, 'default');
        
        result.nodes.push(schemaNode);
        result.edges.push(schemaEdge);
        
        // Handle references for request body schema
        handleSchemaReferences(requestBodySchema, schemaNode.id, result);
      }
    }
    
    yOffset += 150;
  }
  
  // Process responses that have application/json content
  if (methodData.responses && methodExpanded) {
    const responsesPath = `${methodPath}.responses`;
    const responsesExpanded = collapsedPaths[responsesPath] === false;
    
    console.log(`🔥 [OPENAPI LAYOUT] Responses path: ${responsesPath}, responses expanded: ${responsesExpanded}`);
    
    const responseEntries = Object.entries(methodData.responses)
      .filter(([_, responseData]: [string, any]) => 
        responseData?.content?.['application/json']
      );
    
    if (responseEntries.length > 0) {
      // Always create a consolidated responses box first
      const allResponses: Record<string, any> = {};
      const unexpandedResponses: Record<string, any> = {};
      
      responseEntries.forEach(([statusCode, responseData]) => {
        allResponses[statusCode] = responseData;
      });
      
      if (responsesExpanded) {
        // RESPONSES EXPANDED: Check which individual responses are expanded
        console.log(`🔥 [OPENAPI LAYOUT] Responses expanded - checking for individual expansions`);
        
        responseEntries.forEach(([statusCode, responseData]) => {
          const individualResponsePath = `${responsesPath}.${statusCode}`;
          const responseExpanded = collapsedPaths[individualResponsePath] === false;
          
          if (!responseExpanded) {
            // Add to unexpanded responses
            unexpandedResponses[statusCode] = responseData;
          }
        });
        
        // Create consolidated box showing only unexpanded responses (or all if none expanded)
        const responsesToShow = Object.keys(unexpandedResponses).length > 0 ? unexpandedResponses : allResponses;
        const consolidatedResponseNode = createConsolidatedResponseNode(
          responsesToShow,
          rightColumnX,
          yOffset
        );
        
        // Add dashed border when responses are expanded
        consolidatedResponseNode.data = {
          ...consolidatedResponseNode.data,
          hasMoreLevels: true
        };
        
        const responseEdge = createEdge(methodNode.id, consolidatedResponseNode.id, undefined, false, {}, 'default');
        
        result.nodes.push(consolidatedResponseNode);
        result.edges.push(responseEdge);
        
        console.log(`🔥 [OPENAPI LAYOUT] Created consolidated response node with dashed border`);
        
        // Now create individual response boxes as children of the consolidated box
        let individualYOffset = yOffset + 150;
        responseEntries.forEach(([statusCode, responseData]: [string, any], responseIndex) => {
          const individualResponsePath = `${responsesPath}.${statusCode}`;
          const responseExpanded = collapsedPaths[individualResponsePath] === false;
          
          if (responseExpanded) {
            // Create individual response box connected to consolidated box
            const responseNode = createResponseNode(
              statusCode,
              responseData,
              rightColumnX + (responseIndex * 150),
              individualYOffset
            );
            
            // Connect to consolidated responses box, not method node
            const responseEdge = createEdge(consolidatedResponseNode.id, responseNode.id, undefined, false, {}, 'default');
            
            result.nodes.push(responseNode);
            result.edges.push(responseEdge);
            
            console.log(`🔥 [OPENAPI LAYOUT] Created individual response node for ${statusCode} as child of consolidated box`);
            
            // Process content types for this response
            const contentPath = `${individualResponsePath}.content`;
            const contentExpanded = collapsedPaths[contentPath] === false;
            
            if (responseData.content) {
              const contentTypes = Object.keys(responseData.content);
              const allContentTypes: Record<string, any> = {};
              const unexpandedContentTypes: Record<string, any> = {};
              
              contentTypes.forEach(contentType => {
                allContentTypes[contentType] = responseData.content[contentType];
              });
              
              if (contentExpanded) {
                // CONTENT EXPANDED: Check which individual content types are expanded
                console.log(`🔥 [OPENAPI LAYOUT] Content expanded for response ${statusCode} - checking for individual content type expansions`);
                
                contentTypes.forEach(contentType => {
                  const contentTypePath = `${contentPath}.${contentType}`;
                  const contentTypeExpanded = collapsedPaths[contentTypePath] === false;
                  
                  if (!contentTypeExpanded) {
                    unexpandedContentTypes[contentType] = responseData.content[contentType];
                  }
                });
                
                // Create consolidated content types box
                const contentTypesToShow = Object.keys(unexpandedContentTypes).length > 0 ? unexpandedContentTypes : allContentTypes;
                const consolidatedContentTypeNode = createConsolidatedContentTypeNode(
                  contentTypesToShow,
                  rightColumnX + (responseIndex * 150),
                  individualYOffset + 150
                );
                
                const contentTypeEdge = createEdge(responseNode.id, consolidatedContentTypeNode.id, undefined, false, {}, 'default');
                
                result.nodes.push(consolidatedContentTypeNode);
                result.edges.push(contentTypeEdge);
                
                console.log(`🔥 [OPENAPI LAYOUT] Created consolidated content type node for response ${statusCode}`);
                
                // Create individual content type boxes for expanded ones
                let contentTypeYOffset = individualYOffset + 300;
                contentTypes.forEach((contentType, ctIndex) => {
                  const contentTypePath = `${contentPath}.${contentType}`;
                  const contentTypeExpanded = collapsedPaths[contentTypePath] === false;
                  
                  if (contentTypeExpanded) {
                    // Check if schema is expanded
                    const schemaPath = `${contentTypePath}.schema`;
                    const schemaExpanded = collapsedPaths[schemaPath] === false;
                    
                    const contentTypeNode = createContentTypeNode(
                      contentType,
                      responseData.content[contentType],
                      rightColumnX + 200 + (responseIndex * 150) + (ctIndex * 100),
                      contentTypeYOffset,
                      schemaExpanded
                    );
                    
                    const ctEdge = createEdge(consolidatedContentTypeNode.id, contentTypeNode.id, undefined, false, {}, 'default');
                    
                    result.nodes.push(contentTypeNode);
                    result.edges.push(ctEdge);
                    
                    console.log(`🔥 [OPENAPI LAYOUT] Created individual content type node for ${contentType}`);
                    
                    // If schema is expanded, create schema node
                    if (schemaExpanded && responseData.content[contentType].schema) {
                      const schema = responseData.content[contentType].schema;
                      const schemaNode = createPropertyNode(
                        'Schema',
                        schema,
                        [],
                        rightColumnX + 400 + (responseIndex * 150) + (ctIndex * 100),
                        contentTypeYOffset,
                        false
                      );
                      
                      const schemaEdge = createEdge(contentTypeNode.id, schemaNode.id, undefined, false, {}, 'default');
                      
                      result.nodes.push(schemaNode);
                      result.edges.push(schemaEdge);
                      
                      handleSchemaReferences(schema, schemaNode.id, result);
                      
                      console.log(`🔥 [OPENAPI LAYOUT] Created schema node for content type ${contentType}`);
                    }
                  }
                });
              } else {
                // CONTENT NOT EXPANDED: Show single consolidated content types box
                console.log(`🔥 [OPENAPI LAYOUT] Creating consolidated content types box for response ${statusCode}`);
                
                const consolidatedContentTypeNode = createConsolidatedContentTypeNode(
                  allContentTypes,
                  rightColumnX + (responseIndex * 150),
                  individualYOffset + 150
                );
                
                const contentTypeEdge = createEdge(responseNode.id, consolidatedContentTypeNode.id, undefined, false, {}, 'default');
                
                result.nodes.push(consolidatedContentTypeNode);
                result.edges.push(contentTypeEdge);
                
                console.log(`🔥 [OPENAPI LAYOUT] Created consolidated content type node for response ${statusCode}`);
              }
            }
          }
        });
        
        // For consolidated view, check if any response has references and create dotted edges
        Object.entries(responsesToShow).forEach(([statusCode, responseData]: [string, any]) => {
          const responseSchema = responseData.content?.['application/json']?.schema;
          if (responseSchema) {
            handleSchemaReferences(responseSchema, consolidatedResponseNode.id, result);
          }
        });
        
        yOffset += 150;
      } else {
        // RESPONSES COLLAPSED: Show single consolidated box for all responses
        console.log(`🔥 [OPENAPI LAYOUT] Creating consolidated response box for all responses`);
        
        const consolidatedResponseNode = createConsolidatedResponseNode(
          allResponses,
          rightColumnX,
          yOffset
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
        
        yOffset += 150;
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
  collapsedPaths: CollapsedState,
  maxIndividualArrayItems: number = 4
) {
  const startX = xPos - (otherProps.length * xSpacing) / 2 + xSpacing / 2;
  
  otherProps.forEach((propName, index) => {
    const propValue = schema[propName];
    const propX = startX + index * xSpacing;
    const propPath = `root.${propName}`;
    
    const isPropCollapsed = collapsedPaths[propPath] === true;
    const isPropExpanded = collapsedPaths[propPath] === false;
    
    console.log(`[OPENAPI LAYOUT] Processing other property ${propName}, path: ${propPath}, collapsed: ${isPropCollapsed}, expanded: ${isPropExpanded}`);
    
    // Special handling for servers array - always show container node
    if (propName === 'servers' && Array.isArray(propValue)) {
      console.log(`🔥 [OPENAPI LAYOUT] Processing servers - expanded: ${isPropExpanded}, count: ${propValue.length}`);
      
      // Create a container node for servers
      const serversContainerNode = createPropertyNode(
        'servers',
        { 
          type: 'array', 
          description: `API servers (${propValue.length} servers)`,
          items: { type: 'object' }
        },
        [],
        propX,
        yPos,
        false
      );
      
      // Apply expanded/collapsed styling
      serversContainerNode.data = {
        ...serversContainerNode.data,
        hasMoreLevels: true,
        isCollapsed: !isPropExpanded
      };
      
      const containerEdge = createEdge('root', serversContainerNode.id, undefined, false, {}, 'structure');
      result.nodes.push(serversContainerNode);
      result.edges.push(containerEdge);
      
      // Only show individual server items if expanded
      if (isPropExpanded) {
        // Use grouping for server items
        processArrayItemsWithGrouping(
          propValue,
          result,
          {
            maxIndividualArrayItems,
            xSpacing: 300,
            parentNodeId: serversContainerNode.id,
            parentPath: propPath,
            yPosition: yPos + 200,
            startXPosition: propX,
            collapsedPaths
          },
          createServerNode,
          createGroupedServersNode
        );
        
        console.log(`🔥 [OPENAPI LAYOUT] Created server nodes with grouping`);
      }
    } else if (propName === 'tags' && Array.isArray(propValue)) {
      console.log(`🔥 [OPENAPI LAYOUT] Processing tags - expanded: ${isPropExpanded}, count: ${propValue.length}`);
      
      // Create a container node for tags
      const tagsContainerNode = createPropertyNode(
        'tags',
        { 
          type: 'array', 
          description: `API tags (${propValue.length} tags)`,
          items: { type: 'object' }
        },
        [],
        propX,
        yPos,
        false
      );
      
      // Apply expanded/collapsed styling
      tagsContainerNode.data = {
        ...tagsContainerNode.data,
        hasMoreLevels: true,
        isCollapsed: !isPropExpanded
      };
      
      const containerEdge = createEdge('root', tagsContainerNode.id, undefined, false, {}, 'structure');
      result.nodes.push(tagsContainerNode);
      result.edges.push(containerEdge);
      
      // Only show individual tag items if expanded
      if (isPropExpanded) {
        // Use grouping for tag items
        processArrayItemsWithGrouping(
          propValue,
          result,
          {
            maxIndividualArrayItems,
            xSpacing: 300,
            parentNodeId: tagsContainerNode.id,
            parentPath: propPath,
            yPosition: yPos + 200,
            startXPosition: propX,
            collapsedPaths
          },
          createTagNode,
          createGroupedTagsNode
        );
        
        console.log(`🔥 [OPENAPI LAYOUT] Created tag nodes with grouping`);
      }
    } else if (!isPropCollapsed) {
      // Default handling for other properties - only create node if not collapsed
      const propSchema = createOpenApiPropertySchema(propName, propValue);
      
      const propNode = createPropertyNode(
        propName,
        propSchema,
        [],
        propX,
        yPos,
        false
      );
      
      // Apply expanded styling if expanded
      if (isPropExpanded) {
        propNode.data = {
          ...propNode.data,
          hasMoreLevels: true,
          isCollapsed: false
        };
      }
      
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