
import { useState, useEffect, useCallback } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { useNodePositions } from './useNodePositions';
import { useSchemaProcessor } from './useSchemaProcessor';
import { useEdgeValidator } from './useEdgeValidator';

/**
 * Main hook to manage diagram nodes and edges
 */
export const useDiagramNodes = (
  schema: any, 
  error: boolean, 
  groupProperties: boolean
) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Use smaller hooks for specific functionality
  const { nodePositionsRef, applyStoredPositions } = useNodePositions(nodes);
  const { generatedElements, schemaKey } = useSchemaProcessor(schema, error, groupProperties);
  const validateAndSetEdges = useEdgeValidator(setEdges, nodes);

  // Memoize the processing of nodes and edges to avoid unnecessary work
  const processElements = useCallback(() => {
    if (generatedElements.nodes.length > 0) {
      // Apply saved positions to new nodes where possible
      const positionedNodes = applyStoredPositions(generatedElements.nodes);
      console.log(`Setting ${positionedNodes.length} nodes and ${generatedElements.edges.length} edges`);
      
      setNodes(positionedNodes);
      validateAndSetEdges(generatedElements.edges);
    }
  }, [generatedElements, applyStoredPositions, validateAndSetEdges, setNodes]);

  // Apply processed nodes and edges when elements change
  useEffect(() => {
    processElements();
  }, [processElements]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    nodePositionsRef,
    schemaKey
  };
};
