import { Node, Edge } from '@xyflow/react';
import { DiagramElements, CollapsedState } from '../types';
import { 
  createPropertyNode, 
  createNestedPropertyNode, 
  createArrayItemNode,
  createGroupedPropertiesNode 
} from '../nodeGenerator';
import { createEdge } from '../edgeGenerator';
import { processPropertiesWithGrouping } from '../utils/propertyGroupingUtils';

export const generateExpandedLayout = (
  schema: any, 
  maxDepth: number,
  collapsedPaths: CollapsedState = {},
  maxIndividualProperties: number = 5
): DiagramElements => {
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };

  if (!schema || !schema.type || schema.type !== 'object' || !schema.properties) {
    return result;
  }

  // We assume the root node is already added to the result nodes
  
  const properties = schema.properties;
  const requiredProps = schema.required || [];
  let xOffset = -200;
  const yOffset = 150;
  const xSpacing = 200;
  
  // Calculate starting x position to center the nodes
  const totalWidth = Object.keys(properties).length * xSpacing;
  xOffset = -totalWidth / 2 + xSpacing / 2;
  
  // Check if root itself is collapsed
  const rootCollapsed = collapsedPaths['root'] !== false;
  
  // If root is collapsed, we should skip generating child nodes
  if (rootCollapsed) {
    return result;
  }
  
  // When root is expanded, show special JSON Schema keywords (allOf, oneOf, if, then, etc.)
  // These should appear as direct children of root, alongside the properties container
  processSpecialKeywordsAtLevel(
    schema,
    result,
    'root',
    yOffset,
    xOffset,
    xSpacing,
    collapsedPaths,
    'root',
    1,
    maxDepth,
    0,
    maxIndividualProperties
  );
  
  // IMPORTANT: Check if root.properties is explicitly expanded
  // This makes the behavior consistent with nested objects
  const rootPropertiesPath = 'root.properties';
  const rootPropertiesExpanded = collapsedPaths[rootPropertiesPath] === false;
  
  // Only process first level properties if root.properties is explicitly expanded
  if (rootPropertiesExpanded) {
    // Process the first level of properties (depth 1)
        processProperties(
          properties, 
          requiredProps, 
          xOffset, 
          yOffset, 
          xSpacing, 
          result, 
          'root', 
          1, 
          maxDepth, 
          collapsedPaths, 
          'root',
          0, // Start with 0 expandedNodeDepth from root
          maxIndividualProperties, // Use the passed maxIndividualProperties
          schema // Pass full schema to process special keywords
        );
  }
  
  return result;
};

