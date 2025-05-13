
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

  console.log('generateExpandedLayout called with:');
  console.log('- Schema:', schema ? { type: schema.type, properties: schema.properties ? Object.keys(schema.properties).length : 0 } : 'invalid schema');
  console.log('- maxDepth:', maxDepth);
  console.log('- collapsedPaths keys:', Object.keys(collapsedPaths));
  console.log('- Root collapsed?', collapsedPaths['root'] === true);

  if (!schema || !schema.type || schema.type !== 'object' || !schema.properties) {
    console.log('Invalid schema or schema has no properties, returning empty result');
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
  
  // Check if root path or properties path is collapsed
  const rootCollapsed = collapsedPaths['root'] === true;
  const propertiesPathCollapsed = collapsedPaths['root.properties'] === true;
  
  // If root is collapsed or properties path is collapsed, only return the empty result
  if (rootCollapsed) {
    console.log('Root is collapsed in expandedPropertiesLayout, skipping property nodes generation');
    return result;
  }
  
  if (propertiesPathCollapsed) {
    console.log('root.properties is collapsed in expandedPropertiesLayout, skipping property nodes generation');
    return result;
  }
  
  console.log('Processing properties with:');
  console.log('- Property count:', Object.keys(properties).length);
  console.log('- Required properties:', requiredProps);
  
  // Process the first level of properties (depth 1)
  // Calculate starting x position to center the nodes
  const startXOffset = -totalWidth / 2 + xSpacing / 2;
  
  Object.entries(properties).forEach(([propName, propSchema], index) => {
    const xPos = startXOffset + index * xSpacing;
    const propPath = `root.properties.${propName}`;
    
    console.log(`Processing property ${propName}, path: ${propPath}`);
    
    // Skip this property if it's explicitly collapsed
    if (collapsedPaths[propPath] === true) {
      console.log(`Skipping collapsed property: ${propPath}`);
      return;
    }
    
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
  
  console.log(`Expanded layout generated ${result.nodes.length} nodes and ${result.edges.length} edges`);
  return result;
};
