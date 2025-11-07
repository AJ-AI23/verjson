import { DiagramNode } from '@/types/diagram';
import { Node } from '@xyflow/react';
import { getNodeTypeConfig } from './sequenceNodeTypes';

/**
 * Minimum vertical margin between nodes in pixels
 * This ensures nodes don't overlap and maintains visual clarity
 */
export const MIN_VERTICAL_MARGIN = 40;

/**
 * Minimum Y position for nodes (upper limit)
 * Nodes should not go above the lifeline header area
 */
export const MIN_NODE_Y_POSITION = 140;

interface NodeWithHeight {
  id: string;
  y: number;
  height: number;
}

/**
 * Get the height of a diagram node based on its type
 */
export function getNodeHeight(node: DiagramNode): number {
  const nodeConfig = getNodeTypeConfig(node.type);
  return nodeConfig?.defaultHeight || 70;
}

/**
 * Check if two nodes overlap or are too close vertically
 */
export function hasInsufficientMargin(
  node1Y: number,
  node1Height: number,
  node2Y: number,
  node2Height: number
): boolean {
  const node1Bottom = node1Y + node1Height;
  const node2Bottom = node2Y + node2Height;
  
  // Check if node1 is above node2
  if (node1Y < node2Y) {
    const gap = node2Y - node1Bottom;
    return gap < MIN_VERTICAL_MARGIN;
  }
  
  // Check if node2 is above node1
  if (node2Y < node1Y) {
    const gap = node1Y - node2Bottom;
    return gap < MIN_VERTICAL_MARGIN;
  }
  
  return false;
}

/**
 * Calculate the valid Y range for a node being dragged
 * Returns min and max Y positions that respect spacing constraints
 */
export function calculateValidDragRange(
  draggedNodeId: string,
  allDiagramNodes: DiagramNode[]
): { minY: number; maxY: number } {
  // Get all nodes with their heights and current positions, sorted by Y position
  const nodesWithHeights: NodeWithHeight[] = allDiagramNodes
    .map(node => ({
      id: node.id,
      y: node.position?.y || 0,
      height: getNodeHeight(node)
    }))
    .sort((a, b) => a.y - b.y);
  
  const draggedNodeIndex = nodesWithHeights.findIndex(n => n.id === draggedNodeId);
  if (draggedNodeIndex === -1) {
    return { minY: MIN_NODE_Y_POSITION, maxY: 10000 };
  }
  
  const draggedNode = nodesWithHeights[draggedNodeIndex];
  
  // Calculate minimum Y (node above + margin, or absolute minimum)
  let minY = MIN_NODE_Y_POSITION;
  if (draggedNodeIndex > 0) {
    const nodeAbove = nodesWithHeights[draggedNodeIndex - 1];
    const minFromAbove = nodeAbove.y + nodeAbove.height + MIN_VERTICAL_MARGIN;
    minY = Math.max(minY, minFromAbove);
  }
  
  // Calculate maximum Y (node below - margin, or very large number)
  let maxY = 10000;
  if (draggedNodeIndex < nodesWithHeights.length - 1) {
    const nodeBelow = nodesWithHeights[draggedNodeIndex + 1];
    maxY = nodeBelow.y - draggedNode.height - MIN_VERTICAL_MARGIN;
  }
  
  return { minY, maxY };
}

/**
 * Calculate adjusted positions for all nodes to maintain minimum vertical margins
 * Returns a map of node IDs to their new Y positions, or null if the drag would cause invalid overlaps
 */
