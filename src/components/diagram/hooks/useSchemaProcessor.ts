
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
  const pendingProcessRef = useRef<boolean>(false);
  const processCountRef = useRef<number>(0);
  
  // Optimized schema string generation with caching
  const getSchemaString = useCallback((schema: any) => {
    try {
      // Skip if processing would be too frequent
      const now = Date.now();
      if (now - lastProcessTimeRef.current < 2000) {
        // Return cached value if we processed recently
        return schemaStringRef.current;
      }
      
      // Skip if we're seeing too many process requests
      if (processCountRef.current > 10) {
        console.log('Too many schema processing requests, throttling');
        processCountRef.current = 0; // Reset counter
        return schemaStringRef.current;
      }
      
      // Only stringify the essential parts of the schema
      if (!schema) return '';
      
      // Generate cache key based on important properties only
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
    if (now - lastProcessTimeRef.current < 2000) {
      return {
        hasAnyChange: false,
        schemaChanged: false,
        maxDepthChanged: false,
        collapsedPathsChanged: false,
        schemaString: schemaStringRef.current,
        collapsedPathsString: getCollapsedPathsString(collapsedPathsRef.current)
      };
    }
    
    // Increment the process counter
    processCountRef.current++;
    
    const schemaString = getSchemaString(schema);
    const collapsedPathsString = getCollapsedPathsString(collapsedPaths);
    
    const maxDepthChanged = previousMaxDepthRef.current !== maxDepth;
    const schemaChanged = schemaString !== schemaStringRef.current;
    const collapsedPathsChanged = collapsedPathsString !== getCollapsedPathsString(collapsedPathsRef.current);
    
    // If we're seeing too many changes in a short period, throttle
    if (processCountRef.current > 5 && (now - lastProcessTimeRef.current < 5000)) {
      console.log('Too many updates in short period, throttling');
      return {
        hasAnyChange: false,
        schemaChanged: false,
        maxDepthChanged: false,
        collapsedPathsChanged: false,
        schemaString,
        collapsedPathsString
      };
    }
    
    return {
      hasAnyChange: schemaChanged || maxDepthChanged || collapsedPathsChanged,
      schemaChanged,
      maxDepthChanged,
      collapsedPathsChanged,
      schemaString,
      collapsedPathsString
    };
  }, [getSchemaString, getCollapsedPathsString]);
  
  // Process schema to generate diagram with enhanced debouncing
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
    if (now - lastProcessTimeRef.current < 2000) {
      console.log('Skipping redundant diagram updates - too soon');
      return;
    }
    
    // Skip if we already have a pending process
    if (pendingProcessRef.current) {
      console.log('Skipping redundant diagram updates - already pending');
      return;
    }
    
    // Mark that we have a pending process
    pendingProcessRef.current = true;
    
    // Use a longer debounce to batch multiple rapid changes
    processingTimerRef.current = setTimeout(() => {
      console.log(`Generating nodes and edges with maxDepth: ${maxDepth}`);
      lastProcessTimeRef.current = Date.now();
      
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
      pendingProcessRef.current = false;
      processCountRef.current = 0; // Reset process counter after successful update
    }, 500); // Longer debounce for batching
  }, [getSchemaString]);
  
  return {
    hasChanges,
    processSchema,
    previousMaxDepthRef,
    schemaStringRef,
    collapsedPathsRef
  };
};
