
import { Node, Edge } from '@xyflow/react';
import { CollapsedState } from '../types';
import { createPropertyNode, createNestedPropertyNode, createArrayItemNode } from '../nodeGenerator';
import { createEdge } from '../edgeGenerator';
import { buildPropertyPath, canProcessFurther } from './pathUtils';

/**
 * Process a single property in expanded layout
 */
export function processProperty(
  propName: string,
  propSchema: any,
  requiredProps: string[],
  xPos: number,
  yOffset: number,
  result: { nodes: Node[], edges: Edge[] },
  parentId: string,
  currentPath: string,
  currentDepth: number,
  maxDepth: number,
  collapsedPaths: CollapsedState
): void {
  // Skip if propSchema is null or undefined
  if (!propSchema) return;

  // Build path for this property
  const { nodePath, fullPath } = buildPropertyPath(currentPath, propName);
  
  // Check if the property's path or its parent is collapsed
  const isPathCollapsed = collapsedPaths[fullPath] === true;
  const parentPropertiesPath = `${currentPath}.properties`;
  const isParentPropertiesCollapsed = collapsedPaths[parentPropertiesPath] === true;
  
  // If either the path itself or parent's properties are collapsed, skip this property completely
  if (isPathCollapsed || isParentPropertiesCollapsed) {
    console.log(`Property ${fullPath} or its parent ${parentPropertiesPath} is collapsed, skipping generation`);
    return;
  }
  
  // Create node for property
  const propNode = createPropertyNode(propName, propSchema, requiredProps, xPos, yOffset);
  
  // Add edge from parent to property
  const edge = createEdge(parentId, propNode.id);
  
  result.nodes.push(propNode);
  result.edges.push(edge);
  
  // Process children only if not at max depth
  if (currentDepth < maxDepth) {
    const propertiesPath = `${fullPath}.properties`;
    const isPropertiesCollapsed = collapsedPaths[propertiesPath] === true;
    
    // Skip child processing if properties path is collapsed
    if (isPropertiesCollapsed) {
      console.log(`Properties path ${propertiesPath} is collapsed, marking node as collapsed`);
      propNode.data.isCollapsed = true;
      return;
    }
    
    processPropertyChildren(
      propName, 
      propSchema, 
      propNode, 
      xPos, 
      yOffset, 
      result, 
      currentDepth, 
      maxDepth, 
      collapsedPaths, 
      fullPath
    );
  } else if (currentDepth >= maxDepth) {
    // At max depth, add indicator that there are more levels
    if ((propSchema.type === 'object' && propSchema.properties) || 
        (propSchema.type === 'array' && propSchema.items && 
         propSchema.items.type === 'object' && propSchema.items.properties)) {
      propNode.data.hasMoreLevels = true;
    }
  }
}

/**
 * Process children of a property (objects, arrays)
 */
function processPropertyChildren(
  propName: string,
  propSchema: any,
  propNode: Node,
  xPos: number,
  yOffset: number,
  result: { nodes: Node[], edges: Edge[] },
  currentDepth: number,
  maxDepth: number,
  collapsedPaths: CollapsedState = {},
  currentPath: string = ''
) {
  // If the property is an object with nested properties
  if (propSchema.type === 'object' && propSchema.properties) {
    const nestedProps = propSchema.properties;
    const nestedRequired = propSchema.required || [];
    const nestedYOffset = yOffset + 150;
    
    // Update the parent node data with property count
    propNode.data.properties = Object.keys(nestedProps).length;
    
    // Check if object's properties path is collapsed
    const objPropertiesPath = `${currentPath}.properties`;
    if (collapsedPaths[objPropertiesPath] === true) {
      console.log(`Object properties path ${objPropertiesPath} is collapsed, marking node`);
      propNode.data.isCollapsed = true;
      return;
    }
    
    // Calculate spacing for nested properties
    const nestedXSpacing = 200 * 0.8; // 80% of parent spacing
    
    // Process nested properties (depth + 1)
    processNestedProperties(
      nestedProps,
      nestedRequired,
      xPos,
      nestedYOffset,
      nestedXSpacing,
      result,
      propNode.id,
      currentDepth + 1,
      maxDepth,
      collapsedPaths,
      currentPath
    );
  }
  
  // If the property is an array, add its items
  if (propSchema.type === 'array' && propSchema.items) {
    processArrayItems(
      propSchema,
      propNode,
      xPos,
      yOffset,
      result,
      currentDepth,
      maxDepth,
      collapsedPaths,
      currentPath
    );
  }
}

