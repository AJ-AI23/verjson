
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
  
  // Track schema changes to avoid unnecessary regeneration
  const schemaStringRef = useRef<string>('');
  const lastGenerationTimeRef = useRef<number>(0);

  // Generate a new schema key when schema really changes
  useEffect(() => {
    if (schema) {
      // Convert schema to string for comparison
      const schemaString = JSON.stringify(schema);
      
      // Only update schema key if schema actually changed or error/group settings changed
      if (schemaString !== schemaStringRef.current || prevGroupSetting !== groupProperties) {
        console.log('Schema or groupProperties changed, updating schema key');
        schemaStringRef.current = schemaString;
        // Add current timestamp to ensure uniqueness even with same content
        setSchemaKey(Date.now());
        lastGenerationTimeRef.current = Date.now();
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

  // Effect for schema or error changes
  useEffect(() => {
    if (schema && !error) {
      // Check if enough time has passed since the last generation
      const now = Date.now();
      const timeSinceLastGeneration = now - lastGenerationTimeRef.current;
      console.log(`Time since last generation: ${timeSinceLastGeneration}ms`);
      
      // Use small debounce to prevent too frequent regeneration
      if (timeSinceLastGeneration < 100) {
        console.log('Skipping node generation due to debounce');
        return;
      }
      
      console.log('Generating nodes and edges');
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
      lastGenerationTimeRef.current = now;
      
      // Apply saved positions to new nodes where possible
      const positionedNodes = applyStoredPositions(newNodes);
      console.log(`Generated ${positionedNodes.length} nodes and ${newEdges.length} edges`);
      
      // Set nodes first
      setNodes(positionedNodes);
      
      // Then add edges after a small delay
      const timeoutId = setTimeout(() => {
        validateAndSetEdges(newEdges);
      }, 150);
      
      return () => clearTimeout(timeoutId);
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
      // Force a complete reset of edges when toggling the grouping mode
      console.log('Group properties setting changed');
      setPrevGroupSetting(groupProperties);
      
      if (schema && !error) {
        const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
        
        // When changing group mode, try to maintain positions where possible
        const positionedNodes = applyStoredPositions(newNodes);
        console.log(`Generated ${positionedNodes.length} nodes with new group setting`);
        
        // Set nodes
        setNodes(positionedNodes);
        
        // Add edges after a delay
        const timeoutId = setTimeout(() => {
          validateAndSetEdges(newEdges);
        }, 150);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [groupProperties, prevGroupSetting, schema, error, setNodes, setEdges, applyStoredPositions, validateAndSetEdges]);

  // Validate edges against nodes
  useEffect(() => {
    if (nodes.length > 0 && edges.length > 0) {
      validateAndSetEdges(edges);
    } else if (nodes.length === 0 && edges.length > 0) {
      // If there are no nodes but there are edges, clear the edges
      setEdges([]);
    }
  }, [nodes.length, edges.length, validateAndSetEdges, setEdges, edges]);

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
