
import { Node, Edge } from '@xyflow/react';
import { DiagramElements, CollapsedState } from './types';
import { createRootNode } from './nodeGenerator';
import { generateGroupedLayout } from './layout/groupedPropertiesLayout';
import { generateExpandedLayout } from './layout/expandedPropertiesLayout';
import { generateOpenApiLayout } from './layout/openApiLayout';

export const generateNodesAndEdges = (
  schema: any, 
  groupProperties: boolean = false, 
  maxDepth: number,
  collapsedPaths: CollapsedState = {}
): DiagramElements => {
  const result: DiagramElements = {
    nodes: [],
    edges: []
  };
  
  if (!schema) {
    return result;
  }

  // Check if this is an OpenAPI schema first
  const isOpenApiSchema = schema && 
                          typeof schema === 'object' && 
                          (schema.openapi || schema.swagger) &&
                          (schema.info || schema.paths);

  // For regular JSON schemas, require a type property
  if (!isOpenApiSchema && !schema.type) {
    return result;
  }

  try {
    // Always create the root node regardless of collapsed state
    const rootNode = createRootNode(schema);
    
    // Check if root is collapsed, if so, mark it on the node
    // Default to expanded (false) if not specified to show child nodes
    const rootCollapsed = collapsedPaths['root'] === true;
    if (rootCollapsed) {
      rootNode.data.isCollapsed = true;
    }
    
    result.nodes.push(rootNode);

    if (isOpenApiSchema) {
      const openApiLayout = generateOpenApiLayout(schema, maxDepth, collapsedPaths);
      result.nodes.push(...openApiLayout.nodes);
      result.edges.push(...openApiLayout.edges);
    } else if (schema.type === 'object' && schema.properties) {
      // Generate layout based on mode
      if (groupProperties) {
        // Group properties mode
        const groupedLayout = generateGroupedLayout(schema, maxDepth, collapsedPaths);
        result.nodes.push(...groupedLayout.nodes);
        result.edges.push(...groupedLayout.edges);
      } else {
        // Expanded properties mode
        const expandedLayout = generateExpandedLayout(schema, maxDepth, collapsedPaths);
        result.nodes.push(...expandedLayout.nodes);
        result.edges.push(...expandedLayout.edges);
      }
    }
    
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