// Process special keywords at the current level (shown when parent object is expanded)
function processSpecialKeywordsAtLevel(
  schema: any,
  result: DiagramElements,
  parentId: string,
  yOffset: number,
  xOffset: number,
  xSpacing: number,
  collapsedPaths: CollapsedState,
  currentPath: string,
  currentDepth: number,
  maxDepth: number,
  expandedNodeDepth: number,
  maxPropertiesLimit: number
) {
  // Comprehensive list of JSON Schema keywords that can contain schema definitions
  // Applicator keywords (combine/apply schemas)
  const applicatorKeywords = [
    'allOf', 'anyOf', 'oneOf', 'not',           // Schema composition
    'if', 'then', 'else',                        // Conditional schema
    'dependentSchemas',                          // Dependent schemas (draft-07+)
    'prefixItems',                               // Array prefix items (draft-2020-12)
    'contains',                                  // Array contains schema
    'propertyNames',                             // Property name validation schema
    'patternProperties',                         // Pattern-based property schemas
    'unevaluatedProperties',                     // Unevaluated properties (draft-2019+)
    'unevaluatedItems',                          // Unevaluated items (draft-2019+)
  ];
  
  // Keywords that contain schemas only when they are objects (not booleans)
  const conditionalSchemaKeywords = [
    'additionalProperties',                      // Additional properties schema
    'additionalItems',                           // Additional items schema (pre draft-2020)
    'items',                                     // Array items schema (when not handled elsewhere)
  ];
  
  // Definition containers
  const definitionKeywords = [
    '$defs',                                     // Definitions (draft-2019+)
    'definitions',                               // Definitions (draft-07 and earlier)
  ];
  
  const specialProps: Array<[string, any]> = [];
  
  // Collect applicator keywords
  for (const keyword of applicatorKeywords) {
    if (schema[keyword] !== undefined) {
      specialProps.push([keyword, schema[keyword]]);
    }
  }
  
  // Collect conditional schema keywords (only if they're objects, not booleans)
  for (const keyword of conditionalSchemaKeywords) {
    const value = schema[keyword];
    if (value !== undefined && typeof value === 'object' && value !== null) {
      specialProps.push([keyword, value]);
    }
  }
  
  // Collect definition containers
  for (const keyword of definitionKeywords) {
    if (schema[keyword] !== undefined && typeof schema[keyword] === 'object') {
      specialProps.push([keyword, schema[keyword]]);
    }
  }
  
  if (specialProps.length === 0) return;
  
  // Calculate positions for special keyword nodes - place them at the same y level as properties would be
  const totalSpecialProps = specialProps.length;
  
  specialProps.forEach(([keyword, keywordSchema], index) => {
    const xPos = xOffset - (totalSpecialProps - 1) * xSpacing / 2 + index * xSpacing;
    const jsonEditorPath = currentPath === 'root' ? `root.${keyword}` : `${currentPath}.${keyword}`;
    
    // Check if this keyword path is expanded
    const isExpanded = collapsedPaths[jsonEditorPath] === false;
    
    // Determine the type label for the node
    let typeLabel = 'schema';
    if (Array.isArray(keywordSchema)) {
      typeLabel = `array[${keywordSchema.length}]`;
    } else if (keywordSchema && typeof keywordSchema === 'object') {
      if (keywordSchema.type) {
        typeLabel = keywordSchema.type;
      }
    }
    
    // Create node for the special keyword
    const keywordNode = createPropertyNode(
      keyword,
      { type: typeLabel, ...keywordSchema },
      [],
      xPos,
      yOffset,
      !isExpanded
    );
    
    // Add edge from parent to keyword node
    const edge = createEdge(parentId, keywordNode.id);
    
    result.nodes.push(keywordNode);
    result.edges.push(edge);
    
    // Process nested content if expanded and not at max depth
    if (isExpanded && expandedNodeDepth < maxDepth) {
      processSpecialKeywordChildren(
        keyword,
        keywordSchema,
        keywordNode.id,
        jsonEditorPath,
        yOffset + 150,
        xPos,
        xSpacing * 0.8,
        result,
        collapsedPaths,
        currentDepth + 1,
        maxDepth,
        0, // Reset expanded depth for explicitly expanded nodes
        maxPropertiesLimit
      );
    }
  });
}

