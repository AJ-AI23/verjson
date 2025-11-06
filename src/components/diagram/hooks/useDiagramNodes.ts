
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import { generateNodesAndEdges } from '@/lib/diagram';
import { useNodePositions } from './useNodePositions';
import { CollapsedState } from '@/lib/diagram/types';

export const useDiagramNodes = (
  schema: any, 
  error: boolean, 
  groupProperties: boolean,
  collapsedPaths: CollapsedState = {},
  maxDepth: number = 1,
  maxIndividualProperties: number = 5,
  truncateAncestral: boolean = false
) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [prevGroupSetting, setPrevGroupSetting] = useState(groupProperties);
  const [prevMaxIndividualProperties, setPrevMaxIndividualProperties] = useState(maxIndividualProperties);
  const [prevTruncateAncestral, setPrevTruncateAncestral] = useState(truncateAncestral);
  const [schemaKey, setSchemaKey] = useState(0);
  const { nodePositionsRef, applyStoredPositions } = useNodePositions(nodes);
  
  // Track schema changes
  const schemaStringRef = useRef<string>('');
  const collapsedPathsRef = useRef<CollapsedState>(collapsedPaths);
  const updateTimeoutRef = useRef<number | null>(null);
  const processingUpdateRef = useRef<boolean>(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const initialRenderRef = useRef<boolean>(true);

  // Memoize the schema JSON string for comparison
  const schemaString = useMemo(() => {
    try {
      return schema ? JSON.stringify(schema) : '';
    } catch (e) {
      console.error('Failed to stringify schema:', e);
      return '';
    }
  }, [schema]);

  // Memoize the collapsedPaths JSON string for comparison
  const collapsedPathsString = useMemo(() => {
    try {
      return JSON.stringify(collapsedPaths);
    } catch (e) {
      console.error('Failed to stringify collapsedPaths:', e);
      return '';
    }
  }, [collapsedPaths]);

  // Update schemaKey when collapsedPaths changes
  useEffect(() => {
    // Force schemaKey increment to trigger redraw when collapsedPaths changes
    if (!initialRenderRef.current) {
      setSchemaKey(prev => prev + 1);
    }
  }, [collapsedPathsString]);

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
    
    // Only update if something important has changed
    const schemaChanged = schemaString !== schemaStringRef.current;
    const groupSettingChanged = prevGroupSetting !== groupProperties;
    const collapsedPathsChanged = collapsedPathsString !== JSON.stringify(collapsedPathsRef.current);
    const maxIndividualPropertiesChanged = prevMaxIndividualProperties !== maxIndividualProperties;
    const truncateAncestralChanged = prevTruncateAncestral !== truncateAncestral;
    
    // Force update on initial render to make sure root node is always shown
    const forceUpdate = isInitialRender;
    
    if (schemaChanged || groupSettingChanged || collapsedPathsChanged || maxIndividualPropertiesChanged || truncateAncestralChanged || forceUpdate) {
      // Update refs with current values
      schemaStringRef.current = schemaString;
      collapsedPathsRef.current = {...collapsedPaths};
      lastUpdateTimeRef.current = Date.now();
      
      // Mark that we're processing an update
      processingUpdateRef.current = true;
      
      // Clear any pending updates
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Use simple counter for schema key
      setSchemaKey(prev => prev + 1);
      
      // Generate diagram elements with unlimited depth - let collapsed paths control visibility
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(
        schema, 
        groupProperties, 
        999, // Very high limit - effectively unlimited for practical schemas
        collapsedPaths,
        maxIndividualProperties,
        truncateAncestral
      );
      
      // Apply saved positions to new nodes where possible
      const positionedNodes = applyStoredPositions(newNodes);
      
      // Set the new nodes and edges
      setNodes(positionedNodes);
      setEdges(newEdges);
      
      // Reset the processing flag
      updateTimeoutRef.current = null;
      processingUpdateRef.current = false;
    }

    // Update group properties setting when it changes
    if (prevGroupSetting !== groupProperties) {
      setPrevGroupSetting(groupProperties);
    }
    
    // Update maxIndividualProperties setting when it changes
    if (prevMaxIndividualProperties !== maxIndividualProperties) {
      setPrevMaxIndividualProperties(maxIndividualProperties);
    }
    
    // Update truncateAncestral setting when it changes
    if (prevTruncateAncestral !== truncateAncestral) {
      setPrevTruncateAncestral(truncateAncestral);
    }
    
  }, [
    schema, 
    schemaString, 
    error, 
    groupProperties, 
    collapsedPaths,
    collapsedPathsString, 
    setNodes, 
    setEdges, 
    applyStoredPositions,
    prevGroupSetting,
    maxIndividualProperties,
    truncateAncestral
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
