
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
  const onMove = useCallback(() => {
    if (reactFlowInstanceRef.current) {
      viewportRef.current = reactFlowInstanceRef.current.getViewport();
      console.log('Stored viewport:', viewportRef.current);
    }
  }, []);

  // Store reference to ReactFlow instance
  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('ReactFlow initialized');
    reactFlowInstanceRef.current = instance;
  }, []);

  // Simple effect to restore viewport after nodes and edges are ready
  useEffect(() => {
    if (!shouldFitView && viewportRef.current && reactFlowInstanceRef.current && nodes.length > 0) {
      // Use a short timeout to ensure nodes are rendered
      const timeoutId = setTimeout(() => {
        if (reactFlowInstanceRef.current && viewportRef.current) {
          console.log('Restoring viewport to:', viewportRef.current);
          reactFlowInstanceRef.current.setViewport(viewportRef.current);
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [nodes, edges, shouldFitView]);

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
