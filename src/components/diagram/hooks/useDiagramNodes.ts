
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
  const updateTimeoutRef = useRef<number | null>(null);

  // Generate a new schema key when schema really changes
  useEffect(() => {
    if (schema) {
      // Convert schema to string for comparison
      const schemaString = JSON.stringify(schema);
      
      // Only update schema key if schema or grouping changed
      if (schemaString !== schemaStringRef.current || prevGroupSetting !== groupProperties) {
        console.log('Schema or groupProperties changed');
        schemaStringRef.current = schemaString;
        
        // Clear any pending updates
        if (updateTimeoutRef.current !== null) {
          clearTimeout(updateTimeoutRef.current);
        }
        
        // Use simple counter for schema key
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
    
    // Log information about the edges for debugging
    console.log(`Setting ${validEdges.length} valid edges out of ${currentEdges.length} total edges`);
    if (validEdges.length === 0 && currentEdges.length > 0) {
      console.log("Warning: All edges were filtered out!");
      
      // Debug what node IDs are available vs what the edges are trying to connect
      const sourceTargetPairs = currentEdges.map(edge => ({ source: edge.source, target: edge.target }));
      console.log("Available node IDs:", Array.from(nodeIds));
      console.log("Edge connections:", sourceTargetPairs);
    }
    
    // Set the validated edges
    setEdges(validEdges);
  }, [nodes, setEdges]);

  // Effect for schema or error changes - simplified approach
  useEffect(() => {
    if (schema && !error) {
      console.log('Generating nodes and edges');
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
      
      console.log(`Generated ${newNodes.length} nodes and ${newEdges.length} edges`);
      
      // First set the nodes to ensure they're available for edge validation
      const positionedNodes = applyStoredPositions(newNodes);
      setNodes(positionedNodes);
      
      // Then set the edges with a small delay to ensure nodes are processed
      setTimeout(() => {
        validateAndSetEdges(newEdges);
      }, 50);
    } else {
      // Clear both nodes and edges when there's an error or no schema
      setNodes([]);
      setEdges([]);
    }
    
    // Cleanup
    return () => {
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [schema, error, groupProperties, setNodes, setEdges, schemaKey, applyStoredPositions, validateAndSetEdges]);

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
