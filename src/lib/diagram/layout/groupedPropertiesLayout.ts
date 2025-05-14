
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
    
    // Create group node with the correct number of arguments (4)
    const groupNode = createGroupNode(
      `group-${type}`, // id
      type,            // label
      props.length,    // count
      `${type} Properties` // description
    );
    
    // Set position separately
    groupNode.position.x = pos.x;
    groupNode.position.y = pos.y;
    
    // Create edge from root to group
    const groupEdge = createEdge('root', groupNode.id, 'has');
    
    // Add group node and edge
    result.nodes.push(groupNode);
    result.edges.push(groupEdge);
    
    // Check if this specific group's parent path has its properties explicitly expanded
    const parentPropertiesPath = 'root.properties';
    const isParentPropertiesExplicitlyExpanded = collapsedPaths[parentPropertiesPath] === false;
    
    // Check if this specific group is collapsed
    const thisGroupExplicitlyCollapsed = collapsedPaths[groupPath] === true;
    
    // Process properties in this group if:
    // 1. The parent's properties are explicitly expanded (regardless of this group's collapsed state)
    // OR
    // 2. This group is NOT explicitly collapsed
    if (isParentPropertiesExplicitlyExpanded || !thisGroupExplicitlyCollapsed) {
      // FIX: Pass the correct arguments to processGroupProperties
      // Props is an array of {name: string, schema: any} objects
      processGroupProperties(
        props,  // Array of property objects
        schema.properties, // Record<string, any> containing all properties
        schema.required || [], 
        groupNode, 
        result, 
        1, 
        maxDepth,
        collapsedPaths,
        groupPath
      );
    }
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
    const fullPath = `${currentPath}.${prop.name}`;
    
    // Check if this path's parent has properties that are explicitly expanded
    const parentPropertiesPath = `${currentPath}.properties`;
    const isParentPropertiesExplicitlyExpanded = collapsedPaths[parentPropertiesPath] === false;
    
    // Check if this specific path is explicitly collapsed
    const isPathExplicitlyCollapsed = collapsedPaths[fullPath] === true;
    
    // Render the node if:
    // 1. If parent's properties path is explicitly expanded, always render direct children
    // 2. OR if this path is explicitly NOT collapsed (set to false)
    const shouldRenderNode = isParentPropertiesExplicitlyExpanded || collapsedPaths[fullPath] === false;
    
    // Skip if we shouldn't render this node
    if (!shouldRenderNode) {
      return;
    }
    
    // Create property node
    const propNode = createPropertyNode(
      prop,
      allProperties,
      required,
      x,
      y
    );
    
    // Mark as collapsed if explicitly set
    if (isPathExplicitlyCollapsed) {
      propNode.data.isCollapsed = true;
    }
    
    // Create edge from group to property
    const edge = createEdge(groupNode.id, propNode.id);
    
    // Add node and edge to result
    result.nodes.push(propNode);
    result.edges.push(edge);
    
    // Process child properties if this node isn't explicitly collapsed AND we haven't reached max depth
    if (!isPathExplicitlyCollapsed && currentDepth < maxDepth) {
      // Process children for objects and arrays
      if (prop.schema.type === 'object' && prop.schema.properties) {
        processChildProperties(
          prop.schema,
          propNode,
          result,
          currentDepth + 1,
          maxDepth,
          collapsedPaths,
          fullPath
        );
      } else if (prop.schema.type === 'array' && 
                prop.schema.items && 
                prop.schema.items.type === 'object' &&
                prop.schema.items.properties) {
        const itemPath = `${fullPath}.items`;
        processChildProperties(
          prop.schema.items,
          propNode,
          result,
          currentDepth + 1,
          maxDepth,
          collapsedPaths,
          itemPath
        );
      }
    }
  });
}

// Helper to process child properties (for nested objects and array items)
function processChildProperties(
  schema: any,
  parentNode: Node,
  result: DiagramElements,
  depth: number,
  maxDepth: number,
  collapsedPaths: CollapsedState,
  path: string
) {
  // Skip if reached max depth
  if (depth > maxDepth) return;
  
  if (!schema.properties) return;
  
  // Check parent properties path
  const parentPropertiesPath = `${path}.properties`;
  const isParentPropertiesExplicitlyExpanded = collapsedPaths[parentPropertiesPath] === false;
  
  // Skip if parent properties are not explicitly expanded and path is not explicitly expanded
  if (!isParentPropertiesExplicitlyExpanded && collapsedPaths[path] !== false) {
    return;
  }
  
  // Calculate positions for child properties
  const childProps = Object.entries(schema.properties);
  const spacing = 150;
  const totalWidth = childProps.length * spacing;
  const startX = parentNode.position.x - totalWidth / 2 + spacing / 2;
  const y = parentNode.position.y + 150;
  
  // Process each child property
  childProps.forEach(([childName, childSchema], index) => {
    const x = startX + index * spacing;
    const childPath = `${path}.${childName}`;
    const isChildExplicitlyCollapsed = collapsedPaths[childPath] === true;
    
    // Create child node
    const childNode = {
      id: `prop-${childPath}`,
      type: 'schemaType',
      position: { x, y },
      data: {
        label: childName,
        type: (childSchema as any).type || 'unknown',
        description: (childSchema as any).description || '',
        required: schema.required?.includes(childName) || false,
        isCollapsed: isChildExplicitlyCollapsed
      }
    };
    
    // Create edge from parent to child
    const edge = createEdge(parentNode.id, childNode.id);
    
    // Add child node and edge
    result.nodes.push(childNode);
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
