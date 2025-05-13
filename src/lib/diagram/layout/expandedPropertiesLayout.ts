
import { DiagramElements, CollapsedState } from '../types';
import { createEdge } from '../edgeGenerator';
import { processProperty } from './expandedLayoutProcessor';

/**
 * Generates a layout where each property is displayed individually
 */
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
  // Calculate starting x position to center the nodes
  const startXOffset = xOffset - totalWidth / 2 + xSpacing / 2;
  
  Object.entries(properties).forEach(([propName, propSchema], index) => {
    const xPos = startXOffset + index * xSpacing;
    
    processProperty(
      propName,
      propSchema,
      requiredProps,
      xPos,
      yOffset,
      result,
      'root',
      'root',
      1,
      maxDepth,
      collapsedPaths
    );
  });
  
  return result;
};
