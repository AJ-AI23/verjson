
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

  // Effect for handling schema or groupProperties changes
  useEffect(() => {
    // Skip processing if there's no schema or there's an error
    if (!schema || error) {
      if (generatedElements.nodes.length > 0 || generatedElements.edges.length > 0) {
        console.log('Clearing nodes and edges due to error or no schema');
        setGeneratedElements({ nodes: [], edges: [] });
      }
      return;
    }

    // Only update schema key if schema or grouping changed
    if (
      schemaString !== schemaStringRef.current || 
      prevGroupSettingRef.current !== groupProperties
    ) {
      console.log('Schema or groupProperties changed, updating schema key');
      schemaStringRef.current = schemaString;
      prevGroupSettingRef.current = groupProperties;
      
      // Clear any pending updates
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Generate nodes and edges
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
      
      // Use a small delay to prevent excessive updates
      updateTimeoutRef.current = window.setTimeout(() => {
        console.log(`Setting ${newNodes.length} nodes and ${newEdges.length} edges from schema change`);
        setGeneratedElements({ nodes: newNodes, edges: newEdges });
        setSchemaKey(prev => prev + 1);
        updateTimeoutRef.current = null;
      }, 50);
    }
    
    // Cleanup
    return () => {
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, [schema, error, groupProperties, schemaString]);

  return {
    generatedElements,
    schemaKey
  };
};
