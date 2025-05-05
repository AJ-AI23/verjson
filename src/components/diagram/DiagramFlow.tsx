
import React, { useCallback, useEffect, useRef } from 'react';
import { ReactFlow, Background, Controls, Node, Edge, ReactFlowInstance, useReactFlow } from '@xyflow/react';
import { SchemaTypeNode } from '@/components/SchemaTypeNode';

interface DiagramFlowProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  schemaKey: number;
  shouldFitView: boolean;
  onNodeClick?: (event: React.MouseEvent, node: any) => void;
  onPaneClick?: () => void;
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
  shouldFitView,
  onNodeClick,
  onPaneClick
}) => {
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const viewportRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
  
  // For debugging
  useEffect(() => {
    console.log(`DiagramFlow rendering with ${nodes.length} nodes and ${edges.length} edges`);
  }, [nodes, edges]);
  
  // Store viewport when it changes
  const onMove = useCallback(() => {
    if (reactFlowInstanceRef.current) {
      const currentViewport = reactFlowInstanceRef.current.getViewport();
      viewportRef.current = currentViewport;
    }
  }, []);

  // Store reference to ReactFlow instance
  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('ReactFlow initialized');
    reactFlowInstanceRef.current = instance;
    
    // If we have a stored viewport and shouldn't fit view, set it immediately
    if (!shouldFitView && viewportRef.current) {
      setTimeout(() => {
        if (instance) {
          instance.setViewport(viewportRef.current);
        }
      }, 50);
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
        defaultViewport={viewportRef.current} // Use stored viewport as default
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <Background gap={16} size={1} color="#e5e7eb" />
      </ReactFlow>
    </div>
  );
};
