
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

  if (!schema || !schema.type) {
    return result;
  }

  // Start with the root node
  const rootNode = createRootNode(schema);
  result.nodes.push(rootNode);

  // Process properties if this is an object
  if (schema.type === 'object' && schema.properties) {
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
  }
  
  return result;
};

// Re-export types for usage elsewhere
export * from './types';
