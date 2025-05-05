
import React, { useCallback, useEffect, useRef, memo } from 'react';
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

// Memoize the component to prevent unnecessary re-renders
export const DiagramFlow: React.FC<DiagramFlowProps> = memo(({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  schemaKey,
  shouldFitView
}) => {
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const viewportRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Store viewport when it changes - memoize the callback
  const onMove = useCallback(() => {
    if (reactFlowInstanceRef.current) {
      const currentViewport = reactFlowInstanceRef.current.getViewport();
      viewportRef.current = currentViewport;
    }
  }, []);

  // Store reference to ReactFlow instance - memoize the callback
  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('ReactFlow initialized');
    reactFlowInstanceRef.current = instance;
    
    // If we have a stored viewport and shouldn't fit view, set it immediately
    if (!shouldFitView && viewportRef.current) {
      // Use requestAnimationFrame instead of setTimeout for smoother rendering
      requestAnimationFrame(() => {
        if (instance) {
          instance.setViewport(viewportRef.current);
        }
      });
    }
  }, [shouldFitView]);

  // Ensure container stays visible
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.visibility = 'visible';
    }
  }, [nodes, edges]);

  // Ensure ReactFlow instance is properly cleaned up on unmount
  useEffect(() => {
    return () => {
      reactFlowInstanceRef.current = null;
    };
  }, []);

  return (
    <div className="flex-1 diagram-container" ref={containerRef}>
      <ReactFlow
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
      >
        <Controls />
        <Background gap={16} size={1} color="#e5e7eb" />
      </ReactFlow>
    </div>
  );
});

// Add display name for better debugging
DiagramFlow.displayName = 'DiagramFlow';
