
import { useNodesState, useEdgesState } from '@xyflow/react';
import { useState } from 'react';

/**
 * Hook for managing the state of diagram nodes and edges
 */
export const useDiagramState = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [schemaKey, setSchemaKey] = useState(0);
  
  const incrementSchemaKey = () => {
    setSchemaKey(prev => prev + 1);
  };
  
  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    schemaKey,
    incrementSchemaKey
  };
};
