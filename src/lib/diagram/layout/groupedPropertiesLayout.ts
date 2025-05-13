
import { Node, Edge } from '@xyflow/react';
import { DiagramElements, CollapsedState } from '../types';
import { createEdge } from '../edgeGenerator';
import { createGroupNode } from '../nodeGenerator';
import { getGroupPositions } from './gridPositionUtils';

export const generateGroupedLayout = (
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
  
  // Check if root is collapsed (default to collapsed if not explicitly set)
  const rootCollapsed = collapsedPaths['root'] !== false;
  
  if (rootCollapsed) {
    console.log('Root is collapsed in groupedPropertiesLayout, skipping property nodes generation');
    return result;
  }
  
  // Get the top-level properties
  const properties = schema.properties;
  
  // Get groups of properties by type
  const propertyGroups = groupPropertiesByType(properties);
  
  // Position the groups in a grid layout
  const groupPositions = getGroupPositions(Object.keys(propertyGroups).length);
  
  // Create nodes and edges for each group
  let groupIdx = 0;
  for (const [type, props] of Object.entries(propertyGroups)) {
    const pos = groupPositions[groupIdx++] || { x: 0, y: 200 * groupIdx };
    const groupPath = `root.${type}`;
    
    // Skip if this group is collapsed (default to collapsed if not set)
    const isExplicitlyExpanded = collapsedPaths[groupPath] === false;
    if (!isExplicitlyExpanded) {
      console.log(`Skipping collapsed group: ${groupPath}`);
      continue;
    }
    
    // Create group node
    const groupNode = createGroupNode(
      type, 
      props.length, 
      `${type} Properties`, 
      pos.x, 
      pos.y
    );
    
    // Create edge from root to group
    const groupEdge = createEdge('root', groupNode.id, 'has');
    
    // Add group node and edge
    result.nodes.push(groupNode);
    result.edges.push(groupEdge);
    
    // Process properties in this group up to max depth
    processGroupProperties(
      props, 
      schema.properties, 
      schema.required || [], 
      groupNode, 
      result, 
      1, 
      maxDepth,
      collapsedPaths,
      groupPath
    );
  }
  
  return result;
};

// Group properties by their type
function groupPropertiesByType(properties: Record<string, any>) {
  const groups: Record<string, Array<{name: string, schema: any}>> = {};
  
  // Group properties by their type
  for (const [propName, propSchema] of Object.entries(properties)) {
    const type = propSchema.type || 'unknown';
    
    if (!groups[type]) {
      groups[type] = [];
    }
    
    groups[type].push({ name: propName, schema: propSchema });
  }
  
  return groups;
}

// Process properties within a group
function processGroupProperties(
  properties: Array<{name: string, schema: any}>,
  allProperties: Record<string, any>,
  required: string[],
  groupNode: Node,
  result: DiagramElements,
  currentDepth: number,
  maxDepth: number,
  collapsedPaths: CollapsedState = {},
  currentPath: string = ''
) {
  // Skip if we've reached max depth
  if (currentDepth > maxDepth) {
    return;
  }
  
  // Calculate positions for properties
  const count = properties.length;
  const spacing = 180;
  const totalWidth = count * spacing;
  const startX = groupNode.position.x - totalWidth / 2 + spacing / 2;
  const y = groupNode.position.y + 150;
  
  // Process each property
  properties.forEach((prop, index) => {
    const x = startX + index * spacing;
    const propPath = `${currentPath}.${prop.name}`;
    
    // Skip if this property is collapsed (default to collapsed if not explicitly set)
    const isExplicitlyExpanded = collapsedPaths[propPath] === false;
    if (!isExplicitlyExpanded) {
      console.log(`Skipping collapsed property in group: ${propPath}`);
      return;
    }
    
    // Create property node based on type
    const propNode = createPropertyNode(prop, allProperties, required, x, y);
    
    // Create edge from group to property
    const edge = createEdge(groupNode.id, propNode.id);
    
    // Add node and edge to result
    result.nodes.push(propNode);
    result.edges.push(edge);
  });
}

// Helper to create a property node
function createPropertyNode(
  prop: {name: string, schema: any},
  allProperties: Record<string, any>,
  required: string[],
  x: number,
  y: number
): Node {
  const isRequired = required.includes(prop.name);
  
  return {
    id: `prop-${prop.name}`,
    type: 'schemaType',
    position: { x, y },
    data: {
      label: prop.name,
      type: prop.schema.type || 'unknown',
      description: prop.schema.description || '',
      required: isRequired,
      format: prop.schema.format || null,
      default: prop.schema.default,
      enum: prop.schema.enum
    }
  };
}
