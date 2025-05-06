import { useState, useEffect, useCallback, useRef } from 'react';
import { Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import { generateNodesAndEdges } from '@/lib/diagram';
import { useNodePositions } from './useNodePositions';
import { DiagramOptions } from '@/lib/diagram/types';

export const useDiagramNodes = (
  schema: any, 
  error: boolean, 
  groupProperties: boolean,
  initialMaxDepth: number = 3  // Default max depth
) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [prevGroupSetting, setPrevGroupSetting] = useState(groupProperties);
  const [schemaKey, setSchemaKey] = useState(0);
  const [maxDepth, setMaxDepth] = useState(initialMaxDepth);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
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
    
    // If we filtered out any edges, update the edges state
    if (validEdges.length !== currentEdges.length) {
      console.log(`Removed ${currentEdges.length - validEdges.length} orphaned edges`);
    }
    
    setEdges(validEdges);
  }, [nodes, setEdges]);

  // Toggle node expansion
  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      // If already expanded, remove it
      if (prev.includes(nodeId)) {
        return prev.filter(id => id !== nodeId);
      }
      // Otherwise, add it
      return [...prev, nodeId];
    });
  }, []);

  // Update max depth
  const updateMaxDepth = useCallback((newDepth: number) => {
    setMaxDepth(newDepth);
  }, []);

  // Effect for schema or error changes - simplified approach
  useEffect(() => {
    if (schema && !error) {
      console.log('Generating nodes and edges');
      const options: DiagramOptions = {
        maxDepth,
        expandedNodes
      };
      
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges({
        schema,
        options,
        groupProperties
      });
      
      // Apply saved positions to new nodes where possible
      const positionedNodes = applyStoredPositions(newNodes);
      console.log(`Generated ${positionedNodes.length} nodes and ${newEdges.length} edges`);
      
      // Add expansion controls to nodes that can be expanded
      const nodesWithControls = positionedNodes.map(node => {
        // Check if this node has children that might be hidden due to depth
        const hasHiddenChildren = newEdges.some(edge => 
          edge.source === node.id && 
          !positionedNodes.some(n => n.id === edge.target)
        );
        
        if (hasHiddenChildren) {
          return {
            ...node,
            data: {
              ...node.data,
              expandable: true,
              expanded: expandedNodes.includes(node.id),
              onExpand: () => toggleNodeExpansion(node.id)
            }
          };
        }
        
        return node;
      });
      
      // Batch the updates to minimize re-renders
      updateTimeoutRef.current = window.setTimeout(() => {
        setNodes(nodesWithControls);
        validateAndSetEdges(newEdges);
        updateTimeoutRef.current = null;
      }, 10);
    } else {
      // Clear both nodes and edges when there's an error or no schema
      if (nodes.length > 0 || edges.length > 0) {
        console.log('Clearing nodes and edges due to error or no schema');
        setNodes([]);
        setEdges([]);
      }
    }
    
    // Cleanup
    return () => {
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [
    schema, 
    error, 
    groupProperties, 
    maxDepth, 
    expandedNodes, 
    setNodes, 
    setEdges, 
    schemaKey, 
    applyStoredPositions, 
    validateAndSetEdges, 
    nodes.length, 
    edges.length,
    toggleNodeExpansion
  ]);

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
    schemaKey,
    maxDepth,
    updateMaxDepth,
    toggleNodeExpansion,
    expandedNodes
  };
};
