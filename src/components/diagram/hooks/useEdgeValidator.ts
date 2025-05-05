
import { useCallback } from 'react';
import { Edge } from '@xyflow/react';

/**
 * Hook to validate edges and ensure there are no orphaned edges
 */
export const useEdgeValidator = (
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void,
  nodes: any[]
) => {
  // Validate edges against nodes to ensure no orphaned edges
  const validateAndSetEdges = useCallback((currentEdges: Edge[]) => {
    if (nodes.length === 0) {
      setEdges([]);
      return;
    }
    
    // Get all valid node IDs
    const nodeIds = new Set(nodes.map(node => node.id));
    
    // Filter edges to only include those where both source and target exist
    const validEdges = currentEdges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
    
    // If we filtered out any edges, update the edges state
    if (validEdges.length !== currentEdges.length) {
      console.log(`Removed ${currentEdges.length - validEdges.length} orphaned edges`);
    }
    
    setEdges(validEdges);
  }, [nodes, setEdges]);

  return validateAndSetEdges;
};
