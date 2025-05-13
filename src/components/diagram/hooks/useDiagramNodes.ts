
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

  // Log changes to collapsedPaths for debugging
  useEffect(() => {
    const pathsCount = Object.keys(collapsedPaths).length;
    console.log(`useDiagramNodes: collapsedPaths updated with ${pathsCount} entries`);
    console.log('Collapsed paths:', collapsedPaths);
    
    // Force schemaKey increment to trigger redraw when collapsedPaths changes
    if (!initialRenderRef.current) {
      setSchemaKey(prev => prev + 1);
    }
  }, [collapsedPathsString]);

  // Throttle updates to prevent excessive rendering
  const throttleUpdates = useCallback(() => {
    const now = Date.now();
    // Only process updates if more than 300ms has passed since last update
    return (now - lastUpdateTimeRef.current) < 300;
  }, []);

  // Generate nodes and edges when dependencies change
  useEffect(() => {
    // For the first render or if there's an error, log but continue
    if (initialRenderRef.current) {
      console.log('Initial useDiagramNodes render');
      initialRenderRef.current = false;
    }

    // Skip if we're already processing an update or throttling
    if (processingUpdateRef.current || (!initialRenderRef.current && throttleUpdates())) {
      return;
    }
    
    // Skip if there's an error or no schema
    if (error) {
      console.log('Skipping diagram generation due to error');
      if (nodes.length > 0 || edges.length > 0) {
        setNodes([]);
        setEdges([]);
      }
      return;
    }
    
    if (!schema) {
      console.log('Skipping diagram generation due to no schema');
      if (nodes.length > 0 || edges.length > 0) {
        setNodes([]);
        setEdges([]);
      }
      return;
    }

    // Only update if something important has changed
    const maxDepthChanged = previousMaxDepthRef.current !== maxDepth;
    const schemaChanged = schemaString !== schemaStringRef.current;
    const groupSettingChanged = prevGroupSetting !== groupProperties;
    const collapsedPathsChanged = collapsedPathsString !== JSON.stringify(collapsedPathsRef.current);
    
    // Force update on initial render to make sure root node is always shown
    const forceUpdate = initialRenderRef.current === true;
    
    if (schemaChanged || groupSettingChanged || maxDepthChanged || collapsedPathsChanged || forceUpdate) {
      console.log('Schema or settings changed, generating new diagram', {
        schemaChanged,
        groupSettingChanged,
        maxDepthChanged,
        collapsedPathsChanged,
        forceUpdate,
        rootCollapsed: collapsedPaths.root === true
      });
      
      // Update refs with current values
      schemaStringRef.current = schemaString;
      collapsedPathsRef.current = {...collapsedPaths};
      previousMaxDepthRef.current = maxDepth;
      lastUpdateTimeRef.current = Date.now();
      
      // Mark that we're processing an update
      processingUpdateRef.current = true;
      
      // Clear any pending updates
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Use simple counter for schema key
      setSchemaKey(prev => prev + 1);
      
      // Generate diagram elements
      console.log(`Generating nodes and edges with maxDepth: ${maxDepth}`);
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(
        schema, 
        groupProperties, 
        maxDepth, 
        collapsedPaths
      );
      
      // Apply saved positions to new nodes where possible
      const positionedNodes = applyStoredPositions(newNodes);
      console.log(`Generated ${positionedNodes.length} nodes and ${newEdges.length} edges`);
      
      // Set the new nodes and edges
      setNodes(positionedNodes);
      setEdges(newEdges);
      
      // Reset the processing flag
      updateTimeoutRef.current = null;
      processingUpdateRef.current = false;
    }

    // Update group properties setting when it changes
    if (prevGroupSetting !== groupProperties) {
      console.log('Group properties setting changed');
      setPrevGroupSetting(groupProperties);
    }
    
  }, [
    schema, 
    schemaString, 
    error, 
    groupProperties, 
    maxDepth, 
    collapsedPaths,
    collapsedPathsString, 
    setNodes, 
    setEdges, 
    applyStoredPositions,
    prevGroupSetting,
    throttleUpdates,
    nodes.length,
    edges.length
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
