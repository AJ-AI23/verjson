
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
  const rootCollapsed = collapsedPaths['root'] !== false;
  
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
  
  // Check if the parent path's properties are explicitly expanded
  // The JSON editor uses paths like "root.properties.propName"
  // So for checking if parent properties are expanded, we look for that exact pattern
  const parentPropertiesPath = `${currentPath}.properties`;
  const isParentPropertiesExplicitlyExpanded = collapsedPaths[parentPropertiesPath] === false;
  
  console.log(`Processing properties at path: ${currentPath}`);
  console.log(`Parent properties expanded: ${isParentPropertiesExplicitlyExpanded}`);
  console.log(`All collapsed paths:`, collapsedPaths);
  
  Object.entries(properties).forEach(([propName, propSchema]: [string, any], index) => {
    // Skip if propSchema is null or undefined
    if (!propSchema) return;
    
    const xPos = startXOffset + index * xSpacing;
    
    // JSON editor uses paths like "root.properties.propName"
    // but our diagram uses paths like "root.propName"
    // We need to check both patterns for compatibility
    const diagramPath = `${currentPath}.${propName}`;
    const jsonEditorPath = `${currentPath}.properties.${propName}`;
    
    // Check if this specific path is explicitly collapsed
    const isPathExplicitlyCollapsed = collapsedPaths[diagramPath] === true || collapsedPaths[jsonEditorPath] === true;
    
    // Determine if we should render this node:
    // Check if either path pattern indicates the node should be expanded
    const shouldRenderNode = isParentPropertiesExplicitlyExpanded || 
                            collapsedPaths[diagramPath] === false || 
                            collapsedPaths[jsonEditorPath] === false;
    
    if (!shouldRenderNode) {
      console.log(`Skipping node at path ${diagramPath}/${jsonEditorPath} (not explicitly expanded)`);
      console.log(`  - Parent properties path: ${parentPropertiesPath}, expanded: ${isParentPropertiesExplicitlyExpanded}`);
      console.log(`  - Diagram path in collapsedPaths: ${collapsedPaths[diagramPath]}`);
      console.log(`  - JSON editor path in collapsedPaths: ${collapsedPaths[jsonEditorPath]}`);
      return;
    }
    
    console.log(`Creating node for path: ${diagramPath}/${jsonEditorPath}, collapsed: ${isPathExplicitlyCollapsed}`);
    
    // Create node for property
    const propNode = createPropertyNode(propName, propSchema, requiredProps, xPos, yOffset);
    
    // Set collapsed state on node for UI representation
    if (isPathExplicitlyCollapsed) {
      propNode.data.isCollapsed = true;
      console.log(`Node ${diagramPath} is marked as collapsed in diagram`);
    }
    
    // Add edge from parent to property
    const edge = createEdge(parentId, propNode.id);
    
    result.nodes.push(propNode);
    result.edges.push(edge);
    
    // Only process nested properties if:
    // 1. We haven't reached max depth AND
    // 2. This property is not explicitly collapsed
    console.log(`Checking if should process nested for ${diagramPath}:`);
    console.log(`  - currentDepth: ${currentDepth}, maxDepth: ${maxDepth}`);
    console.log(`  - isPathExplicitlyCollapsed: ${isPathExplicitlyCollapsed}`);
    console.log(`  - Should process: ${currentDepth < maxDepth && !isPathExplicitlyCollapsed}`);
    
    if (currentDepth < maxDepth && !isPathExplicitlyCollapsed) {
      // If the property is an object with nested properties
      console.log(`Processing deeper for ${diagramPath}, schema type: ${propSchema.type}`);
      if (propSchema.type === 'object' && propSchema.properties) {
        const nestedProps = propSchema.properties;
        const nestedRequired = propSchema.required || [];
        const nestedYOffset = yOffset + 150;
        
        // Update the parent node data with property count
        propNode.data.properties = Object.keys(nestedProps).length;
        
        // Check if this path's properties are explicitly expanded
        // The JSON editor sets paths like "root.properties.exampleObject.properties"
        // but we construct paths like "root.exampleObject" 
        // So we need to check for both patterns
        const diagramPropertiesPath = `${diagramPath}.properties`;
        const jsonEditorPropertiesPath = `${jsonEditorPath}.properties`;
        const isThisPropertiesExplicitlyExpanded = collapsedPaths[diagramPropertiesPath] === false || 
                                                  collapsedPaths[jsonEditorPropertiesPath] === false;
        
        console.log(`Object ${diagramPath} - checking nested properties`);
        console.log(`  - Diagram properties path: ${diagramPropertiesPath}, expanded: ${collapsedPaths[diagramPropertiesPath] === false}`);
        console.log(`  - JSON editor properties path: ${jsonEditorPropertiesPath}, expanded: ${collapsedPaths[jsonEditorPropertiesPath] === false}`);
        console.log(`  - Combined expanded: ${isThisPropertiesExplicitlyExpanded}`);
        console.log(`  - Available collapsed paths:`, Object.keys(collapsedPaths));
        
        // Only process nested properties if this path's properties are explicitly expanded
        if (isThisPropertiesExplicitlyExpanded) {
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
            diagramPath
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
        const itemPath = `${diagramPath}.items`;
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
          if (itemSchema.type === 'object' && itemSchema.properties && currentDepth + 1 < maxDepth) {
            const itemProps = itemSchema.properties;
            const itemRequired = itemSchema.required || [];
            
            // Check if item path's properties are explicitly expanded
            const itemPropertiesPath = `${itemPath}.properties`;
            const itemPropertiesExplicitlyExpanded = collapsedPaths[itemPropertiesPath] === false;
            
            // Only process item properties if its properties path is explicitly expanded
            if (itemPropertiesExplicitlyExpanded) {
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
            }
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
