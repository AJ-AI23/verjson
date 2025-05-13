
import { DiagramElements, CollapsedState } from '../types';
import { createGroupNode } from '../nodeGenerator';
import { createEdge } from '../edgeGenerator';
import { calculateGridPosition } from './gridPositionUtils';
import { GridConfig, GridState, ProcessingQueueItem, LayoutContext } from './types';
import { processObjectProperty } from './objectProcessor';
import { processArrayProperty } from './arrayProcessor';

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
  
  // Create layout context
  const context: LayoutContext = {
    gridConfig,
    gridState,
    collapsedPaths,
    maxDepth,
    nodes: [],
    edges: []
  };
  
  // Check if root is collapsed
  const rootCollapsed = collapsedPaths['root'] === true;
  
  // If root is collapsed, we should still render the root node but no children
  if (rootCollapsed) {
    console.log('Root is collapsed in grouped layout, skipping property nodes generation');
    return result;
  }
  
  // Get properties from schema
  const properties = schema.properties;
  const requiredProps = schema.required || [];
  
  // Process queue for breadth-first traversal
  const objectsToProcess: ProcessingQueueItem[] = [
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
  processObjectsQueue(objectsToProcess, context);
  
  // Add nodes and edges to result
  result.nodes = context.nodes;
  result.edges = context.edges;
  
  return result;
};

/**
 * Process the queue of objects to add to the diagram
 */
const processObjectsQueue = (
  objectsToProcess: ProcessingQueueItem[], 
  context: LayoutContext
): void => {
  while (objectsToProcess.length > 0) {
    const current = objectsToProcess.shift();
    if (!current) continue;
    
    const { parentId, schema: objSchema, level, index, depth, path } = current;
    const objProperties = objSchema.properties;
    const objRequired = objSchema.required || [];

    // Check if this path is collapsed
    const isPathCollapsed = context.collapsedPaths[path] === true;
    const isPropertiesCollapsed = context.collapsedPaths[`${path}.properties`] === true;
    const isCollapsed = isPathCollapsed || isPropertiesCollapsed;

    // Skip processing if collapsed
    if (isCollapsed) {
      console.log(`Path ${path} is collapsed, skipping child nodes generation`);
      continue;
    }

    // Stop processing if we've reached max depth
    if (depth > context.maxDepth) {
      continue;
    }

    // Calculate grid position for this group node
    const position = calculateGridPosition(level, index, context.gridState, context.gridConfig);
    
    // Create a group node for all properties of this object
    const groupNode = createGroupNode(parentId, objProperties, objRequired, position.y);
    // Apply calculated x position
    groupNode.position.x = position.x;
    
    // Add collapsed state to node data
    if (isCollapsed) {
      groupNode.data.isCollapsed = true;
    }
    
    context.nodes.push(groupNode);
    
    // Create edge from parent to group
    const edge = createEdge(parentId, groupNode.id);
    context.edges.push(edge);
    
    // Process properties of this object
    processObjectProperties(objProperties, groupNode, current, objectsToProcess, context);
  }
};

/**
 * Process the properties of an object node
 */
const processObjectProperties = (
  objProperties: Record<string, any>,
  groupNode: any,
  current: ProcessingQueueItem,
  objectsToProcess: ProcessingQueueItem[],
  context: LayoutContext
): void => {
  // Process each property
  Object.entries(objProperties).forEach(([propName, propSchema]: [string, any], propIndex) => {
    // Process nested objects
    if (propSchema && propSchema.type === 'object' && propSchema.properties) {
      processObjectProperty(
        propName, 
        propSchema, 
        groupNode, 
        context, 
        current, 
        objectsToProcess, 
        propIndex
      );
    }
    
    // Process arrays with object items
    else if (propSchema && propSchema.type === 'array' && propSchema.items && 
        propSchema.items.type === 'object' && propSchema.items.properties) {
      processArrayProperty(
        propName,
        propSchema,
        groupNode,
        context,
        current,
        objectsToProcess,
        propIndex
      );
    }
  });
};
