
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
  maxDepth: number,
  collapsedPaths: CollapsedState = {}
): DiagramElements => {
  console.log(`[EXPANDED LAYOUT] Starting with maxDepth: ${maxDepth}`);
  console.log(`[EXPANDED LAYOUT] CollapsedPaths:`, collapsedPaths);
  
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };

  if (!schema || !schema.type || schema.type !== 'object' || !schema.properties) {
    console.log(`[EXPANDED LAYOUT] Early return - invalid schema`);
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
  
  // IMPORTANT: Check if root.properties is explicitly expanded
  // This makes the behavior consistent with nested objects
  const rootPropertiesPath = 'root.properties';
  const rootPropertiesExpanded = collapsedPaths[rootPropertiesPath] === false;
  
  console.log(`[EXPANDED LAYOUT] Root properties path: ${rootPropertiesPath}, expanded: ${rootPropertiesExpanded}`);
  console.log(`[EXPANDED LAYOUT] Value in collapsedPaths:`, collapsedPaths[rootPropertiesPath]);
  console.log(`[EXPANDED LAYOUT] Strict equality check:`, collapsedPaths[rootPropertiesPath] === false);
  console.log(`[EXPANDED LAYOUT] Type of value:`, typeof collapsedPaths[rootPropertiesPath]);
  
  // Only process first level properties if root.properties is explicitly expanded
  if (rootPropertiesExpanded) {
    console.log('[EXPANDED LAYOUT] Root properties are explicitly expanded, processing first level properties');
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
      0 // Start with 0 expandedNodeDepth from root
    );
  } else {
    console.log('[EXPANDED LAYOUT] Root properties are not explicitly expanded, skipping first level properties');
  }
  
  console.log(`[EXPANDED LAYOUT] Finished - generated ${result.nodes.length} nodes, ${result.edges.length} edges`);
  
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
  currentPath: string = '',
  expandedNodeDepth: number = 0 // New parameter to track depth from last expanded node
) {
  // Calculate starting x position to center the nodes
  const totalWidth = Object.keys(properties).length * xSpacing;
  const startXOffset = xOffset - totalWidth / 2 + xSpacing / 2;
  
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
  
  console.log(`Processing properties at path: ${currentPath}`);
  console.log(`Parent properties path: ${parentPropertiesPath}, collapsed: ${isParentPropertiesCollapsed}`);
  console.log(`All collapsed paths:`, collapsedPaths);
  console.log(`Properties object:`, properties);
  console.log(`Properties keys:`, Object.keys(properties));
  console.log(`Properties entries count:`, Object.entries(properties).length);
  console.log(`Current depth: ${currentDepth}, Max depth: ${maxDepth}`);
  console.log(`Is parent properties collapsed: ${isParentPropertiesCollapsed}`);
  
  Object.entries(properties).forEach(([propName, propSchema]: [string, any], index) => {
    console.log(`[DEBUG] Processing property ${index}: ${propName}`);
    console.log(`[DEBUG] Schema type: ${propSchema?.type}`);
    console.log(`[DEBUG] Current path: ${currentPath}`);
    console.log(`[DEBUG] Current depth: ${currentDepth}, Max depth: ${maxDepth}`);
    
    // Skip if propSchema is null or undefined
    if (!propSchema) {
      console.log(`[DEBUG] Skipping ${propName} - no schema`);
      return;
    }
    
    const xPos = startXOffset + index * xSpacing;
    
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
    
    console.log(`Path checking for ${propName}:`);
    console.log(`  - diagramPath: ${diagramPath}, value:`, diagramPathValue);
    console.log(`  - jsonEditorPath: ${jsonEditorPath}, value:`, jsonEditorPathValue);
    
    const isDiagramPathExpanded = diagramPathValue === false || 
      (typeof diagramPathValue === 'object' && diagramPathValue !== null);
    const isJsonEditorPathExpanded = jsonEditorPathValue === false || 
      (typeof jsonEditorPathValue === 'object' && jsonEditorPathValue !== null);
    
    console.log(`  - isDiagramPathExpanded: ${isDiagramPathExpanded}`);
    console.log(`  - isJsonEditorPathExpanded: ${isJsonEditorPathExpanded}`);
    
    const isPathExplicitlyExpanded = isDiagramPathExpanded || isJsonEditorPathExpanded;
    const isPathExplicitlyCollapsed = !isPathExplicitlyExpanded;
    
    console.log(`  - Final: isPathExplicitlyExpanded: ${isPathExplicitlyExpanded}, isPathExplicitlyCollapsed: ${isPathExplicitlyCollapsed}`);
    
    // Check if any ancestor path is collapsed (this would hide this node)
    const hasCollapsedAncestor = isAnyAncestorCollapsed(jsonEditorPath);
    
    // Determine if we should render this node:
    // Only hide nodes when their immediate parent "properties" container is collapsed
    // Individual property nodes always render (they show collapse indicators when collapsed)
    const shouldRenderNode = !isParentPropertiesCollapsed;
    
    console.log(`Checking render for ${diagramPath}:`);
    console.log(`  - Parent properties collapsed: ${isParentPropertiesCollapsed}`);
    console.log(`  - Has collapsed ancestor: ${hasCollapsedAncestor}`);
    console.log(`  - Should render: ${shouldRenderNode}`);
    
    if (!shouldRenderNode) {
      console.log(`Skipping node at path ${diagramPath}/${jsonEditorPath} (parent not expanded)`);
      console.log(`  - Parent properties path: ${parentPropertiesPath}, collapsed: ${isParentPropertiesCollapsed}`);
      console.log(`  - Has collapsed ancestor: ${hasCollapsedAncestor}`);
      console.log(`  - Diagram path in collapsedPaths: ${collapsedPaths[diagramPath]}`);
      console.log(`  - JSON editor path in collapsedPaths: ${collapsedPaths[jsonEditorPath]}`);
      return;
    }
    
    console.log(`Creating node for path: ${diagramPath}/${jsonEditorPath}, collapsed: ${isPathExplicitlyCollapsed}`);
    
    let propNode: Node;
    try {
      // Create node for property
      propNode = createPropertyNode(propName, propSchema, requiredProps, xPos, yOffset, isPathExplicitlyCollapsed);

      console.log(`Successfully created node for ${propName}:`, propNode.id);
      
      // Add edge from parent to property
      const edge = createEdge(parentId, propNode.id);
      
      result.nodes.push(propNode);
      result.edges.push(edge);
      
      console.log(`Added node ${propNode.id} and edge to result`);
    } catch (error) {
      console.error(`Error creating node for ${propName}:`, error);
      return; // Skip this property if creation fails
    }
    
    // Only process nested properties if:
    // 1. We haven't reached relative max depth from last expanded node AND
    // 2. This property is not explicitly collapsed
    console.log(`Checking if should process nested for ${diagramPath}:`);
    console.log(`  - expandedNodeDepth: ${expandedNodeDepth}, maxDepth: ${maxDepth}`);
    console.log(`  - isPathExplicitlyCollapsed: ${isPathExplicitlyCollapsed}`);
    console.log(`  - Should process: ${expandedNodeDepth < maxDepth && !isPathExplicitlyCollapsed}`);
    
    if (expandedNodeDepth < maxDepth && !isPathExplicitlyCollapsed) {
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
        // We need to check for this exact pattern for nested properties to show
        // BUT also ensure the parent node itself is not collapsed
        const jsonEditorPropertiesPath = `${jsonEditorPath}.properties`;
        const isThisPropertiesExplicitlyExpanded = collapsedPaths[jsonEditorPropertiesPath] === false;
        const isParentNodeCollapsed = collapsedPaths[jsonEditorPath] === true;
        
        console.log(`Object ${diagramPath} - checking nested properties`);
        console.log(`  - JSON editor properties path: ${jsonEditorPropertiesPath}, expanded: ${isThisPropertiesExplicitlyExpanded}`);
        console.log(`  - Parent node collapsed: ${isParentNodeCollapsed}`);
        console.log(`  - Available collapsed paths:`, Object.keys(collapsedPaths));
        
        // Only process nested properties if this path's properties are explicitly expanded AND parent is not collapsed
        if (isThisPropertiesExplicitlyExpanded && !isParentNodeCollapsed) {
          console.log(`Processing nested properties for ${diagramPath} because ${jsonEditorPropertiesPath} is expanded`);
          // Reset expandedNodeDepth to 0 since this object's properties are explicitly expanded
          const newExpandedNodeDepth = 0;
          console.log(`  - Resetting expandedNodeDepth to ${newExpandedNodeDepth} for explicitly expanded node`);
          
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
            newExpandedNodeDepth
          );
        } else {
          // If properties are not explicitly expanded but we're still processing
          // (this happens when we're within the maxDepth limit but no explicit expand)
          // In this case, increment the expandedNodeDepth normally
          console.log(`Not processing nested properties for ${diagramPath} - properties path not explicitly expanded`);
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
              console.log(`  - Resetting expandedNodeDepth to ${newExpandedNodeDepth} for explicitly expanded array items`);
              
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
                newExpandedNodeDepth
              );
            }
          }
        }
      }
    } else if (expandedNodeDepth >= maxDepth) {
      // At relative max depth from last expanded node, add indicator that there are more levels
      console.log(`Node ${propName} at relative max depth (${expandedNodeDepth} >= ${maxDepth})`);
      if ((propSchema.type === 'object' && propSchema.properties) || 
          (propSchema.type === 'array' && propSchema.items && 
           propSchema.items.type === 'object' && propSchema.items.properties)) {
        propNode.data.hasMoreLevels = true;
        
        // Even at max depth, respect the collapsed state from the editor
        const maxDepthPathValue = collapsedPaths[jsonEditorPath];
        if (typeof maxDepthPathValue === 'object' && maxDepthPathValue !== null) {
          // For MaxDepthReached objects, treat as expanded (show the indicator)
          propNode.data.isCollapsed = false;
          console.log(`Max depth node ${propName} treated as expanded due to MaxDepthReached object`);
        } else if (maxDepthPathValue === true) {
          // Explicitly collapsed
          propNode.data.isCollapsed = true;
          console.log(`Max depth node ${propName} explicitly collapsed`);
        } else {
          // Default collapsed for max depth nodes
          propNode.data.isCollapsed = true;
          console.log(`Max depth node ${propName} defaulted to collapsed`);
        }
      }
    }
  });
}
