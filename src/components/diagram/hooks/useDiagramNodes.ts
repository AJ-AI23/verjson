
import { useState, useEffect, useCallback, useRef } from 'react';
import { Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import { generateNodesAndEdges } from '@/lib/diagram';
import { useNodePositions } from './useNodePositions';

export const useDiagramNodes = (
  schema: any, 
  error: boolean, 
  groupProperties: boolean
) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [prevGroupSetting, setPrevGroupSetting] = useState(groupProperties);
  const [schemaKey, setSchemaKey] = useState(0);
  const { nodePositionsRef, applyStoredPositions } = useNodePositions(nodes);
  
  // Track schema changes
  const schemaStringRef = useRef<string>('');

  // Generate a new schema key when schema really changes
  useEffect(() => {
    if (schema) {
      // Convert schema to string for comparison
      const schemaString = JSON.stringify(schema);
      
      // Only update schema key if schema or grouping changed
      if (schemaString !== schemaStringRef.current || prevGroupSetting !== groupProperties) {
        console.log('Schema or groupProperties changed, updating schema key');
        schemaStringRef.current = schemaString;
        // Use simple counter for schema key instead of timestamp
        setSchemaKey(prev => prev + 1);
      }
    }
  }, [schema, error, groupProperties, prevGroupSetting]);

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

  // Effect for schema or error changes - simplified approach
  useEffect(() => {
    if (schema && !error) {
      console.log('Generating nodes and edges');
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
      
      // Apply saved positions to new nodes where possible
      const positionedNodes = applyStoredPositions(newNodes);
      console.log(`Generated ${positionedNodes.length} nodes and ${newEdges.length} edges`);
      
      // Set nodes first
      setNodes(positionedNodes);
      
      // Then add edges after a small delay
      setTimeout(() => {
        validateAndSetEdges(newEdges);
      }, 50);
    } else {
      // Clear both nodes and edges when there's an error or no schema
      if (nodes.length > 0 || edges.length > 0) {
        console.log('Clearing nodes and edges due to error or no schema');
        setNodes([]);
        setEdges([]);
      }
    }
  }, [schema, error, groupProperties, setNodes, setEdges, schemaKey, applyStoredPositions, validateAndSetEdges, nodes.length, edges.length]);

  // Effect specifically for groupProperties toggle changes
  useEffect(() => {
    if (prevGroupSetting !== groupProperties) {
      console.log('Group properties setting changed');
      setPrevGroupSetting(groupProperties);
    }
  }, [groupProperties, prevGroupSetting]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    nodePositionsRef,
    schemaKey
  };
};
