
import { Node, Edge } from '@xyflow/react';
import { DiagramElements, CollapsedState } from './types';
import { createRootNode } from './nodeGenerator';
import { generateGroupedLayout } from './layout/groupedPropertiesLayout';
import { generateExpandedLayout } from './layout/expandedPropertiesLayout';

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
  console.log('Collapsed paths in diagram generator:', Object.keys(collapsedPaths).length);

  if (!schema || !schema.type) {
    console.log('No valid schema provided to generateNodesAndEdges');
    return result;
  }

  try {
    // Start with the root node
    const rootNode = createRootNode(schema);
    
    // Check if root is collapsed, if so, mark it on the node
    if (collapsedPaths['root'] === true) {
      console.log('Root is marked as collapsed in diagram');
      rootNode.data.isCollapsed = true;
    }
    
    result.nodes.push(rootNode);
    console.log('Root node created:', rootNode);

    // Skip property generation if root is collapsed
    if (collapsedPaths['root'] === true) {
      console.log('Root is collapsed, skipping property generation');
      return result;
    }
    
    // Process properties if this is an object
    if (schema.type === 'object' && schema.properties) {
      console.log(`Schema has ${Object.keys(schema.properties).length} properties`);
      
      if (groupProperties) {
        // Group properties mode - create one node per object
        console.log('Using grouped layout mode');
        const groupedLayout = generateGroupedLayout(schema, maxDepth, collapsedPaths);
        result.nodes.push(...groupedLayout.nodes);
        result.edges.push(...groupedLayout.edges);
      } else {
        // Expanded properties mode (original behavior)
        console.log('Using expanded layout mode');
        const expandedLayout = generateExpandedLayout(schema, maxDepth, collapsedPaths);
        result.nodes.push(...expandedLayout.nodes);
        result.edges.push(...expandedLayout.edges);
      }
    } else {
      console.log(`Schema type is ${schema.type}, not generating property nodes`);
    }
    
    console.log(`Generated ${result.nodes.length} nodes and ${result.edges.length} edges`);
    return result;
  } catch (error) {
    console.error('Error generating nodes and edges:', error);
    // Return at least the root node if possible
    if (result.nodes.length > 0) {
      return result;
    }
    
    // Create a fallback node to show something
    const fallbackNode: Node = {
      id: 'error-node',
      type: 'schemaType',
      position: { x: 0, y: 0 },
      data: {
        label: schema?.title || 'Schema Error',
        type: schema?.type || 'unknown',
        description: 'Error processing schema'
      }
    };
    
    return { nodes: [fallbackNode], edges: [] };
  }
};

// Re-export types for usage elsewhere
export * from './types';
