
import { useRef, useEffect, useCallback } from 'react';
import { Node } from '@xyflow/react';

export const useNodePositions = (nodes: Node[]) => {
  const nodePositionsRef = useRef<Record<string, { x: number, y: number }>>({});
  
  // Store node positions when they change
  useEffect(() => {
    if (nodes.length > 0) {
      const newPositions: Record<string, { x: number, y: number }> = {};
      nodes.forEach(node => {
        newPositions[node.id] = { x: node.position.x, y: node.position.y };
      });
      nodePositionsRef.current = newPositions;
    }
  }, [nodes]);

  // Apply saved positions to new nodes
  const applyStoredPositions = useCallback((newNodes: Node[]): Node[] => {
    return newNodes.map(node => {
      if (nodePositionsRef.current[node.id]) {
        return {
          ...node,
          position: nodePositionsRef.current[node.id]
        };
      }
      return node;
    });
  }, []);

  // Clear all stored positions
  const clearPositions = useCallback(() => {
    nodePositionsRef.current = {};
  }, []);

  return {
    nodePositionsRef,
    applyStoredPositions,
    clearPositions
  };
};
