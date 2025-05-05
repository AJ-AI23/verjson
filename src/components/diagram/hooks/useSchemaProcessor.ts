
import { useState, useEffect, useRef } from 'react';
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
  const [prevGroupSetting, setPrevGroupSetting] = useState(groupProperties);
  
  // Track schema changes
  const schemaStringRef = useRef<string>('');
  const updateTimeoutRef = useRef<number | null>(null);

  // Generate a new schema key when schema really changes
  useEffect(() => {
    if (schema) {
      // Convert schema to string for comparison
      const schemaString = JSON.stringify(schema);
      
      // Only update schema key if schema or grouping changed
      if (schemaString !== schemaStringRef.current || prevGroupSetting !== groupProperties) {
        console.log('Schema or groupProperties changed');
        schemaStringRef.current = schemaString;
        
        // Clear any pending updates
        if (updateTimeoutRef.current !== null) {
          clearTimeout(updateTimeoutRef.current);
        }
        
        // Use simple counter for schema key
        setSchemaKey(prev => prev + 1);
      }
    }
  }, [schema, error, groupProperties, prevGroupSetting]);

  // Effect for schema or error changes
  useEffect(() => {
    if (schema && !error) {
      console.log('Generating nodes and edges');
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
      
      // Batch the updates to minimize re-renders
      updateTimeoutRef.current = window.setTimeout(() => {
        setGeneratedElements({ nodes: newNodes, edges: newEdges });
        updateTimeoutRef.current = null;
      }, 10);
    } else {
      // Clear both nodes and edges when there's an error or no schema
      if (generatedElements.nodes.length > 0 || generatedElements.edges.length > 0) {
        console.log('Clearing nodes and edges due to error or no schema');
        setGeneratedElements({ nodes: [], edges: [] });
      }
    }
    
    // Cleanup
    return () => {
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [schema, error, groupProperties, schemaKey, generatedElements.nodes.length, generatedElements.edges.length]);

  // Effect specifically for groupProperties toggle changes
  useEffect(() => {
    if (prevGroupSetting !== groupProperties) {
      console.log('Group properties setting changed');
      setPrevGroupSetting(groupProperties);
    }
  }, [groupProperties, prevGroupSetting]);

  return {
    generatedElements,
    schemaKey
  };
};
