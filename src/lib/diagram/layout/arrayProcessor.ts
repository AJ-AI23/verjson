
import { calculateGridPosition } from './gridPositionUtils';
import { ProcessingQueueItem, LayoutContext } from './types';
import { createArrayNode } from '../nodeGenerator';
import { createEdge } from '../edgeGenerator';

/**
 * Processes an array property and adds it to the diagram
 */
export const processArrayProperty = (
  propName: string,
  propSchema: any,
  groupNode: any,
  context: LayoutContext,
  current: ProcessingQueueItem,
  objectsToProcess: ProcessingQueueItem[],
  propIndex: number
): void => {
  const { collapsedPaths, maxDepth } = context;
  const { level, depth, path } = current;
  
  // Create paths for this property
  const propPath = path ? `${path}.properties.${propName}` : propName;
  const itemPath = `${propPath}.items`;
  const isItemCollapsed = collapsedPaths[itemPath] === true;
  
  // Calculate position for this array node
  const arrayPosition = calculateGridPosition(level + 1, propIndex, context.gridState, context.gridConfig);
  
  // Create array node
  const arrayNode = createArrayNode(groupNode.id, propName, propSchema, arrayPosition.y);
  // Apply calculated x position
  arrayNode.position.x = arrayPosition.x;
  
  // Add indication if there are more levels that aren't shown
  if ((!canProcessFurther(depth, maxDepth) || isItemCollapsed) && 
      Object.keys(propSchema.items.properties).length > 0) {
    arrayNode.data.hasMoreLevels = true;
    arrayNode.data.isCollapsed = isItemCollapsed;
  }
  
  // Add node and edge to the diagram
  context.nodes.push(arrayNode);
  
  // Edge from group to array
  const arrayEdge = createEdge(groupNode.id, arrayNode.id);
  context.edges.push(arrayEdge);
  
  // Add the array's item object to process if we can process further and it's not collapsed
  if (canProcessFurther(depth, maxDepth) && !isItemCollapsed) {
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
};

/**
 * Checks if we can process further based on depth
 */
const canProcessFurther = (depth: number, maxDepth: number): boolean => {
  return depth < maxDepth;
};
