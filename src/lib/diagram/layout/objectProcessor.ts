
import { ProcessingQueueItem, LayoutContext } from './types';
import { createEdge } from '../edgeGenerator';

/**
 * Processes an object property and adds it to the diagram
 */
export const processObjectProperty = (
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
  
  // Create the path for this property
  const propPath = path ? `${path}.properties.${propName}` : propName;
  const isPropCollapsed = collapsedPaths[propPath] === true;
  
  // Calculate position directly without using calculateGridPosition
  const spacing = 200;
  const levelSpacing = 150;
  
  const objPosition = {
    x: propIndex * spacing - ((propIndex * spacing) / 2),
    y: level * levelSpacing
  };
  
  // Create a dedicated node for this object property
  const objectNodeId = `${groupNode.id}-${propName}-object`;
  
  const objectNode = {
    id: objectNodeId,
    type: 'schemaType',
    position: { x: objPosition.x, y: objPosition.y },
    data: {
      label: `${propName} (Object)`,
      type: 'object',
      description: propSchema.description,
      properties: Object.keys(propSchema.properties).length,
      hasMoreLevels: !canProcessFurther(depth, maxDepth) && Object.keys(propSchema.properties).length > 0,
      isCollapsed: isPropCollapsed
    }
  };
  
  // Add node and edge to the diagram
  context.nodes.push(objectNode);
  
  // Edge from group to object
  const objEdge = createEdge(groupNode.id, objectNodeId);
  context.edges.push(objEdge);
  
  // Check if parent path is explicitly expanded
  const parentPathKey = `${path}.properties`;
  const isParentExplicitlyExpanded = collapsedPaths[parentPathKey] === false;
  
  // Queue this object for processing if:
  // 1. We can process further AND
  // 2. Either it's not collapsed OR parent is explicitly expanded
  if (canProcessFurther(depth, maxDepth) && 
     (!isPropCollapsed || isParentExplicitlyExpanded)) {
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
};

/**
 * Checks if we can process further based on depth
 */
const canProcessFurther = (depth: number, maxDepth: number): boolean => {
  return depth < maxDepth;
};

