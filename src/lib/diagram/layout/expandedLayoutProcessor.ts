
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
  const isCollapsed = collapsedPaths[fullPath] === true ||
    collapsedPaths[`${currentPath}.properties`] === true;
  
  // Create node for property
  const propNode = createPropertyNode(propName, propSchema, requiredProps, xPos, yOffset);
  
  // Update node to show it's collapsed in the editor if applicable
  if (isCollapsed) {
    propNode.data.isCollapsed = true;
    console.log(`Node ${fullPath} is marked as collapsed in diagram`);
  }
  
  // Add edge from parent to property
  const edge = createEdge(parentId, propNode.id);
  
  result.nodes.push(propNode);
  result.edges.push(edge);
  
  // Only process nested properties if we haven't reached max depth and not collapsed
  if (currentDepth < maxDepth && !isCollapsed) {
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
  
  // Always mark collapsed if the property itself is collapsed
  if (isCollapsed) {
    propNode.data.isCollapsed = true;
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
  
  // Create node for array items
  const itemNode = createArrayItemNode(propNode.id, itemSchema, xPos, yOffset);
  
  // Add edge from array to items
  const itemsEdge = createEdge(propNode.id, itemNode.id, 'items');
  
  result.nodes.push(itemNode);
  result.edges.push(itemsEdge);
  
  // Build path for array items
  const itemPath = `${currentPath}.items`;
  
  // Check if this items path is collapsed
  const itemsCollapsed = collapsedPaths[itemPath] === true;
  
  // If array items are objects with properties, process them too (depth + 2)
  if (itemSchema.type === 'object' && itemSchema.properties && currentDepth + 1 < maxDepth && !itemsCollapsed) {
    const itemProps = itemSchema.properties;
    const itemRequired = itemSchema.required || [];
    
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
  } else if (itemsCollapsed) {
    // Mark item node as collapsed
    itemNode.data.isCollapsed = true;
  }
}
