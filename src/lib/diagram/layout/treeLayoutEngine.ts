/**
 * Tree-based layout engine for deterministic node positioning.
 * Uses a two-pass algorithm:
 * 1. Bottom-up pass to calculate subtree widths
 * 2. Top-down pass to assign final positions
 */

import { Node, Edge } from '@xyflow/react';
import { estimateNodeSize, NodeDimensions } from './nodeSizeCalculator';

export interface TreeLayoutConfig {
  horizontalGap: number;      // Gap between sibling nodes
  verticalGap: number;        // Gap between parent and children
  minNodeWidth: number;       // Minimum width assumption
  minNodeHeight: number;      // Minimum height assumption
  centerChildren: boolean;    // Center children under parent
  rootX: number;              // X position for root node
  rootY: number;              // Y position for root node
}

interface LayoutNode {
  id: string;
  width: number;
  height: number;
  subtreeWidth: number;       // Total width needed for this node + all descendants
  children: LayoutNode[];
  x: number;
  y: number;
  depth: number;
}

const DEFAULT_CONFIG: TreeLayoutConfig = {
  horizontalGap: 40,
  verticalGap: 100,
  minNodeWidth: 150,
  minNodeHeight: 50,
  centerChildren: true,
  rootX: 0,
  rootY: 0,
};

/**
 * Builds a tree structure from nodes and edges
 */
function buildLayoutTree(
  nodes: Node[],
  edges: Edge[],
  nodeSizes: Map<string, NodeDimensions>,
  config: TreeLayoutConfig
): LayoutNode | null {
  if (nodes.length === 0) return null;
  
  // Create a map of node IDs to their data
  const nodeMap = new Map<string, Node>();
  nodes.forEach(n => nodeMap.set(n.id, n));
  
  // Build parent-child relationships from edges
  const childrenMap = new Map<string, string[]>();
  const hasParent = new Set<string>();
  
  edges.forEach(edge => {
    const sourceId = edge.source;
    const targetId = edge.target;
    
    if (!childrenMap.has(sourceId)) {
      childrenMap.set(sourceId, []);
    }
    childrenMap.get(sourceId)!.push(targetId);
    hasParent.add(targetId);
  });
  
  // Find root nodes (nodes without parents)
  const rootNodes = nodes.filter(n => !hasParent.has(n.id));
  
  // If no clear root, use the first node or 'root' node
  let rootNode = rootNodes.find(n => n.id === 'root') || rootNodes[0] || nodes[0];
  
  // Recursively build the tree
  function buildNode(nodeId: string, depth: number): LayoutNode {
    const node = nodeMap.get(nodeId);
    const size = nodeSizes.get(nodeId) || { 
      width: config.minNodeWidth, 
      height: config.minNodeHeight 
    };
    
    const children = (childrenMap.get(nodeId) || [])
      .filter(childId => nodeMap.has(childId))
      .map(childId => buildNode(childId, depth + 1));
    
    return {
      id: nodeId,
      width: Math.max(size.width, config.minNodeWidth),
      height: Math.max(size.height, config.minNodeHeight),
      subtreeWidth: 0, // Will be calculated
      children,
      x: 0,
      y: 0,
      depth,
    };
  }
  
  return buildNode(rootNode.id, 0);
}

/**
 * Bottom-up pass: Calculate subtree widths
 */
function calculateSubtreeWidths(node: LayoutNode, config: TreeLayoutConfig): number {
  if (node.children.length === 0) {
    node.subtreeWidth = node.width;
    return node.subtreeWidth;
  }
  
  // Calculate children subtree widths first
  let childrenTotalWidth = 0;
  for (const child of node.children) {
    childrenTotalWidth += calculateSubtreeWidths(child, config);
  }
  
  // Add gaps between children
  childrenTotalWidth += (node.children.length - 1) * config.horizontalGap;
  
  // Subtree width is max of node width and children total width
  node.subtreeWidth = Math.max(node.width, childrenTotalWidth);
  
  return node.subtreeWidth;
}

/**
 * Top-down pass: Assign positions
 */
function assignPositions(
  node: LayoutNode,
  centerX: number,
  y: number,
  config: TreeLayoutConfig
): void {
  // Position this node centered at centerX
  node.x = centerX - node.width / 2;
  node.y = y;
  
  if (node.children.length === 0) return;
  
  // Calculate starting X for children
  const childrenTotalWidth = node.children.reduce((sum, child) => sum + child.subtreeWidth, 0)
    + (node.children.length - 1) * config.horizontalGap;
  
  let currentX = centerX - childrenTotalWidth / 2;
  const childY = y + node.height + config.verticalGap;
  
  for (const child of node.children) {
    // Center child within its subtree space
    const childCenterX = currentX + child.subtreeWidth / 2;
    assignPositions(child, childCenterX, childY, config);
    currentX += child.subtreeWidth + config.horizontalGap;
  }
}

/**
 * Flattens the tree back into positioned nodes
 */
function flattenTree(node: LayoutNode, result: Map<string, { x: number; y: number }>): void {
  result.set(node.id, { x: node.x, y: node.y });
  for (const child of node.children) {
    flattenTree(child, result);
  }
}

/**
 * Main entry point: Apply tree layout to nodes
 */
export function applyTreeLayout(
  nodes: Node[],
  edges: Edge[],
  config: Partial<TreeLayoutConfig> = {}
): Node[] {
  if (nodes.length === 0) return nodes;
  
  const fullConfig: TreeLayoutConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Calculate node sizes
  const nodeSizes = new Map<string, NodeDimensions>();
  for (const node of nodes) {
    nodeSizes.set(node.id, estimateNodeSize(node.data, node.id));
  }
  
  // Build tree structure
  const tree = buildLayoutTree(nodes, edges, nodeSizes, fullConfig);
  if (!tree) return nodes;
  
  // Calculate subtree widths (bottom-up)
  calculateSubtreeWidths(tree, fullConfig);
  
  // Assign positions (top-down)
  assignPositions(tree, fullConfig.rootX, fullConfig.rootY, fullConfig);
  
  // Flatten back to position map
  const positions = new Map<string, { x: number; y: number }>();
  flattenTree(tree, positions);
  
  // Apply positions to nodes
  return nodes.map(node => {
    const pos = positions.get(node.id);
    if (pos) {
      return {
        ...node,
        position: { x: pos.x, y: pos.y },
      };
    }
    return node;
  });
}

/**
 * Check if a node position was manually set by user drag
 */
export function isUserPositioned(nodeId: string, userPositions: Map<string, { x: number; y: number }>): boolean {
  return userPositions.has(nodeId);
}

/**
 * Apply layout with respect to user-positioned nodes
 * User-positioned nodes keep their positions, others get calculated positions
 */
export function applyTreeLayoutWithUserPositions(
  nodes: Node[],
  edges: Edge[],
  userPositions: Map<string, { x: number; y: number }>,
  config: Partial<TreeLayoutConfig> = {}
): Node[] {
  // First apply normal tree layout
  const layoutedNodes = applyTreeLayout(nodes, edges, config);
  
  // Then override with user positions where applicable
  return layoutedNodes.map(node => {
    const userPos = userPositions.get(node.id);
    if (userPos) {
      return {
        ...node,
        position: { x: userPos.x, y: userPos.y },
      };
    }
    return node;
  });
}
