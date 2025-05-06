
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import { generateNodesAndEdges } from '@/lib/diagram';
import { useNodePositions } from './useNodePositions';
import { CollapsedState } from '@/lib/diagram/types';

export const useDiagramNodes = (
  schema: any, 
  error: boolean, 
  groupProperties: boolean,
  maxDepth: number = 3,
  collapsedPaths: CollapsedState = {}
) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [prevGroupSetting, setPrevGroupSetting] = useState(groupProperties);
  const [schemaKey, setSchemaKey] = useState(0);
  const { nodePositionsRef, applyStoredPositions } = useNodePositions(nodes);
  
  // Track schema changes
  const schemaStringRef = useRef<string>('');
  const collapsedPathsRef = useRef<CollapsedState>(collapsedPaths);
  const updateTimeoutRef = useRef<number | null>(null);
  const processingUpdateRef = useRef<boolean>(false);
  const previousMaxDepthRef = useRef<number>(maxDepth);

  // Memoize the schema JSON string for comparison
  const schemaString = useMemo(() => {
    return schema ? JSON.stringify(schema) : '';
  }, [schema]);

  // Memoize the collapsedPaths JSON string for comparison
  const collapsedPathsString = useMemo(() => {
    return JSON.stringify(collapsedPaths);
  }, [collapsedPaths]);

  // Generate a new schema key when schema, grouping, maxDepth, or collapsedPaths changes
  useEffect(() => {
    // Skip if we're already processing an update
    if (processingUpdateRef.current) return;

    // Only update if something important has changed
    const maxDepthChanged = previousMaxDepthRef.current !== maxDepth;
    const schemaChanged = schemaString !== schemaStringRef.current;
    const groupSettingChanged = prevGroupSetting !== groupProperties;
    const collapsedPathsChanged = collapsedPathsString !== JSON.stringify(collapsedPathsRef.current);
    
    if (schema && (schemaChanged || groupSettingChanged || maxDepthChanged || collapsedPathsChanged)) {
      console.log('Schema or settings changed, generating new diagram');
      
      // Update refs with current values
      schemaStringRef.current = schemaString;
      collapsedPathsRef.current = {...collapsedPaths};
      previousMaxDepthRef.current = maxDepth;
      
      // Clear any pending updates
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Use simple counter for schema key
      setSchemaKey(prev => prev + 1);
    }
  }, [schema, schemaString, groupProperties, prevGroupSetting, maxDepth, collapsedPaths, collapsedPathsString]);

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

  // Effect for schema or error changes - optimized
  useEffect(() => {
    // Skip if nothing has changed
    if (processingUpdateRef.current || 
        !schema || 
        error || 
        (schemaStringRef.current === schemaString && 
         prevGroupSetting === groupProperties && 
         previousMaxDepthRef.current === maxDepth &&
         JSON.stringify(collapsedPathsRef.current) === collapsedPathsString)) {
      return;
    }
    
    // Mark that we're processing an update
    processingUpdateRef.current = true;
    
    console.log(`Generating nodes and edges with maxDepth: ${maxDepth}`);
    const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties, maxDepth, collapsedPaths);
    
    // Apply saved positions to new nodes where possible
    const positionedNodes = applyStoredPositions(newNodes);
    console.log(`Generated ${positionedNodes.length} nodes and ${newEdges.length} edges`);
    
    // Batch the updates to minimize re-renders
    updateTimeoutRef.current = window.setTimeout(() => {
      setNodes(positionedNodes);
      validateAndSetEdges(newEdges);
      updateTimeoutRef.current = null;
      processingUpdateRef.current = false;
    }, 50);
    
    return () => {
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
        processingUpdateRef.current = false;
      }
    };
  }, [schema, schemaString, error, groupProperties, maxDepth, collapsedPaths, collapsedPathsString, 
      setNodes, setEdges, applyStoredPositions, validateAndSetEdges, prevGroupSetting]);

  // Clean up when there's an error or no schema
  useEffect(() => {
    if (error || !schema) {
      if (nodes.length > 0 || edges.length > 0) {
        console.log('Clearing nodes and edges due to error or no schema');
        processingUpdateRef.current = true;
        setNodes([]);
        setEdges([]);
        processingUpdateRef.current = false;
      }
    }
  }, [error, schema, nodes.length, edges.length, setNodes, setEdges]);

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