/**
 * Process nested properties
 */
function processNestedProperties(
  properties: Record<string, any>,
  requiredProps: string[],
  xOffset: number,
  yOffset: number,
  xSpacing: number,
  result: { nodes: Node[], edges: Edge[] },
  parentId: string,
  currentDepth: number,
  maxDepth: number,
  collapsedPaths: CollapsedState = {},
  currentPath: string = ''
) {
  // Calculate starting x position to center the nodes
  const totalWidth = Object.keys(properties).length * xSpacing;
  const startXOffset = xOffset - totalWidth / 2 + xSpacing / 2;
  
  // Process each nested property
  Object.entries(properties).forEach(([propName, propSchema], index) => {
    const xPos = startXOffset + index * xSpacing;
    
    // Build path for this nested property
    const fullPath = `${currentPath}.properties.${propName}`;
    
    // Skip this property if it's explicitly collapsed
    if (collapsedPaths[fullPath] === true) {
      console.log(`Skipping collapsed nested property: ${fullPath}`);
      return;
    }
    
    // Process the nested property
    processProperty(
      propName,
      propSchema,
      requiredProps,
      xPos,
      yOffset,
      result,
      parentId,
      currentPath,
      currentDepth,
      maxDepth,
      collapsedPaths
    );
  });
}

/**
 * Process array items
 */
function processArrayItems(
  propSchema: any,
  propNode: Node,
  xPos: number,
  yOffset: number,
  result: { nodes: Node[], edges: Edge[] },
  currentDepth: number,
  maxDepth: number,
  collapsedPaths: CollapsedState = {},
  currentPath: string = ''
) {
  const itemSchema = propSchema.items;
  
  // Update the parent node with minItems/maxItems if defined
  propNode.data.minItems = propSchema.minItems;
  propNode.data.maxItems = propSchema.maxItems;
  
  // Build path for array items
  const itemPath = `${currentPath}.items`;
  
  // Check if this items path is collapsed
  const itemsCollapsed = collapsedPaths[itemPath] === true;
  
  if (itemsCollapsed) {
    console.log(`Array items path ${itemPath} is collapsed, skipping items node generation`);
    propNode.data.isCollapsed = true;
    return;
  }
  
  // Create node for array items
  const itemNode = createArrayItemNode(propNode.id, itemSchema, xPos, yOffset);
  
  // Add edge from array to items
  const itemsEdge = createEdge(propNode.id, itemNode.id, 'items');
  
  result.nodes.push(itemNode);
  result.edges.push(itemsEdge);
  
  // If array items are objects with properties, process them too (depth + 2)
  if (itemSchema.type === 'object' && itemSchema.properties && currentDepth + 1 < maxDepth) {
    const itemProps = itemSchema.properties;
    const itemRequired = itemSchema.required || [];
    
    // Check if items properties are collapsed
    const itemPropsPath = `${itemPath}.properties`;
    if (collapsedPaths[itemPropsPath] === true) {
      console.log(`Array item properties ${itemPropsPath} are collapsed, marking node`);
      itemNode.data.isCollapsed = true;
      return;
    }
    
    processNestedProperties(
      itemProps,
      itemRequired,
      xPos,
      yOffset + 300,
      160,  // Even smaller spacing for array items
      result,
      itemNode.id,
      currentDepth + 2,
      maxDepth,
      collapsedPaths,
      itemPath
    );
  }
}
