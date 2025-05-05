
import React, { useCallback, useEffect, useRef } from 'react';
import { ReactFlow, Background, Controls, Node, Edge, ReactFlowInstance } from '@xyflow/react';
import { SchemaTypeNode } from '@/components/SchemaTypeNode';

interface DiagramFlowProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  schemaKey: number;
  shouldFitView: boolean;
}

const nodeTypes = {
  schemaType: SchemaTypeNode,
};

export const DiagramFlow: React.FC<DiagramFlowProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  schemaKey,
  shouldFitView
}) => {
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const viewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null);

  // Store viewport when it changes
  const onMove = useCallback((event: any) => {
    if (reactFlowInstanceRef.current) {
      const { x, y, zoom } = reactFlowInstanceRef.current.getViewport();
      viewportRef.current = { x, y, zoom };
    }
  }, []);

  // Store reference to ReactFlow instance
  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstanceRef.current = instance;
    // Restore previous viewport if available
    if (viewportRef.current && !shouldFitView) {
      instance.setViewport(viewportRef.current);
    }
  }, [shouldFitView]);

  return (
    <div className="flex-1 diagram-container">
      <ReactFlow
        key={`flow-${schemaKey}`}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView={shouldFitView}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={2}
        deleteKeyCode={null} // Disable deletion with Delete key
        onInit={onInit}
        onMove={onMove}
        onMoveEnd={onMove}
      >
        <Controls />
        <Background gap={16} size={1} color="#e5e7eb" />
      </ReactFlow>
    </div>
  );
};
