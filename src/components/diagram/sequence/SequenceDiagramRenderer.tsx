import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeTypes,
  EdgeTypes,
  Node,
  Edge
} from '@xyflow/react';
import { SequenceDiagramData } from '@/types/diagram';
import { calculateSequenceLayout, calculateSwimlaneLayout } from '@/lib/diagram/sequenceLayout';
import { SequenceNode } from './SequenceNode';
import { SequenceEdge } from './SequenceEdge';
import { SwimlaneHeader } from './SwimlaneHeader';
import '@xyflow/react/dist/style.css';

interface SequenceDiagramRendererProps {
  data: SequenceDiagramData;
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
}

const nodeTypes: NodeTypes = {
  sequenceNode: SequenceNode,
};

const edgeTypes: EdgeTypes = {
  sequenceEdge: SequenceEdge,
};

export const SequenceDiagramRenderer: React.FC<SequenceDiagramRendererProps> = ({
  data,
  onNodesChange,
  onEdgesChange
}) => {
  const { swimlanes, columns, nodes: diagramNodes, edges: diagramEdges } = data;

  // Calculate layout
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    return calculateSequenceLayout({
      swimlanes,
      columns,
      nodes: diagramNodes,
      edges: diagramEdges
    });
  }, [swimlanes, columns, diagramNodes, diagramEdges]);

  const [nodes, setNodes, handleNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(layoutEdges);

  // Calculate swimlane layout for background
  const swimlaneLayout = useMemo(() => {
    return calculateSwimlaneLayout(swimlanes, 800);
  }, [swimlanes]);

  const onNodesChangeHandler = useCallback((changes: any) => {
    handleNodesChange(changes);
    if (onNodesChange) {
      onNodesChange(nodes);
    }
  }, [handleNodesChange, onNodesChange, nodes]);

  const onEdgesChangeHandler = useCallback((changes: any) => {
    handleEdgesChange(changes);
    if (onEdgesChange) {
      onEdgesChange(edges);
    }
  }, [handleEdgesChange, onEdgesChange, edges]);

  return (
    <div className="w-full h-full relative">
      {/* Swimlane headers */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {swimlaneLayout.map((swimlane, index) => (
          <SwimlaneHeader
            key={swimlane.id}
            swimlane={swimlane}
            isFirst={index === 0}
          />
        ))}
      </div>

      {/* React Flow diagram */}
      <div className="w-full h-full" style={{ paddingLeft: '192px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeHandler}
          onEdgesChange={onEdgesChangeHandler}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'smoothstep',
          }}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={() => '#f1f5f9'}
            className="bg-white border border-slate-200"
          />
        </ReactFlow>
      </div>
    </div>
  );
};
