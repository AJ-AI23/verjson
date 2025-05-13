
import { useState, useEffect, useRef } from 'react';
import { CollapsedState } from '@/lib/diagram/types';
import { useNodePositions } from './useNodePositions';
import { useDiagramState } from './useDiagramState';
import { useDiagramUpdateThrottling } from './useDiagramUpdateThrottling';
import { useSchemaProcessor } from './useSchemaProcessor';

export const useDiagramNodes = (
  schema: any, 
  error: boolean, 
  groupProperties: boolean,
  maxDepth: number = 3,
  collapsedPaths: CollapsedState = {}
) => {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    schemaKey,
    incrementSchemaKey
  } = useDiagramState();
  
  const [prevGroupSetting, setPrevGroupSetting] = useState(groupProperties);
  const { nodePositionsRef, applyStoredPositions } = useNodePositions(nodes);
  const initialRenderRef = useRef<boolean>(true);
  
  const {
    throttleUpdates,
    startProcessingUpdate,
    finishProcessingUpdate,
    clearPendingUpdates,
    isProcessingUpdate
  } = useDiagramUpdateThrottling();
  
  const {
    hasChanges,
    processSchema,
    previousMaxDepthRef,
    schemaStringRef,
    collapsedPathsRef
  } = useSchemaProcessor();

  // Log changes to collapsedPaths for debugging
  useEffect(() => {
    const pathsCount = Object.keys(collapsedPaths).length;
    console.log(`useDiagramNodes: collapsedPaths updated with ${pathsCount} entries`);
    console.log('Collapsed paths:', collapsedPaths);
    
    // Force schemaKey increment to trigger redraw when collapsedPaths changes
    if (pathsCount > 0 && !initialRenderRef.current) {
      incrementSchemaKey();
    }
  }, [collapsedPaths, incrementSchemaKey]);

  // Generate nodes and edges when dependencies change
  useEffect(() => {
    // For the first render or if there's an error, log but continue
    if (initialRenderRef.current) {
      console.log('Initial useDiagramNodes render');
      initialRenderRef.current = false;
    }

    // Skip if we're already processing an update or throttling
    if (isProcessingUpdate() || (!initialRenderRef.current && throttleUpdates())) {
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

    // Check if something important has changed
    const groupSettingChanged = prevGroupSetting !== groupProperties;
    const { 
      hasAnyChange, 
      schemaChanged, 
      maxDepthChanged, 
      collapsedPathsChanged,
      schemaString 
    } = hasChanges(schema, maxDepth, groupProperties, collapsedPaths);
    
    if (hasAnyChange || groupSettingChanged) {
      console.log('Schema or settings changed, generating new diagram', {
        schemaChanged,
        groupSettingChanged,
        maxDepthChanged,
        collapsedPathsChanged
      });
      
      // Mark that we're processing an update
      startProcessingUpdate();
      
      // Clear any pending updates
      clearPendingUpdates();
      
      // Use simple counter for schema key
      incrementSchemaKey();
      
      // Process the schema to generate diagram
      processSchema({
        schema,
        groupProperties,
        maxDepth,
        collapsedPaths,
        applyStoredPositions,
        setNodes,
        setEdges
      });
      
      // Reset the processing flag
      finishProcessingUpdate();
    }

    // Update group properties setting when it changes
    if (prevGroupSetting !== groupProperties) {
      console.log('Group properties setting changed');
      setPrevGroupSetting(groupProperties);
    }
    
  }, [
    schema, 
    error, 
    groupProperties, 
    maxDepth, 
    collapsedPaths, 
    setNodes, 
    setEdges, 
    applyStoredPositions,
    prevGroupSetting,
    throttleUpdates,
    nodes.length,
    edges.length,
    hasChanges,
    processSchema,
    startProcessingUpdate,
    finishProcessingUpdate,
    clearPendingUpdates,
    isProcessingUpdate,
    incrementSchemaKey
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