export function calculateAdjustedPositions(
  draggedNodeId: string,
  draggedNodeNewY: number,
  allDiagramNodes: DiagramNode[]
): Map<string, number> | null {
  const adjustedPositions = new Map<string, number>();
  
  // Get all nodes with their heights and current positions, sorted by Y position
  const nodesWithHeights: NodeWithHeight[] = allDiagramNodes
    .map(node => ({
      id: node.id,
      y: node.position?.y || 0,
      height: getNodeHeight(node)
    }))
    .sort((a, b) => a.y - b.y);
  
  // Set the dragged node's new position
  const draggedNodeIndex = nodesWithHeights.findIndex(n => n.id === draggedNodeId);
  if (draggedNodeIndex === -1) return adjustedPositions;
  
  const draggedNodeHeight = nodesWithHeights[draggedNodeIndex].height;
  adjustedPositions.set(draggedNodeId, draggedNodeNewY);
  
  // Update the dragged node in our working array
  nodesWithHeights[draggedNodeIndex] = {
    ...nodesWithHeights[draggedNodeIndex],
    y: draggedNodeNewY
  };
  
  // Re-sort after updating dragged node position
  nodesWithHeights.sort((a, b) => a.y - b.y);
  
  // Find the new index of the dragged node after sorting
  const newDraggedIndex = nodesWithHeights.findIndex(n => n.id === draggedNodeId);
  
  // Adjust nodes above the dragged node (moving up from dragged node)
  let hitUpperLimit = false;
  for (let i = newDraggedIndex - 1; i >= 0; i--) {
    const currentNode = nodesWithHeights[i];
    const nodeBelow = nodesWithHeights[i + 1];
    
    const currentBottom = currentNode.y + currentNode.height;
    const requiredTop = nodeBelow.y;
    const gap = requiredTop - currentBottom;
    
    if (gap < MIN_VERTICAL_MARGIN) {
      // Calculate the new position needed to maintain margin
      const newY = nodeBelow.y - currentNode.height - MIN_VERTICAL_MARGIN;
      
      // Check if this would push the node above the upper limit
      if (newY < MIN_NODE_Y_POSITION) {
        hitUpperLimit = true;
        break;
      }
      
      nodesWithHeights[i] = { ...currentNode, y: newY };
      adjustedPositions.set(currentNode.id, newY);
    }
  }
  
  // If we hit the upper limit, check if there are still overlaps
  if (hitUpperLimit) {
    for (let i = 0; i < nodesWithHeights.length - 1; i++) {
      const current = nodesWithHeights[i];
      const next = nodesWithHeights[i + 1];
      const gap = next.y - (current.y + current.height);
      
      if (gap < MIN_VERTICAL_MARGIN) {
        // Invalid drag - would cause overlaps
        return null;
      }
    }
  }
  
  // Adjust nodes below the dragged node (moving down from dragged node)
  for (let i = newDraggedIndex + 1; i < nodesWithHeights.length; i++) {
    const currentNode = nodesWithHeights[i];
    const nodeAbove = nodesWithHeights[i - 1];
    
    const nodeAboveBottom = nodeAbove.y + nodeAbove.height;
    const gap = currentNode.y - nodeAboveBottom;
    
    if (gap < MIN_VERTICAL_MARGIN) {
      // Push this node down to maintain margin
      const newY = nodeAboveBottom + MIN_VERTICAL_MARGIN;
      nodesWithHeights[i] = { ...currentNode, y: newY };
      adjustedPositions.set(currentNode.id, newY);
    }
  }
  
  return adjustedPositions;
}

/**
 * Apply adjusted positions to React Flow nodes
 */
export function applyAdjustedPositions(
  nodes: Node[],
  adjustedPositions: Map<string, number>
): Node[] {
  return nodes.map(node => {
    const newY = adjustedPositions.get(node.id);
    if (newY !== undefined && node.type === 'sequenceNode') {
      return {
        ...node,
        position: { ...node.position, y: newY }
      };
    }
    return node;
  });
}

/**
 * Apply adjusted positions to diagram nodes (for data sync)
 */
export function applyAdjustedPositionsToDiagramNodes(
  diagramNodes: DiagramNode[],
  adjustedPositions: Map<string, number>
): DiagramNode[] {
  return diagramNodes.map(node => {
    const newY = adjustedPositions.get(node.id);
    if (newY !== undefined) {
      const nodeHeight = getNodeHeight(node);
      const nodeCenterY = newY + (nodeHeight / 2);
      
      return {
        ...node,
        position: { ...node.position, y: newY },
        anchors: node.anchors?.map(a => ({ ...a, yPosition: nodeCenterY })) as any
      };
    }
    return node;
  });
}
