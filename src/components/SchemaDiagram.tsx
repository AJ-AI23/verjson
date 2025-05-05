
import React, { useEffect, useState } from 'react';
import { 
  ReactFlow,
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SchemaTypeNode } from '@/components/SchemaTypeNode';
import { generateNodesAndEdges } from '@/lib/diagramUtils';

interface SchemaDiagramProps {
  schema: any;
  error: boolean;
  groupProperties?: boolean;
}

const nodeTypes = {
  schemaType: SchemaTypeNode,
};

export const SchemaDiagram = ({ schema, error, groupProperties = false }: SchemaDiagramProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [prevGroupSetting, setPrevGroupSetting] = useState(groupProperties);

  // Effect for schema or error changes
  useEffect(() => {
    if (schema && !error) {
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
      
      // Always reset both nodes and edges completely to avoid orphaned edges
      setNodes(newNodes);
      setEdges(newEdges);
    } else {
      // Clear both nodes and edges when there's an error or no schema
      setNodes([]);
      setEdges([]);
    }
  }, [schema, error, groupProperties, setNodes, setEdges]);

  // Effect specifically for groupProperties toggle changes
  useEffect(() => {
    if (prevGroupSetting !== groupProperties) {
      // Force a complete reset of edges when toggling the grouping mode
      setPrevGroupSetting(groupProperties);
      
      if (schema && !error) {
        const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema, groupProperties);
        setNodes(newNodes);
        setEdges(newEdges);
      }
    }
  }, [groupProperties, prevGroupSetting, schema, error, setNodes, setEdges]);

  // Validate edges against nodes to ensure no orphaned edges
  useEffect(() => {
    if (nodes.length > 0 && edges.length > 0) {
      // Get all valid node IDs
      const nodeIds = new Set(nodes.map(node => node.id));
      
      // Filter edges to only include those where both source and target exist
      const validEdges = edges.filter(edge => 
        nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );
      
      // If we filtered out any edges, update the edges state
      if (validEdges.length < edges.length) {
        setEdges(validEdges);
      }
    } else if (nodes.length === 0 && edges.length > 0) {
      // If there are no nodes but there are edges, clear the edges
      setEdges([]);
    }
  }, [nodes, edges, setEdges]);

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-2 border-b bg-slate-50">
          <h2 className="font-semibold text-slate-700">Schema Diagram</h2>
        </div>
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="p-4 text-center text-slate-500">
            <p>Fix Schema errors to view diagram</p>
          </div>
        </div>
      </div>
    );
  }

  if (!schema || (Array.isArray(nodes) && nodes.length === 0)) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-2 border-b bg-slate-50">
          <h2 className="font-semibold text-slate-700">Schema Diagram</h2>
        </div>
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="p-4 text-center text-slate-500">
            <p>No schema components to display</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-slate-50">
        <h2 className="font-semibold text-slate-700">Schema Diagram</h2>
      </div>
      <div className="flex-1 diagram-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.5}
          maxZoom={2}
          deleteKeyCode={null} // Disable deletion with Delete key
        >
          <Controls />
          <Background gap={16} size={1} color="#e5e7eb" />
        </ReactFlow>
      </div>
    </div>
  );
};
