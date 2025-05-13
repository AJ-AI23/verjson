
import { useRef, useMemo, useCallback } from 'react';
import { generateNodesAndEdges } from '@/lib/diagram';
import { CollapsedState } from '@/lib/diagram/types';

interface SchemaProcessorProps {
  schema: any;
  groupProperties: boolean;
  maxDepth: number;
  collapsedPaths: CollapsedState;
  applyStoredPositions: (nodes: any[]) => any[];
  setNodes: (nodes: any[]) => void;
  setEdges: (edges: any[]) => void;
}

export const useSchemaProcessor = () => {
  const schemaStringRef = useRef<string>('');
  const collapsedPathsRef = useRef<CollapsedState>({});
  const previousMaxDepthRef = useRef<number>(3);
  
  // Memoize schema string for comparison
  const getSchemaString = useCallback((schema: any) => {
    try {
      return schema ? JSON.stringify(schema) : '';
    } catch (e) {
      console.error('Failed to stringify schema:', e);
      return '';
    }
  }, []);
  
  // Memoize the collapsedPaths JSON string for comparison
  const getCollapsedPathsString = useCallback((collapsedPaths: CollapsedState) => {
    try {
      return JSON.stringify(collapsedPaths);
    } catch (e) {
      console.error('Failed to stringify collapsedPaths:', e);
      return '';
    }
  }, []);
  
  // Check if schema or settings have changed
  const hasChanges = useCallback((
    schema: any,
    maxDepth: number,
    groupProperties: boolean,
    collapsedPaths: CollapsedState
  ) => {
    const schemaString = getSchemaString(schema);
    const collapsedPathsString = getCollapsedPathsString(collapsedPaths);
    
    const maxDepthChanged = previousMaxDepthRef.current !== maxDepth;
    const schemaChanged = schemaString !== schemaStringRef.current;
    const collapsedPathsChanged = collapsedPathsString !== getCollapsedPathsString(collapsedPathsRef.current);
    
    return {
      hasAnyChange: schemaChanged || maxDepthChanged || collapsedPathsChanged,
      schemaChanged,
      maxDepthChanged,
      collapsedPathsChanged,
      schemaString,
      collapsedPathsString
    };
  }, [getSchemaString, getCollapsedPathsString]);
  
  // Process schema to generate diagram
  const processSchema = useCallback(({
    schema,
    groupProperties,
    maxDepth,
    collapsedPaths,
    applyStoredPositions,
    setNodes,
    setEdges
  }: SchemaProcessorProps) => {
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
    
    // Update reference values
    schemaStringRef.current = getSchemaString(schema);
    collapsedPathsRef.current = {...collapsedPaths};
    previousMaxDepthRef.current = maxDepth;
  }, [getSchemaString]);
  
  return {
    hasChanges,
    processSchema,
    previousMaxDepthRef,
    schemaStringRef,
    collapsedPathsRef
  };
};
