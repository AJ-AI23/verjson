
import { useState, useEffect, useRef, useMemo } from 'react';
import { generateNodesAndEdges } from '@/lib/diagram';

/**
 * Hook to process schema into nodes and edges
 * This hook handles schema changes and error states
 */
export const useSchemaProcessor = (
  schema: any, 
  error: boolean, 
  groupProperties: boolean
) => {
  const [generatedElements, setGeneratedElements] = useState<{nodes: any[], edges: any[]}>({ nodes: [], edges: [] });
  const [schemaKey, setSchemaKey] = useState(0);
  const prevGroupSettingRef = useRef(groupProperties);
  
  // Track schema changes
  const schemaStringRef = useRef<string>('');
  const updateTimeoutRef = useRef<number | null>(null);

  // Generate a stable memo for schema comparison
  const schemaString = useMemo(() => 
    schema ? JSON.stringify(schema) : '',
  [schema]);

  // Update schema key when necessary
  useEffect(() => {
    // Only update schema key if schema or grouping changed
    if (
      schemaString !== schemaStringRef.current || 
      prevGroupSettingRef.current !== groupProperties
    ) {
      console.log('Schema or groupProperties changed');
      schemaStringRef.current = schemaString;
      prevGroupSettingRef.current = groupProperties;
      
      // Clear any pending updates
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      
      // Use simple counter for schema key
      setSchemaKey(prev => prev + 1);
    }
  }, [schemaString, groupProperties]);

  // Effect for schema or error changes - separated from key changes
  useEffect(() => {
    // Skip processing if there's no schema or there's an error
    if (!schema || error) {
      if (generatedElements.nodes.length > 0 || generatedElements.edges.length > 0) {
        console.log('Clearing nodes and edges due to error or no schema');
        setGeneratedElements({ nodes: [], edges: [] });
      }
      return;
    }

    // Process the schema - only when we have a valid schema without errors
    console.log('Generating nodes and edges');
    const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
    
    // Batch the updates to minimize re-renders
    updateTimeoutRef.current = window.setTimeout(() => {
      setGeneratedElements({ nodes: newNodes, edges: newEdges });
      updateTimeoutRef.current = null;
    }, 10);
    
    // Cleanup
    return () => {
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, [schema, error, groupProperties, schemaKey]);

  return {
    generatedElements,
    schemaKey
  };
};
