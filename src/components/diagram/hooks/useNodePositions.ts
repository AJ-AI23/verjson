
import { useRef, useEffect, useCallback } from 'react';
import { Node } from '@xyflow/react';

export const useNodePositions = (nodes: Node[]) => {
  const nodePositionsRef = useRef<Record<string, { x: number, y: number }>>({});
  const positionsUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store node positions when they change - with throttling
  useEffect(() => {
    if (nodes.length > 0) {
      // Clear any existing timer
      if (positionsUpdateTimerRef.current) {
        clearTimeout(positionsUpdateTimerRef.current);
      }
      
      // Throttle position updates
      positionsUpdateTimerRef.current = setTimeout(() => {
        const newPositions: Record<string, { x: number, y: number }> = {};
        nodes.forEach(node => {
          newPositions[node.id] = { x: node.position.x, y: node.position.y };
        });
        nodePositionsRef.current = newPositions;
        positionsUpdateTimerRef.current = null;
      }, 200); // Throttle updates with a 200ms delay
    }
  }, [nodes]);

  // Apply saved positions to new nodes with memoization
  const applyStoredPositions = useCallback((newNodes: Node[]): Node[] => {
    // If no saved positions, return nodes as-is
    if (Object.keys(nodePositionsRef.current).length === 0) {
      return newNodes;
    }
    
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

  return {
    nodePositionsRef,
    applyStoredPositions
  };
};
