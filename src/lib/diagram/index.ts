
import { Node, Edge } from '@xyflow/react';
import { DiagramElements, CollapsedState } from './types';
import { createRootNode } from './nodeGenerator';
import { generateGroupedLayout } from './groupedPropertiesLayout';
import { generateExpandedLayout } from './expandedPropertiesLayout';

export const generateNodesAndEdges = (
  schema: any, 
  groupProperties: boolean = false, 
  maxDepth: number = 3,
  collapsedPaths: CollapsedState = {}
): DiagramElements => {
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };

  console.log('generateNodesAndEdges called with schema:', schema ? 
    { type: schema.type, hasProperties: !!schema.properties } : 'null or undefined');

  if (!schema || !schema.type) {
    console.log('No valid schema provided to generateNodesAndEdges');
    return result;
  }

  // Start with the root node
  const rootNode = createRootNode(schema);
  result.nodes.push(rootNode);

  // Process properties if this is an object
  if (schema.type === 'object' && schema.properties) {
    console.log(`Schema has ${Object.keys(schema.properties).length} properties`);
    
    if (groupProperties) {
      // Group properties mode - create one node per object
      const groupedLayout = generateGroupedLayout(schema, maxDepth, collapsedPaths);
      result.nodes.push(...groupedLayout.nodes);
      result.edges.push(...groupedLayout.edges);
    } else {
      // Expanded properties mode (original behavior)
      const expandedLayout = generateExpandedLayout(schema, maxDepth, collapsedPaths);
      result.nodes.push(...expandedLayout.nodes);
      result.edges.push(...expandedLayout.edges);
    }
  } else {
    console.log(`Schema type is ${schema.type}, not generating property nodes`);
  }
  
  console.log(`Generated ${result.nodes.length} nodes and ${result.edges.length} edges`);
  return result;
};

// Re-export types for usage elsewhere
export * from './types';
