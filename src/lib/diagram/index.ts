
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

  console.log('🟢 generateNodesAndEdges called with:');
  console.log('🟢 - Schema:', schema ? 
    { 
      type: schema.type, 
      hasProperties: !!schema.properties, 
      title: schema.title,
      hasOpenapi: !!schema.openapi,
      hasSwagger: !!schema.swagger,
      hasInfo: !!schema.info,
      hasPaths: !!schema.paths,
      schemaKeys: Object.keys(schema)
    } : 'null or undefined');
  console.log('🟢 - Group properties:', groupProperties);
  console.log('🟢 - Max depth:', maxDepth);
  console.log('🟢 - Collapsed paths count:', Object.keys(collapsedPaths).length);
  console.log('🟢 - Root collapsed?', collapsedPaths['root'] === true);
  
  if (!schema) {
    console.error('No valid schema provided to generateNodesAndEdges');
    return result;
  }

  // Check if this is an OpenAPI schema first
  const isOpenApiSchema = schema && 
                          typeof schema === 'object' && 
                          (schema.openapi || schema.swagger) &&
                          (schema.info || schema.paths);

  // For regular JSON schemas, require a type property
  if (!isOpenApiSchema && !schema.type) {
    console.error('No valid schema provided to generateNodesAndEdges');
    return result;
  }

  try {
    // Always create the root node regardless of collapsed state
    const rootNode = createRootNode(schema);
    
    // Check if root is collapsed, if so, mark it on the node
    // Default to collapsed (true) if not specified
    const rootCollapsed = collapsedPaths['root'] !== false;
    if (rootCollapsed) {
      console.log('Root is marked as collapsed in diagram');
      rootNode.data.isCollapsed = true;
    } else {
      console.log('Root is NOT collapsed in diagram');
    }
    
    result.nodes.push(rootNode);
    console.log('Root node created:', rootNode);

    if (isOpenApiSchema) {
      console.log('🚀 Detected OpenAPI schema, using OpenAPI layout');
      console.log('🚀 About to call generateOpenApiLayout with schema:', schema);
      const openApiLayout = generateOpenApiLayout(schema, maxDepth, collapsedPaths);
      console.log(`🚀 OpenAPI layout generated ${openApiLayout.nodes.length} nodes and ${openApiLayout.edges.length} edges`);
      result.nodes.push(...openApiLayout.nodes);
      result.edges.push(...openApiLayout.edges);
    } else if (schema.type === 'object' && schema.properties) {
      console.log(`Schema has ${Object.keys(schema.properties).length} properties`);
      console.log(`Root collapsed: ${rootCollapsed}`);
      
      // Generate layout based on mode
      if (groupProperties) {
        // Group properties mode
        console.log('Using grouped layout mode');
        const groupedLayout = generateGroupedLayout(schema, maxDepth, collapsedPaths);
        console.log(`Grouped layout generated ${groupedLayout.nodes.length} nodes and ${groupedLayout.edges.length} edges`);
        result.nodes.push(...groupedLayout.nodes);
        result.edges.push(...groupedLayout.edges);
      } else {
        // Expanded properties mode
        console.log('Using expanded layout mode');
        const expandedLayout = generateExpandedLayout(schema, maxDepth, collapsedPaths);
        console.log(`Expanded layout generated ${expandedLayout.nodes.length} nodes and ${expandedLayout.edges.length} edges`);
        result.nodes.push(...expandedLayout.nodes);
        result.edges.push(...expandedLayout.edges);
      }
    } else {
      console.log(`Schema type is ${schema.type}, only showing root node`);
    }
    
    console.log(`Final diagram: ${result.nodes.length} nodes and ${result.edges.length} edges`);
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
