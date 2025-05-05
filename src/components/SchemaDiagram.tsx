
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
}

const nodeTypes = {
  schemaType: SchemaTypeNode,
};

export const SchemaDiagram = ({ schema, error }: SchemaDiagramProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (schema && !error) {
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(schema);
      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [schema, error, setNodes, setEdges]);

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
        >
          <Controls />
          <Background gap={16} size={1} color="#e5e7eb" />
        </ReactFlow>
      </div>
    </div>
  );
};