// Process children of special keywords
function processSpecialKeywordChildren(
  keyword: string,
  keywordSchema: any,
  parentNodeId: string,
  parentPath: string,
  yOffset: number,
  xOffset: number,
  xSpacing: number,
  result: DiagramElements,
  collapsedPaths: CollapsedState,
  currentDepth: number,
  maxDepth: number,
  expandedNodeDepth: number,
  maxPropertiesLimit: number
) {
  // Handle array-type keywords (allOf, oneOf, anyOf)
  if (Array.isArray(keywordSchema)) {
    keywordSchema.forEach((subSchema, subIndex) => {
      if (subSchema && typeof subSchema === 'object') {
        const subSchemaPath = `${parentPath}[${subIndex}]`;
        const isSubSchemaExpanded = collapsedPaths[subSchemaPath] === false;
        
        // Create a node for each array item
        const itemNode = createArrayItemNode(
          parentNodeId,
          subSchema,
          xOffset + subIndex * xSpacing,
          yOffset
        );
        
        const itemEdge = createEdge(parentNodeId, itemNode.id, `[${subIndex}]`);
        result.nodes.push(itemNode);
        result.edges.push(itemEdge);
        
        // If the item has properties and is expanded, process them
        if (isSubSchemaExpanded && subSchema.properties && expandedNodeDepth < maxDepth) {
          const itemPropertiesPath = `${subSchemaPath}.properties`;
          const itemPropertiesExpanded = collapsedPaths[itemPropertiesPath] === false;
          
          if (itemPropertiesExpanded) {
            processProperties(
              subSchema.properties,
              subSchema.required || [],
              xOffset + subIndex * xSpacing,
              yOffset + 150,
              xSpacing * 0.8,
              result,
              itemNode.id,
              currentDepth + 1,
              maxDepth,
              collapsedPaths,
              subSchemaPath,
              0,
              maxPropertiesLimit,
              subSchema
            );
          }
        }
      }
    });
  }
  // Handle object-type keywords (if, then, else, not, etc.)
  else if (keywordSchema && typeof keywordSchema === 'object') {
    // If it has properties, check if they should be shown
    if (keywordSchema.properties) {
      const keywordPropertiesPath = `${parentPath}.properties`;
      const isPropertiesExpanded = collapsedPaths[keywordPropertiesPath] === false;
      
      if (isPropertiesExpanded) {
        processProperties(
          keywordSchema.properties,
          keywordSchema.required || [],
          xOffset,
          yOffset,
          xSpacing,
          result,
          parentNodeId,
          currentDepth + 1,
          maxDepth,
          collapsedPaths,
          parentPath,
          0,
          maxPropertiesLimit,
          keywordSchema
        );
      }
    }
    
    // Also check for nested special keywords
    processSpecialKeywordsAtLevel(
      keywordSchema,
      result,
      parentNodeId,
      yOffset,
      xOffset,
      xSpacing,
      collapsedPaths,
      parentPath,
      currentDepth,
      maxDepth,
      expandedNodeDepth,
      maxPropertiesLimit
    );
  }
}

