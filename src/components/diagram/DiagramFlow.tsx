
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

export const DiagramFlow = memo(({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  schemaKey,
  shouldFitView
}) => {
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const viewportRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
  const didFitViewRef = useRef<boolean>(false);
  
  // Store viewport when it changes
  const onMove = useCallback((event: any, viewport: any) => {
    if (viewport) {
      viewportRef.current = viewport;
    }
  }, []);

  // Store reference to ReactFlow instance
  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('ReactFlow initialized');
    reactFlowInstanceRef.current = instance;
    
    // If we have a stored viewport and shouldn't fit view, set it immediately
    if (!shouldFitView && viewportRef.current) {
      setTimeout(() => {
        if (instance && !didFitViewRef.current) {
          instance.setViewport(viewportRef.current);
        }
      }, 50);
    } else if (shouldFitView) {
      didFitViewRef.current = true;
    }
  }, [shouldFitView]);

  // Force fit view when needed
  useEffect(() => {
    console.log(`Diagram rendering with ${nodes.length} nodes and ${edges.length} edges`);
    
    if (reactFlowInstanceRef.current && shouldFitView) {
      const timeout = setTimeout(() => {
        if (reactFlowInstanceRef.current) {
          reactFlowInstanceRef.current.fitView({ 
            padding: 0.2,
            includeHiddenNodes: false
          });
        }
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [schemaKey, shouldFitView, nodes.length, edges.length]);

  return (
    <div className="flex-1 diagram-container" data-testid="diagram-flow">
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
      >
        <Controls />
        <Background gap={16} size={1} color="#e5e7eb" />
      </ReactFlow>
    </div>
  );
});

DiagramFlow.displayName = 'DiagramFlow';
