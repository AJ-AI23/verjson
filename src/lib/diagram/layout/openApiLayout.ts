import { Node, Edge } from '@xyflow/react';
import { DiagramElements, CollapsedState } from '../types';
import { 
  createPropertyNode, 
  createNestedPropertyNode, 
  createArrayItemNode,
  createInfoNode,
  createEndpointNode,
  createComponentsNode
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
  
  // Only process OpenAPI properties if root.properties is explicitly expanded
  if (rootPropertiesExpanded) {
    console.log('[OPENAPI LAYOUT] Root properties are explicitly expanded, processing OpenAPI structure');
    
    let yOffset = 150;
    const nodeSpacing = 400;
    
    // Create special nodes for info, paths, and components
    const specialNodes = [];
    
    // Create Info node if info exists
    if (schema.info) {
      const infoNode = createInfoNode(schema.info, -400, yOffset);
      const infoEdge = createEdge('root', infoNode.id, 'info', false, {}, 'structure');
      result.nodes.push(infoNode);
      result.edges.push(infoEdge);
      specialNodes.push('info');
    }
    
    // Create Components node if components.schemas exists
    if (schema.components?.schemas) {
      const componentsNode = createComponentsNode(schema.components.schemas, 0, yOffset);
      const componentsEdge = createEdge('root', componentsNode.id, 'components', false, {}, 'structure');
      result.nodes.push(componentsNode);
      result.edges.push(componentsEdge);
      specialNodes.push('components');
      
      // Create individual schema nodes connected to components
      processComponentsSchemas(
        schema.components.schemas,
        componentsNode.id,
        0,
        yOffset + 200,
        200,
        result,
        maxDepth,
        collapsedPaths,
        'root.properties.components'
      );
    }
    
    // Create Paths structure if paths exist
    if (schema.paths) {
      processOpenApiPaths(
        schema.paths,
        'root',
        400,
        yOffset,
        200,
        result,
        maxDepth,
        collapsedPaths,
        'root.properties.paths'
      );
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
    console.log('[OPENAPI LAYOUT] Root properties are not explicitly expanded, skipping OpenAPI structure');
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
  const schemasPropertiesPath = `${parentPath}.properties`;
  const schemasPropertiesExpanded = collapsedPaths[schemasPropertiesPath] === false;
  
  if (!schemasPropertiesExpanded) {
    console.log('Components.schemas properties not expanded, skipping');
    return;
  }
  
  const schemaNames = Object.keys(schemas);
  const startX = xPos - (schemaNames.length * xSpacing) / 2 + xSpacing / 2;
  
  schemaNames.forEach((schemaName, index) => {
    const schemaValue = schemas[schemaName];
    const schemaX = startX + index * xSpacing;
    const schemaPath = `${parentPath}.properties.${schemaName}`;
    
    const isSchemaCollapsed = collapsedPaths[schemaPath] === true;
    
    // Treat this as a regular JSON schema
    const schemaNode = createPropertyNode(
      schemaName,
      schemaValue,
      [],
      schemaX,
      yPos,
      isSchemaCollapsed
    );
    
    const edge = createEdge(parentNodeId, schemaNode.id);
    
    result.nodes.push(schemaNode);
    result.edges.push(edge);
    
    // If the schema has properties and is not collapsed, process them as regular JSON schema
    if (!isSchemaCollapsed && schemaValue?.type === 'object' && schemaValue?.properties && maxDepth > 1) {
      const schemaPropertiesPath = `${schemaPath}.properties`;
      const schemaPropertiesExpanded = collapsedPaths[schemaPropertiesPath] === false;
      
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

// Process OpenAPI paths structure - creates endpoint nodes
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
  
  pathNames.forEach((pathName, index) => {
    const pathValue = paths[pathName];
    const pathX = startX + index * xSpacing;
    
    // Create endpoint node instead of generic property node
    const endpointNode = createEndpointNode(pathName, pathValue, pathX, yPos);
    const edge = createEdge(parentNodeId, endpointNode.id, undefined, false, {}, 'structure');
    
    result.nodes.push(endpointNode);
    result.edges.push(edge);
    
    // TODO: Add reference detection for request/response schemas
    detectAndCreateReferences(pathValue, endpointNode.id, result, pathX, yPos + 150);
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
    const propPath = `root.properties.${propName}`;
    
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
    
    const edge = createEdge('root', propNode.id);
    
    result.nodes.push(propNode);
    result.edges.push(edge);
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