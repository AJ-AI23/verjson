
import { Node, Edge } from '@xyflow/react';
import { DiagramElements, CollapsedState } from './types';
import { createGroupNode, createArrayNode } from './nodeGenerator';
import { createEdge } from './edgeGenerator';

// Grid layout configuration
interface GridConfig {
  initialX: number;
  startY: number;
  xGap: number;
  yGap: number;
  columnWidth: number;
}

// Track node positions in a grid
interface GridState {
  grid: Record<number, Record<number, boolean>>;
  maxNodesPerLevel: Record<number, number>;
}

/**
 * Calculates a grid position that avoids overlapping nodes
 */
const calculateGridPosition = (
  level: number, 
  index: number, 
  gridState: GridState,
  config: GridConfig
): { x: number, y: number } => {
  // Calculate appropriate column and ensure it's not already occupied
  let column = index % 3 - 1; // -1, 0, 1 for left, center, right
  const levelGrid = gridState.grid[level] || {};
  
  // Avoid collision by finding an open column
  if (levelGrid[column]) {
    // Try neighboring columns
    const alternatives = [-1, 0, 1].filter(c => !levelGrid[c]);
    if (alternatives.length > 0) {
      column = alternatives[0];
    } else {
      // If all columns are occupied, create a new column further out
      column = index >= 0 ? index + 1 : index - 1;
    }
  }
  
  // Mark this position as occupied
  if (!gridState.grid[level]) {
    gridState.grid[level] = {};
  }
  gridState.grid[level][column] = true;
  
  // Track max nodes at this level for y-coordinate calculation
  gridState.maxNodesPerLevel[level] = (gridState.maxNodesPerLevel[level] || 0) + 1;
  
  // Calculate actual x,y coordinates
  const x = config.initialX + (column * config.xGap);
  const y = config.startY + (level * config.yGap);
  
  return { x, y };
};

export const generateGroupedLayout = (
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
  
  // Grid layout configuration
  const gridConfig: GridConfig = {
    initialX: 0,         // Starting X position
    startY: 150,         // Starting Y position
    xGap: 350,           // Horizontal gap between nodes
    yGap: 200,           // Vertical gap between levels
    columnWidth: 200     // Width of a column
  };
  
  // Grid state tracking
  const gridState: GridState = {
    grid: {},
    maxNodesPerLevel: {}
  };
  
  // Check if root is collapsed
  const rootCollapsed = collapsedPaths['root'] === true;
  
  // If root is collapsed, skip generating children
  if (rootCollapsed) {
    console.log('Root is collapsed in grouped layout, skipping property nodes generation');
    return result;
  }
  
  // Process queue for breadth-first traversal
  let yOffset = gridConfig.startY;
  const objectsToProcess = [
    { 
      parentId: 'root', 
      schema: { properties, required: requiredProps },
      level: 0,
      index: 0,
      depth: 1,
      path: 'root'
    }
  ];
  
  // Process all objects in the schema
  while (objectsToProcess.length > 0) {
    const current = objectsToProcess.shift();
    if (!current) continue;
    
    const { parentId, schema: objSchema, level, index, depth, path } = current;
    const objProperties = objSchema.properties;
    const objRequired = objSchema.required || [];

    // Check if this path is collapsed
    const isPathCollapsed = collapsedPaths[path] === true;
    const isPropertiesCollapsed = collapsedPaths[`${path}.properties`] === true;
    const isCollapsed = isPathCollapsed || isPropertiesCollapsed;

    // Skip processing if collapsed
    if (isCollapsed) {
      console.log(`Path ${path} is collapsed, skipping child nodes generation`);
      continue;
    }

    // Stop processing if we've reached max depth
    if (depth > maxDepth) {
      continue;
    }

    // Calculate grid position for this group node
    const position = calculateGridPosition(level, index, gridState, gridConfig);
    
    // Create a group node for all properties of this object
    const groupNode = createGroupNode(parentId, objProperties, objRequired, position.y);
    // Apply calculated x position
    groupNode.position.x = position.x;
    
    // Add collapsed state to node data
    if (isCollapsed) {
      groupNode.data.isCollapsed = true;
    }
    
    result.nodes.push(groupNode);
    
    // Create edge from parent to group
    const edge = createEdge(parentId, groupNode.id);
    result.edges.push(edge);
    
    // Check if we still have depth available
    const canProcessFurther = depth < maxDepth;
    
    // Process nested objects
    Object.entries(objProperties).forEach(([propName, propSchema]: [string, any], propIndex) => {
      const propPath = path ? `${path}.properties.${propName}` : propName;
      const isPropCollapsed = collapsedPaths[propPath] === true;
      
      // Process nested objects
      if (propSchema && propSchema.type === 'object' && propSchema.properties) {
        // Create a dedicated node for this object property
        const objectNodeId = `${groupNode.id}-${propName}-object`;
        
        // Calculate position for this object node
        const objPosition = calculateGridPosition(level + 1, propIndex, gridState, gridConfig);
        
        const objectNode = {
          id: objectNodeId,
          type: 'schemaType',
          position: { x: objPosition.x, y: objPosition.y },
          data: {
            label: `${propName} (Object)`,
            type: 'object',
            description: propSchema.description,
            properties: Object.keys(propSchema.properties).length,
            hasMoreLevels: !canProcessFurther && Object.keys(propSchema.properties).length > 0,
            isCollapsed: isPropCollapsed
          }
        };
        result.nodes.push(objectNode);
        
        // Edge from group to object
        const objEdge = createEdge(groupNode.id, objectNodeId);
        result.edges.push(objEdge);
        
        // Queue this object for processing if we can process further and it's not collapsed
        if (canProcessFurther && !isPropCollapsed) {
          objectsToProcess.push({
            parentId: objectNodeId,
            schema: {
              properties: propSchema.properties,
              required: propSchema.required || []
            },
            level: level + 2,
            index: propIndex,
            depth: depth + 1,
            path: propPath
          });
        }
      }
      
      // Process arrays with object items
      else if (propSchema && propSchema.type === 'array' && propSchema.items && 
          propSchema.items.type === 'object' && propSchema.items.properties) {
        
        // Calculate position for this array node
        const arrayPosition = calculateGridPosition(level + 1, propIndex, gridState, gridConfig);
        
        const arrayNode = createArrayNode(groupNode.id, propName, propSchema, arrayPosition.y);
        // Apply calculated x position
        arrayNode.position.x = arrayPosition.x;
        
        const itemPath = `${propPath}.items`;
        const isItemCollapsed = collapsedPaths[itemPath] === true;
        
        // Add indication if there are more levels that aren't shown
        if ((!canProcessFurther || isItemCollapsed) && Object.keys(propSchema.items.properties).length > 0) {
          arrayNode.data.hasMoreLevels = true;
          arrayNode.data.isCollapsed = isItemCollapsed;
        }
        
        result.nodes.push(arrayNode);
        
        // Edge from group to array
        const arrayEdge = createEdge(groupNode.id, arrayNode.id);
        result.edges.push(arrayEdge);
        
        // Add the array's item object to process if we can process further and it's not collapsed
        if (canProcessFurther && !isItemCollapsed) {
          objectsToProcess.push({
            parentId: arrayNode.id,
            schema: {
              properties: propSchema.items.properties,
              required: propSchema.items.required || []
            },
            level: level + 2,
            index: propIndex,
            depth: depth + 1,
            path: itemPath
          });
        }
      }
    });
  }
  
  return result;
};
