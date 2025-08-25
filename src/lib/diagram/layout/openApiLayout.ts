import { Node, Edge } from '@xyflow/react';
import { DiagramElements, CollapsedState } from '../types';
import { 
  createPropertyNode, 
  createNestedPropertyNode, 
  createArrayItemNode,
  createInfoNode,
  createEndpointNode,
  createComponentsNode,
  createMethodNode
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
  console.log(`[OPENAPI LAYOUT] Starting with maxDepth: ${maxDepth}`);
  console.log(`[OPENAPI LAYOUT] CollapsedPaths:`, collapsedPaths);
  
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
  
  // Check if root.properties is explicitly expanded
  const rootPropertiesPath = 'root.properties';
  const rootPropertiesExpanded = collapsedPaths[rootPropertiesPath] === false;
  
  console.log(`[OPENAPI LAYOUT] Root properties path: ${rootPropertiesPath}, expanded: ${rootPropertiesExpanded}`);
  
  // For OpenAPI schemas, we don't use root.properties path, we use direct paths like root.info, root.paths
  // Check if we have any expanded OpenAPI properties
  const hasExpandedOpenApiProps = Object.keys(collapsedPaths).some(path => 
    path.startsWith('root.') && 
    !path.startsWith('root.properties') && 
    path !== 'root' &&
    collapsedPaths[path] === false
  );
  
  console.log(`[OPENAPI LAYOUT] Has expanded OpenAPI properties: ${hasExpandedOpenApiProps}`);
  
  // Process OpenAPI properties if we have any expanded ones
  if (hasExpandedOpenApiProps) {
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
    
    // Create Paths structure if paths exist and is not collapsed
    if (schema.paths) {
      const pathsPath = 'root.paths';
      const pathsCollapsed = collapsedPaths[pathsPath] === true;
      
      console.log(`[OPENAPI LAYOUT] Paths path: ${pathsPath}, collapsed: ${pathsCollapsed}`);
      
      if (!pathsCollapsed) {
        // Create a Paths container node first
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
        console.log(`[OPENAPI LAYOUT] Created paths container node with ID: ${pathsContainerNode.id}`);
        console.log(`[OPENAPI LAYOUT] Created paths container edge:`, pathsContainerEdge);
        
        // Then create individual endpoint nodes connected to the paths container
        processOpenApiPaths(
          schema.paths,
          pathsContainerNode.id, // Connect to paths container instead of root
          400,
          yOffset + 200, // Position below the paths container
          200,
          result,
          maxDepth,
          collapsedPaths,
          'root.paths'
        );
        console.log(`[OPENAPI LAYOUT] Processed individual paths`);
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

// Process OpenAPI paths structure - creates individual method nodes
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
  // Collect all individual methods from all paths
  const allMethods: Array<{
    path: string;
    method: string;
    methodData: any;
    fullLabel: string;
  }> = [];
  
  Object.entries(paths).forEach(([pathName, pathValue]) => {
    if (typeof pathValue === 'object' && pathValue !== null) {
      Object.entries(pathValue).forEach(([method, methodData]) => {
        if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())) {
          allMethods.push({
            path: pathName,
            method: method.toLowerCase(),
            methodData,
            fullLabel: `${method.toUpperCase()} ${pathName}`
          });
        }
      });
    }
  });
  
  const startX = xPos - (allMethods.length * xSpacing) / 2 + xSpacing / 2;
  
  allMethods.forEach((methodEntry, index) => {
    const methodX = startX + index * xSpacing;
    const methodPath = `${parentPath}.${methodEntry.path}.${methodEntry.method}`;
    
    // Check if this specific method is collapsed
    const isMethodCollapsed = collapsedPaths[methodPath] === true;
    
    console.log(`[OPENAPI LAYOUT] Processing method ${methodEntry.fullLabel}, path: ${methodPath}, collapsed: ${isMethodCollapsed}`);
    
    // Only create method node if it's not collapsed
    if (!isMethodCollapsed) {
      // Create individual method node
      const methodNode = createMethodNode(
        methodEntry.path,
        methodEntry.method,
        methodEntry.methodData,
        methodX,
        yPos
      );
      
      const edge = createEdge(parentNodeId, methodNode.id, undefined, false, {}, 'default');
      
      result.nodes.push(methodNode);
      result.edges.push(edge);
      
      console.log(`[OPENAPI LAYOUT] Created method node for ${methodEntry.fullLabel}`);
      
      // Add reference detection for request/response schemas
      detectAndCreateReferences(methodEntry.methodData, methodNode.id, result, methodX, yPos + 150);
    }
  });
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