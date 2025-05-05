
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
  const isInitialRender = useRef(true);
  const prevNodesLengthRef = useRef<number>(nodes.length);

  // Store viewport when it changes
  const onMove = useCallback((event: any) => {
    if (reactFlowInstanceRef.current) {
      const { x, y, zoom } = reactFlowInstanceRef.current.getViewport();
      viewportRef.current = { x, y, zoom };
      console.log('Stored viewport:', viewportRef.current);
    }
  }, []);

  const onMoveEnd = useCallback((event: any) => {
    if (reactFlowInstanceRef.current) {
      const { x, y, zoom } = reactFlowInstanceRef.current.getViewport();
      viewportRef.current = { x, y, zoom };
      console.log('Move ended, viewport:', viewportRef.current);
    }
  }, []);

  // Store reference to ReactFlow instance
  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('ReactFlow initialized');
    reactFlowInstanceRef.current = instance;
    
    // Only restore viewport after the initial render has completed
    if (viewportRef.current && !shouldFitView && !isInitialRender.current) {
      console.log('Restoring viewport on init:', viewportRef.current);
      // Delay the viewport restoration slightly to ensure the diagram has rendered
      setTimeout(() => {
        if (reactFlowInstanceRef.current && viewportRef.current) {
          reactFlowInstanceRef.current.setViewport(viewportRef.current);
          console.log('Viewport restored on init');
        }
      }, 100);
    }
    
    isInitialRender.current = false;
  }, [shouldFitView]);

  // Effect to restore viewport when nodes change but we don't want to fit view
  useEffect(() => {
    // Skip this effect on initial render
    if (isInitialRender.current) {
      return;
    }

    const currentNodesLength = nodes.length;
    const nodesLengthChanged = prevNodesLengthRef.current !== currentNodesLength;
    prevNodesLengthRef.current = currentNodesLength;

    // Only apply viewport restoration when:
    // 1. We have a stored viewport
    // 2. We're not fitting the view
    // 3. We're not in initial render
    // 4. We have the ReactFlow instance
    if (
      reactFlowInstanceRef.current && 
      viewportRef.current && 
      !shouldFitView && 
      !isInitialRender.current
    ) {
      console.log('Nodes or edges changed, restoring viewport:', viewportRef.current);
      
      // Different timeout approach for node count changes vs just edge/position changes
      const timeoutDelay = nodesLengthChanged ? 150 : 50;
      
      // Use a short timeout to ensure the diagram has been updated before setting viewport
      const timeoutId = setTimeout(() => {
        if (reactFlowInstanceRef.current && viewportRef.current) {
          console.log('Setting viewport after timeout:', viewportRef.current);
          reactFlowInstanceRef.current.setViewport(viewportRef.current);
        }
      }, timeoutDelay);
      
      return () => clearTimeout(timeoutId);
    }
  }, [nodes, edges, shouldFitView]);

  // Additional effect to update viewport reference if shouldFitView changes to false
  useEffect(() => {
    // If we're no longer fitting the view and we have a ReactFlow instance
    if (!shouldFitView && reactFlowInstanceRef.current) {
      // Update our viewport reference with the current viewport
      const { x, y, zoom } = reactFlowInstanceRef.current.getViewport();
      viewportRef.current = { x, y, zoom };
      console.log('Updated viewport reference after fitView change:', viewportRef.current);
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
        onMoveEnd={onMoveEnd}
      >
        <Controls />
        <Background gap={16} size={1} color="#e5e7eb" />
      </ReactFlow>
    </div>
  );
};
