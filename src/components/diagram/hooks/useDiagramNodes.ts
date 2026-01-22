
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import { generateNodesAndEdges } from '@/lib/diagram';
import { useNodePositions } from './useNodePositions';
import { CollapsedState } from '@/lib/diagram/types';
import { diagramDbg } from '@/lib/diagram/diagramDebug';

const dbg = (message: string, data?: any) => diagramDbg('useDiagramNodes', message, data);

export const useDiagramNodes = (
  schema: any, 
  error: boolean, 
  groupProperties: boolean,
  collapsedPaths: CollapsedState = {},
  maxDepth: number = 1,
  maxIndividualProperties: number = 5,
  maxIndividualArrayItems: number = 4,
  truncateAncestral: boolean = false
) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [prevGroupSetting, setPrevGroupSetting] = useState(groupProperties);
  const [prevMaxIndividualProperties, setPrevMaxIndividualProperties] = useState(maxIndividualProperties);
  const [prevMaxIndividualArrayItems, setPrevMaxIndividualArrayItems] = useState(maxIndividualArrayItems);
  const [prevTruncateAncestral, setPrevTruncateAncestral] = useState(truncateAncestral);
  const [schemaKey, setSchemaKey] = useState(0);
  const { nodePositionsRef, userDraggedPositionsRef, applyStoredPositions, clearPositions, recordUserDrag } = useNodePositions(nodes);
  
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
      dbg('collapsedPathsString changed -> bump schemaKey (pre-layout bump)', {
        collapsedKeys: Object.keys(collapsedPaths || {}).length,
      });
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
    const maxIndividualArrayItemsChanged = prevMaxIndividualArrayItems !== maxIndividualArrayItems;
    const truncateAncestralChanged = prevTruncateAncestral !== truncateAncestral;
    
    // Force update on initial render to make sure root node is always shown
    const forceUpdate = isInitialRender;
    
    if (schemaChanged || groupSettingChanged || collapsedPathsChanged || maxIndividualPropertiesChanged || maxIndividualArrayItemsChanged || truncateAncestralChanged || forceUpdate) {
      dbg('regenerating nodes/edges', {
        reason: {
          schemaChanged,
          groupSettingChanged,
          collapsedPathsChanged,
          maxIndividualPropertiesChanged,
          maxIndividualArrayItemsChanged,
          truncateAncestralChanged,
          forceUpdate,
        },
        prevNodeCount: nodes.length,
      });
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
      dbg('bump schemaKey (layout bump)');
      setSchemaKey(prev => prev + 1);
      
      // Generate diagram elements with unlimited depth - let collapsed paths control visibility
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(
        schema, 
        groupProperties, 
        999, // Very high limit - effectively unlimited for practical schemas
        collapsedPaths,
        maxIndividualProperties,
        maxIndividualArrayItems,
        truncateAncestral
      );
      
      // Apply saved positions to new nodes where possible
      let positionedNodes = applyStoredPositions(newNodes);
      
      // Note: Collision resolution is now handled in DiagramContainer after nodes are measured
      // This ensures we use actual rendered dimensions instead of estimates
      
      // Set the new nodes and edges
      setNodes(positionedNodes);
      setEdges(newEdges);

      dbg('setNodes/setEdges completed (sync)', {
        newNodeCount: positionedNodes.length,
        newEdgeCount: newEdges.length,
        measuredNow: positionedNodes.filter((n: any) => n.measured?.width && n.measured?.height).length,
      });
      
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
    
    // Update maxIndividualArrayItems setting when it changes
    if (prevMaxIndividualArrayItems !== maxIndividualArrayItems) {
      setPrevMaxIndividualArrayItems(maxIndividualArrayItems);
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
    maxIndividualArrayItems,
    truncateAncestral
  ]);

  // Create clearStoredPositions function that clears positions and triggers re-render
  const clearStoredPositions = useCallback(() => {
    clearPositions();
    // Increment schema key to force re-layout
    setSchemaKey(prev => prev + 1);
  }, [clearPositions]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    nodePositionsRef,
    userDraggedPositionsRef,
    schemaKey,
    setNodes,
    clearStoredPositions,
    recordUserDrag
  };
};
