
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
  const processingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessTimeRef = useRef<number>(Date.now());
  
  // Memoize schema string for comparison with optimized stringification
  const getSchemaString = useCallback((schema: any) => {
    try {
      // Skip if processing would be too frequent
      const now = Date.now();
      if (now - lastProcessTimeRef.current < 2000) {
        // Return cached value if we processed recently
        return schemaStringRef.current;
      }
      
      // Only stringify the essential parts of the schema
      if (!schema) return '';
      
      const essentialParts = {
        type: schema.type,
        title: schema.title,
        properties: schema.properties ? Object.keys(schema.properties) : []
      };
      
      return JSON.stringify(essentialParts);
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
  
  // Check if schema or settings have changed - with optimized comparisons
  const hasChanges = useCallback((
    schema: any,
    maxDepth: number,
    groupProperties: boolean,
    collapsedPaths: CollapsedState
  ) => {
    // Skip frequent processing to prevent reload loops
    const now = Date.now();
    if (now - lastProcessTimeRef.current < 1000) {
      return {
        hasAnyChange: false,
        schemaChanged: false,
        maxDepthChanged: false,
        collapsedPathsChanged: false,
        schemaString: schemaStringRef.current,
        collapsedPathsString: getCollapsedPathsString(collapsedPathsRef.current)
      };
    }
    
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
  
  // Process schema to generate diagram with debounced execution
  const processSchema = useCallback(({
    schema,
    groupProperties,
    maxDepth,
    collapsedPaths,
    applyStoredPositions,
    setNodes,
    setEdges
  }: SchemaProcessorProps) => {
    // Clear any existing processing timer
    if (processingTimerRef.current) {
      clearTimeout(processingTimerRef.current);
    }
    
    // Skip if we've processed very recently (prevent loop)
    const now = Date.now();
    if (now - lastProcessTimeRef.current < 1000) {
      console.log('Skipping redundant diagram updates');
      return;
    }
    lastProcessTimeRef.current = now;
    
    // Use a longer debounce to batch multiple rapid changes
    processingTimerRef.current = setTimeout(() => {
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
      
      processingTimerRef.current = null;
    }, 300); // Longer debounce for batching
  }, [getSchemaString]);
  
  return {
    hasChanges,
    processSchema,
    previousMaxDepthRef,
    schemaStringRef,
    collapsedPathsRef
  };
};
