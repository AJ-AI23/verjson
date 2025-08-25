import { Node, Edge } from '@xyflow/react';
import { DiagramElements, CollapsedState } from '../types';
import { 
  createPropertyNode, 
  createNestedPropertyNode, 
  createArrayItemNode 
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
    
    // Get all properties that exist in the schema
    const allProperties = Object.keys(schema);
    const requiredProperties = allProperties.filter(prop => 
      OPENAPI_REQUIRED_PROPERTIES.includes(prop) && schema[prop] !== undefined
    );
    const optionalProperties = allProperties.filter(prop => 
      OPENAPI_OPTIONAL_PROPERTIES.includes(prop) && schema[prop] !== undefined
    );
    const otherProperties = allProperties.filter(prop => 
      !OPENAPI_REQUIRED_PROPERTIES.includes(prop) && 
      !OPENAPI_OPTIONAL_PROPERTIES.includes(prop)
    );
    
    const visibleProperties = [...requiredProperties, ...optionalProperties, ...otherProperties];
    
    let xOffset = -200;
    const yOffset = 150;
    const xSpacing = 200;
    
    // Calculate starting x position to center the nodes
    const totalWidth = visibleProperties.length * xSpacing;
    xOffset = -totalWidth / 2 + xSpacing / 2;
    
    // Process each OpenAPI property
    visibleProperties.forEach((propName, index) => {
      const propValue = schema[propName];
      const xPos = xOffset + index * xSpacing;
      const propPath = `root.properties.${propName}`;
      
      // Check if this property is collapsed
      const isPropertyCollapsed = collapsedPaths[propPath] === true;
      
      // Create a pseudo-schema for the property
      const propSchema = createOpenApiPropertySchema(propName, propValue);
      
      console.log(`Creating OpenAPI property node for: ${propName}`, propSchema);
      
      // Create property node
      const propNode = createPropertyNode(
        propName, 
        propSchema, 
        OPENAPI_REQUIRED_PROPERTIES, 
        xPos, 
        yOffset, 
        isPropertyCollapsed
      );
      
      // Add edge from root to property
      const edge = createEdge('root', propNode.id);
      
      result.nodes.push(propNode);
      result.edges.push(edge);
      
      // Special handling for different OpenAPI properties
      if (!isPropertyCollapsed && maxDepth > 0) {
        if (propName === 'components' && propValue?.schemas) {
          // Handle components.schemas specially - these should be treated as JSON schemas
          processComponentsSchemas(
            propValue.schemas,
            propNode.id,
            xPos,
            yOffset + 150,
            xSpacing,
            result,
            maxDepth,
            collapsedPaths,
            propPath
          );
        } else if (propName === 'paths' && typeof propValue === 'object') {
          // Handle paths structure
          processOpenApiPaths(
            propValue,
            propNode.id,
            xPos,
            yOffset + 150,
            xSpacing,
            result,
            maxDepth,
            collapsedPaths,
            propPath
          );
        } else if (propName === 'info' && typeof propValue === 'object') {
          // Handle info structure
          processOpenApiInfo(
            propValue,
            propNode.id,
            xPos,
            yOffset + 150,
            xSpacing,
            result,
            maxDepth,
            collapsedPaths,
            propPath
          );
        } else if (typeof propValue === 'object' && propValue !== null) {
          // Handle other object properties generically
          processGenericOpenApiObject(
            propValue,
            propNode.id,
            xPos,
            yOffset + 150,
            xSpacing,
            result,
            maxDepth,
            collapsedPaths,
            propPath
          );
        }
      }
    });
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

// Process OpenAPI paths structure
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
  const pathsPropertiesPath = `${parentPath}.properties`;
  const pathsPropertiesExpanded = collapsedPaths[pathsPropertiesPath] === false;
  
  if (!pathsPropertiesExpanded) {
    return;
  }
  
  const pathNames = Object.keys(paths);
  const startX = xPos - (pathNames.length * xSpacing) / 2 + xSpacing / 2;
  
  pathNames.forEach((pathName, index) => {
    const pathValue = paths[pathName];
    const pathX = startX + index * xSpacing;
    const pathPath = `${parentPath}.properties.${pathName}`;
    
    const isPathCollapsed = collapsedPaths[pathPath] === true;
    
    // Create a schema for the path
    const pathSchema = {
      type: 'object',
      description: `API path: ${pathName}`,
      properties: pathValue
    };
    
    const pathNode = createPropertyNode(
      pathName,
      pathSchema,
      [],
      pathX,
      yPos,
      isPathCollapsed
    );
    
    const edge = createEdge(parentNodeId, pathNode.id);
    
    result.nodes.push(pathNode);
    result.edges.push(edge);
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