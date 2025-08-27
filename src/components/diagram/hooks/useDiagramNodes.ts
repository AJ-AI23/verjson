
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import { generateNodesAndEdges } from '@/lib/diagram';
import { useNodePositions } from './useNodePositions';
import { CollapsedState } from '@/lib/diagram/types';
import { deepEqual, createStableHash } from '@/lib/utils/deepEqual';

export const useDiagramNodes = (
  schema: any, 
  error: boolean, 
  groupProperties: boolean,
  collapsedPaths: CollapsedState = {}
) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [prevGroupSetting, setPrevGroupSetting] = useState(groupProperties);
  const [schemaKey, setSchemaKey] = useState(0);
  const { nodePositionsRef, applyStoredPositions } = useNodePositions(nodes);
  
  // Track schema changes with stable references
  const prevSchemaRef = useRef<any>(null);
  const prevCollapsedPathsRef = useRef<CollapsedState>({});
  const prevGroupPropertiesRef = useRef<boolean>(groupProperties);
  const updateTimeoutRef = useRef<number | null>(null);
  const processingUpdateRef = useRef<boolean>(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const initialRenderRef = useRef<boolean>(true);

  // Create stable hashes for efficient comparison
  const schemaHash = useMemo(() => {
    return schema ? createStableHash(schema) : '';
  }, [schema]);

  const collapsedPathsHash = useMemo(() => {
    return createStableHash(collapsedPaths);
  }, [collapsedPaths]);

  // Update schemaKey when collapsedPaths changes - ensure this always triggers
  useEffect(() => {
    if (!deepEqual(collapsedPaths, prevCollapsedPathsRef.current)) {
      setSchemaKey(prev => prev + 1);
      prevCollapsedPathsRef.current = { ...collapsedPaths };
    }
  }, [collapsedPathsHash, collapsedPaths]);

  // Throttle updates to prevent excessive rendering, but be more permissive for schema changes
  const throttleUpdates = useCallback((schemaChanged: boolean) => {
    const now = Date.now();
    // For schema changes, use shorter throttle time (100ms)
    // For other changes, use longer throttle time (300ms)
    const throttleTime = schemaChanged ? 100 : 300;
    return (now - lastUpdateTimeRef.current) < throttleTime;
  }, []);

  // Generate nodes and edges when dependencies change
  useEffect(() => {
    // Check if this is the initial render before changing the flag
    const isInitialRender = initialRenderRef.current;
    
    // Mark initial render as done
    if (isInitialRender) {
      initialRenderRef.current = false;
    }

    // Skip if we're already processing an update  
    if (processingUpdateRef.current) {
      return;
    }
    
    // Skip if there's an error or no schema
    if (error) {
      if (nodes.length > 0 || edges.length > 0) {
        setNodes([]);
        setEdges([]);
      }
      return;
    }
    
    if (!schema) {
      if (nodes.length > 0 || edges.length > 0) {
        setNodes([]);
        setEdges([]);
      }
      return;
    }
    
  // Only update if something important has changed using safe comparison
  const schemaChanged = prevSchemaRef.current === null || !deepEqual(schema, prevSchemaRef.current);
  const groupSettingChanged = prevGroupPropertiesRef.current !== groupProperties;
  const collapsedPathsChanged = !deepEqual(collapsedPaths, prevCollapsedPathsRef.current);
  
  // Force update on initial render to make sure root node is always shown
  const forceUpdate = isInitialRender;
  
  // Add safety check for schema structure
  const hasValidSchema = schema && (typeof schema === 'object');
  
  if ((schemaChanged || groupSettingChanged || collapsedPathsChanged || forceUpdate) && hasValidSchema) {
      // Update refs with current values - use deep cloning to prevent reference issues  
      prevSchemaRef.current = schema;
      prevCollapsedPathsRef.current = { ...collapsedPaths };
      prevGroupPropertiesRef.current = groupProperties;
      lastUpdateTimeRef.current = Date.now();
      
      // Mark that we're processing an update
      processingUpdateRef.current = true;
      
      // Clear any pending updates
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Use simple counter for schema key
      setSchemaKey(prev => prev + 1);
      
      // Generate diagram elements with valid schema
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(
        schema, 
        groupProperties, 
        999, // Very high limit - effectively unlimited for practical schemas
        collapsedPaths
      );
      
      // Apply saved positions to new nodes where possible
      const positionedNodes = applyStoredPositions(newNodes);
      
      // Set the new nodes and edges
      setNodes(positionedNodes);
      setEdges(newEdges);
      
      // Reset the processing flag
      updateTimeoutRef.current = null;
      processingUpdateRef.current = false;
    } else if (!hasValidSchema) {
      // Clear nodes/edges if schema is invalid
      setNodes([]);
      setEdges([]);
    }

    // Update group properties setting when it changes
    if (prevGroupSetting !== groupProperties) {
      setPrevGroupSetting(groupProperties);
    }
    
  }, [
    schemaHash,
    error, 
    groupProperties, 
    collapsedPathsHash,
    setNodes, 
    setEdges, 
    applyStoredPositions,
    prevGroupSetting
  ]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    nodePositionsRef,
    schemaKey
  };
};
