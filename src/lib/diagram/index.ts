
import { Node, Edge } from '@xyflow/react';
import { DiagramElements, DiagramOptions, DiagramGeneratorParams } from './types';
import { createRootNode } from './nodeGenerator';
import { generateGroupedLayout } from './groupedPropertiesLayout';
import { generateExpandedLayout } from './expandedPropertiesLayout';

export const generateNodesAndEdges = (params: DiagramGeneratorParams | any): DiagramElements => {
  // Handle backward compatibility - if params is not an object with options, treat it as the old format
  let schema: any;
  let options: DiagramOptions = { maxDepth: 3, expandedNodes: [] };
  let groupProperties = false;
  
  if (params.schema && params.options) {
    // New format
    schema = params.schema;
    options = params.options;
    groupProperties = params.groupProperties;
  } else {
    // Old format for backward compatibility
    schema = params;
    groupProperties = arguments[1] || false;
  }
  
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
      const groupedLayout = generateGroupedLayout(schema, options);
      result.nodes.push(...groupedLayout.nodes);
      result.edges.push(...groupedLayout.edges);
    } else {
      // Expanded properties mode (original behavior)
      const expandedLayout = generateExpandedLayout(schema, options);
      result.nodes.push(...expandedLayout.nodes);
      result.edges.push(...expandedLayout.edges);
    }
  }
  
  return result;
};

// Re-export types for usage elsewhere
export * from './types';
