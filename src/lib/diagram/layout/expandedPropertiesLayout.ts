
import { Node, Edge } from '@xyflow/react';
import { DiagramElements, CollapsedState } from '../types';
import { 
  createPropertyNode, 
  createNestedPropertyNode, 
  createArrayItemNode 
} from '../nodeGenerator';
import { createEdge } from '../edgeGenerator';

export const generateExpandedLayout = (
  schema: any, 
  maxDepth: number = 3,
  collapsedPaths: CollapsedState = {}
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
  const rootCollapsed = collapsedPaths['root'] === true;
  
  // If root is collapsed, we should skip generating child nodes
  if (rootCollapsed) {
    console.log('Root is collapsed, skipping property nodes generation');
    return result;
  }
  
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
    'root'
  );
  
  return result;
};

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
  currentPath: string = ''
) {
  // Calculate starting x position to center the nodes
  const totalWidth = Object.keys(properties).length * xSpacing;
  const startXOffset = xOffset - totalWidth / 2 + xSpacing / 2;
  
  // Check if the parent path is explicitly set to false (expanded)
  const parentPathKey = `${currentPath}.properties`;
  const isParentExplicitlyExpanded = collapsedPaths[parentPathKey] === false;
  
  Object.entries(properties).forEach(([propName, propSchema]: [string, any], index) => {
    // Skip if propSchema is null or undefined
    if (!propSchema) return;
    
    const xPos = startXOffset + index * xSpacing;
    const propPath = currentPath ? `${currentPath}.${propName}` : propName;
    const fullPath = `${currentPath}.properties.${propName}`;
    
    // Special case: If parent path is explicitly expanded, always render direct children
    // regardless of their collapsed state, but respect their state for deeper levels
    let isCollapsed = false;
    if (isParentExplicitlyExpanded) {
      // Render this node regardless of its state
      isCollapsed = false; 
    } else {
      // Check if the property's path or its parent is collapsed (default to true if not specified)
      isCollapsed = collapsedPaths[fullPath] !== false && collapsedPaths[`${currentPath}.properties`] !== false;
    }
    
    // Skip rendering completely if collapsed and not a direct child of explicitly expanded parent
    if (isCollapsed && !isParentExplicitlyExpanded) {
      console.log(`Skipping collapsed property: ${fullPath}`);
      return;
    }
    
    // Create node for property
    const propNode = createPropertyNode(propName, propSchema, requiredProps, xPos, yOffset);
    
    // Set collapsed state on node for UI representation
    // If this property is explicitly collapsed, mark it visually
    if (collapsedPaths[fullPath] === true) {
      propNode.data.isCollapsed = true;
      console.log(`Node ${fullPath} is marked as collapsed in diagram`);
    }
    
    // Add edge from parent to property
    const edge = createEdge(parentId, propNode.id);
    
    result.nodes.push(propNode);
    result.edges.push(edge);
    
    // Check if this specific path is collapsed, to determine whether to process children
    const thisPathExplicitlyCollapsed = collapsedPaths[fullPath] === true;
    
    // Only process nested properties if we haven't reached max depth and not collapsed
    if (currentDepth < maxDepth && !thisPathExplicitlyCollapsed) {
      // If the property is an object with nested properties
      if (propSchema.type === 'object' && propSchema.properties) {
        const nestedProps = propSchema.properties;
        const nestedRequired = propSchema.required || [];
        const nestedYOffset = yOffset + 150;
        
        // Update the parent node data with property count
        propNode.data.properties = Object.keys(nestedProps).length;
        
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
          fullPath
        );
      }
      
      // If the property is an array, add its items
      if (propSchema.type === 'array' && propSchema.items) {
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
        
        // If array items are objects with properties, process them too (depth + 2)
        if (itemSchema.type === 'object' && itemSchema.properties && currentDepth + 1 < maxDepth) {
          const itemProps = itemSchema.properties;
          const itemRequired = itemSchema.required || [];
          const itemPath = `${fullPath}.items`;
          
          // Check if this items path is collapsed
          const itemsCollapsed = collapsedPaths[itemPath] === true;
          
          if (!itemsCollapsed) {
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
              itemPath
            );
          } else {
            // Mark item node as collapsed
            itemNode.data.isCollapsed = true;
          }
        }
      }
    } else if (currentDepth >= maxDepth) {
      // At max depth, add indicator that there are more levels
      if ((propSchema.type === 'object' && propSchema.properties) || 
          (propSchema.type === 'array' && propSchema.items && 
           propSchema.items.type === 'object' && propSchema.items.properties)) {
        propNode.data.hasMoreLevels = true;
      }
    }
  });
}
