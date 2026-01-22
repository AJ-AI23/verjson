
import { useRef, useEffect, useCallback } from 'react';
import { Node } from '@xyflow/react';

/**
 * Tracks user-dragged node positions separately from calculated positions.
 * Only user-dragged positions are preserved across layout recalculations.
 */
export const useNodePositions = (nodes: Node[]) => {
  // Positions set by user dragging (these should be preserved)
  const userDraggedPositionsRef = useRef<Record<string, { x: number, y: number }>>({});
  // All current node positions (for backwards compatibility)
  const nodePositionsRef = useRef<Record<string, { x: number, y: number }>>({});
  
  // Store all node positions when they change (for backwards compatibility)
  useEffect(() => {
    if (nodes.length > 0) {
      const newPositions: Record<string, { x: number, y: number }> = {};
      nodes.forEach(node => {
        newPositions[node.id] = { x: node.position.x, y: node.position.y };
      });
      nodePositionsRef.current = newPositions;
    }
  }, [nodes]);

  /**
   * Record that a node was manually dragged by the user.
   * Only these positions will be preserved across layout recalculations.
   */
  const recordUserDrag = useCallback((nodeId: string, position: { x: number, y: number }) => {
    userDraggedPositionsRef.current[nodeId] = position;
  }, []);

  /**
   * Apply only user-dragged positions to new nodes.
   * Nodes that weren't manually dragged will use the tree layout calculated positions.
   */
  const applyStoredPositions = useCallback((newNodes: Node[]): Node[] => {
    // Only apply positions for nodes that were explicitly dragged by the user
    return newNodes.map(node => {
      if (userDraggedPositionsRef.current[node.id]) {
        return {
          ...node,
          position: userDraggedPositionsRef.current[node.id]
        };
      }
      // Return node with its calculated position from tree layout
      return node;
    });
  }, []);

  // Clear all stored positions (both user-dragged and calculated)
  const clearPositions = useCallback(() => {
    userDraggedPositionsRef.current = {};
    nodePositionsRef.current = {};
  }, []);

  return {
    nodePositionsRef,
    userDraggedPositionsRef,
    applyStoredPositions,
    clearPositions,
    recordUserDrag
  };
};
