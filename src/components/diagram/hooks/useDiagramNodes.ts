
import { useState, useEffect, useCallback } from 'react';
import { Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import { generateNodesAndEdges } from '@/lib/diagram';
import { useNodePositions } from './useNodePositions';

export const useDiagramNodes = (
  schema: any, 
  error: boolean, 
  groupProperties: boolean
) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [prevGroupSetting, setPrevGroupSetting] = useState(groupProperties);
  const [schemaKey, setSchemaKey] = useState(0);
  const { nodePositionsRef, applyStoredPositions } = useNodePositions(nodes);

  // Generate a new schema key when schema changes to force complete re-evaluation
  useEffect(() => {
    if (schema) {
      setSchemaKey(prev => prev + 1);
    }
  }, [schema, error, groupProperties]);

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
      setEdges(validEdges);
    } else {
      setEdges(currentEdges);
    }
  }, [nodes, setEdges]);

  // Effect for schema or error changes
  useEffect(() => {
    if (schema && !error) {
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
      
      // Apply saved positions to new nodes where possible
      const positionedNodes = applyStoredPositions(newNodes);
      
      // Always reset both nodes and edges completely to avoid orphaned edges
      setNodes(positionedNodes);
      // Ensure we start with a clean slate for edges
      setEdges([]);
      // Then add the new edges after a small delay to ensure nodes are rendered
      setTimeout(() => {
        validateAndSetEdges(newEdges);
      }, 50);
    } else {
      // Clear both nodes and edges when there's an error or no schema
      setNodes([]);
      setEdges([]);
    }
  }, [schema, error, groupProperties, setNodes, setEdges, schemaKey, applyStoredPositions, validateAndSetEdges]);

  // Effect specifically for groupProperties toggle changes
  useEffect(() => {
    if (prevGroupSetting !== groupProperties) {
      // Force a complete reset of edges when toggling the grouping mode
      setPrevGroupSetting(groupProperties);
      
      if (schema && !error) {
        const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
        
        // When changing group mode, try to maintain positions where possible
        const positionedNodes = applyStoredPositions(newNodes);
        
        // Clear edges before setting nodes to avoid orphaned edges
        setEdges([]);
        setNodes(positionedNodes);
        
        // Add edges after a small delay to ensure nodes are rendered
        setTimeout(() => {
          validateAndSetEdges(newEdges);
        }, 50);
      }
    }
  }, [groupProperties, prevGroupSetting, schema, error, setNodes, setEdges, applyStoredPositions, validateAndSetEdges]);

  // Validate edges against nodes
  useEffect(() => {
    if (nodes.length > 0) {
      validateAndSetEdges(edges);
    } else if (nodes.length === 0 && edges.length > 0) {
      // If there are no nodes but there are edges, clear the edges
      setEdges([]);
    }
  }, [nodes, edges, setEdges, validateAndSetEdges]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setNodes,
    setEdges,
    nodePositionsRef,
    schemaKey
  };
};