// Helper function to process properties recursively with depth control
function processProperties(
  properties: Record<string, any>,
  requiredProps: string[],
  xOffset: number,
  yOffset: number,
  xSpacing: number,
  result: DiagramElements,
  parentId: string,
  currentDepth: number,
  maxDepth: number,
  collapsedPaths: CollapsedState = {},
  currentPath: string = '',
  expandedNodeDepth: number = 0, // New parameter to track depth from last expanded node
  maxPropertiesLimit: number = 5, // Maximum number of individual property nodes before grouping
  fullSchema?: any // Full schema object to access special keywords
) {
  const propertyEntries = Object.entries(properties);
  const totalProperties = propertyEntries.length;
  
  // Only apply grouping logic for top-level container expansions
  // Check if this is a direct expansion of a container node (like schemas, not a property within a schema)
  const isContainerExpansion = currentPath.endsWith('.schemas') || 
                              currentPath.endsWith('.parameters') || 
                              currentPath.endsWith('.responses') ||
                              currentPath.endsWith('.components') ||
                              (currentDepth === 1 && currentPath.includes('properties'));
  
  // Count how many properties are already individually expanded
  const expandedPropertiesCount = propertyEntries.filter(([propName]) => {
    const propPath = `${currentPath}.${propName}`;
    return collapsedPaths[propPath] === false; // explicitly expanded
  }).length;
  
  // Only group if this is a container expansion AND we're not showing individual expanded properties
  const shouldGroupProperties = isContainerExpansion && 
                               expandedPropertiesCount === 0 && 
                               totalProperties > maxPropertiesLimit;
  
  if (shouldGroupProperties) {
    // Use the shared property grouping utility
    const groupingResult = processPropertiesWithGrouping(
      propertyEntries,
      requiredProps,
      result,
      {
        maxIndividualProperties: maxPropertiesLimit,
        xSpacing,
        parentNodeId: parentId,
        parentPath: currentPath,
        yPosition: yOffset,
        startXPosition: xOffset
      }
    );
    
    return;
  }
  
  // Helper function to check if any ancestor path is collapsed
  const isAnyAncestorCollapsed = (path: string): boolean => {
    const pathParts = path.split('.');
    for (let i = 1; i <= pathParts.length; i++) {
      const ancestorPath = pathParts.slice(0, i).join('.');
      if (collapsedPaths[ancestorPath] === true) {
        return true;
      }
    }
    return false;
  };
  
  // Check if the parent path's properties are explicitly expanded
  // The JSON editor uses paths like "root.properties.propName"
  // So for checking if parent properties are expanded, we look for that exact pattern
  const parentPropertiesPath = `${currentPath}.properties`;
  const isParentPropertiesCollapsed = collapsedPaths[parentPropertiesPath] === true;
  
  // Process all properties individually (no grouping)
  propertyEntries.forEach(([propName, propSchema]: [string, any], index) => {
    // Skip if propSchema is null or undefined
    if (!propSchema) {
      return;
    }
    
    const xPos = xOffset - (totalProperties - 1) * xSpacing / 2 + index * xSpacing;
    
    // Build paths correctly based on whether we're at root level or nested
    // JSON editor uses: root.properties.propName, root.properties.propName.properties.nestedProp
    // Diagram uses: root.propName, root.propName.nestedProp
    const diagramPath = currentPath === 'root' ? propName : `${currentPath}.${propName}`;
    const jsonEditorPath = currentPath === 'root' ? 
      `root.properties.${propName}` : 
      `${currentPath}.${propName}`;
    
    // Check if this specific path is explicitly expanded (default to collapsed)
    // Handle both boolean values and complex objects (like MaxDepthReached)
    const diagramPathValue = collapsedPaths[diagramPath];
    const jsonEditorPathValue = collapsedPaths[jsonEditorPath];
    
    const isDiagramPathExpanded = diagramPathValue === false || 
      (typeof diagramPathValue === 'object' && diagramPathValue !== null);
    const isJsonEditorPathExpanded = jsonEditorPathValue === false || 
      (typeof jsonEditorPathValue === 'object' && jsonEditorPathValue !== null);
    
    const isPathExplicitlyExpanded = isDiagramPathExpanded || isJsonEditorPathExpanded;
    const isPathExplicitlyCollapsed = !isPathExplicitlyExpanded;
    
    // Check if any ancestor path is collapsed (this would hide this node)
    const hasCollapsedAncestor = isAnyAncestorCollapsed(jsonEditorPath);
    
    // Determine if we should render this node:
    // Only hide nodes when their immediate parent "properties" container is collapsed
    // Individual property nodes always render (they show collapse indicators when collapsed)
    const shouldRenderNode = !isParentPropertiesCollapsed;
    
    if (!shouldRenderNode) {
      return;
    }
    
    let propNode: Node;
    try {
      // Create node for property
      propNode = createPropertyNode(propName, propSchema, requiredProps, xPos, yOffset, isPathExplicitlyCollapsed);
      
      // Add edge from parent to property
      const edge = createEdge(parentId, propNode.id);
      
      result.nodes.push(propNode);
      result.edges.push(edge);
    } catch (error) {
      return; // Skip this property if creation fails
    }
    
    // Only process nested properties if:
    // 1. We haven't reached relative max depth from last expanded node AND
    // 2. This property is not explicitly collapsed
    if (expandedNodeDepth < maxDepth && !isPathExplicitlyCollapsed) {
      // If the property is an object with nested properties
      if (propSchema.type === 'object' && propSchema.properties) {
        const nestedProps = propSchema.properties;
        const nestedRequired = propSchema.required || [];
        const nestedYOffset = yOffset + 150;
        
        // Update the parent node data with property count
        propNode.data.properties = Object.keys(nestedProps).length;
        
        // Check if this path's properties are explicitly expanded
        // The JSON editor sets paths like "root.properties.exampleObject.properties"
        // We need to check for this exact pattern for nested properties to show
        // BUT also ensure the parent node itself is not collapsed
        const jsonEditorPropertiesPath = `${jsonEditorPath}.properties`;
        const isThisPropertiesExplicitlyExpanded = collapsedPaths[jsonEditorPropertiesPath] === false;
        const isParentNodeCollapsed = collapsedPaths[jsonEditorPath] === true;
        
        // Only process nested properties if this path's properties are explicitly expanded AND parent is not collapsed
        if (isThisPropertiesExplicitlyExpanded && !isParentNodeCollapsed) {
          // Reset expandedNodeDepth to 0 since this object's properties are explicitly expanded
          const newExpandedNodeDepth = 0;
          
              // Process nested properties (depth + 1)
              processProperties(
                nestedProps, 
                nestedRequired, 
                xPos, 
                nestedYOffset, 
                xSpacing * 0.8, 
                result, 
                propNode.id, 
                currentDepth + 1, 
                maxDepth,
                collapsedPaths,
                jsonEditorPath,
                newExpandedNodeDepth,
                maxPropertiesLimit,
                propSchema // Pass full property schema
              );
        }
      }
      
      // If the property is an array, check if we should show its items
      if (propSchema.type === 'array' && propSchema.items) {
        const itemSchema = propSchema.items;
        
        // Update the parent node with minItems/maxItems if defined
        propNode.data.minItems = propSchema.minItems;
        propNode.data.maxItems = propSchema.maxItems;
        
        // Check if this items path is explicitly expanded
        const itemPath = `${jsonEditorPath}.items`;
        const itemsExplicitlyExpanded = collapsedPaths[itemPath] === false;
        
        // Only create array item node if the items are explicitly expanded
        if (itemsExplicitlyExpanded) {
          // Create node for array items
          const itemNode = createArrayItemNode(propNode.id, itemSchema, xPos, yOffset + 150);
          
          // Add edge from array to items
          const itemsEdge = createEdge(propNode.id, itemNode.id, 'items');
          
          result.nodes.push(itemNode);
          result.edges.push(itemsEdge);
          
          // If array items are objects with properties, process them too
          if (itemSchema.type === 'object' && itemSchema.properties && expandedNodeDepth + 1 < maxDepth) {
            const itemProps = itemSchema.properties;
            const itemRequired = itemSchema.required || [];
            
            // Check if item path's properties are explicitly expanded
            const itemPropertiesPath = `${itemPath}.properties`;
            const itemPropertiesExplicitlyExpanded = collapsedPaths[itemPropertiesPath] === false;
            
            // Only process item properties if its properties path is explicitly expanded
            if (itemPropertiesExplicitlyExpanded) {
              // Reset expandedNodeDepth for explicitly expanded array items
              const newExpandedNodeDepth = 0;
              
                processProperties(
                  itemProps,
                  itemRequired,
                  xPos,
                  yOffset + 300,
                  xSpacing * 0.8,
                  result,
                  itemNode.id,
                  currentDepth + 2,
                  maxDepth,
                  collapsedPaths,
                  itemPath,
                  newExpandedNodeDepth,
                  maxPropertiesLimit,
                  itemSchema // Pass full item schema
                );
            }
          }
        }
      }
    } else if (expandedNodeDepth >= maxDepth) {
      // At relative max depth from last expanded node, add indicator that there are more levels
      if ((propSchema.type === 'object' && propSchema.properties) || 
          (propSchema.type === 'array' && propSchema.items && 
           propSchema.items.type === 'object' && propSchema.items.properties)) {
        propNode.data.hasMoreLevels = true;
        
        // Even at max depth, respect the collapsed state from the editor
        const maxDepthPathValue = collapsedPaths[jsonEditorPath];
        if (typeof maxDepthPathValue === 'object' && maxDepthPathValue !== null) {
          // For MaxDepthReached objects, treat as expanded (show the indicator)
          propNode.data.isCollapsed = false;
        } else if (maxDepthPathValue === true) {
          // Explicitly collapsed
          propNode.data.isCollapsed = true;
        } else {
          // Default collapsed for max depth nodes
          propNode.data.isCollapsed = true;
        }
      }
    }
  });
}
