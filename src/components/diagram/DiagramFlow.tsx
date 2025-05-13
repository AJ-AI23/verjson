
import React, { useCallback, useEffect, useRef, memo, useMemo } from 'react';
import { ReactFlow, Background, Controls, Node, Edge, ReactFlowInstance, OnNodesChange, OnEdgesChange, PanelPosition } from '@xyflow/react';
import { SchemaTypeNode } from '@/components/SchemaTypeNode';

interface DiagramFlowProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
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
}: DiagramFlowProps) => {
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const viewportRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
  const didFitViewRef = useRef<boolean>(false);
  const viewportUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Memoize nodes and edges to prevent unnecessary re-renders
  const memoizedNodes = useMemo(() => nodes, [nodes]);
  const memoizedEdges = useMemo(() => edges, [edges]);
  
  // Store viewport when it changes - throttle updates
  const onMove = useCallback((event: any, viewport: any) => {
    if (viewport && !viewportUpdateTimeout.current) {
      viewportUpdateTimeout.current = setTimeout(() => {
        viewportRef.current = viewport;
        viewportUpdateTimeout.current = null;
      }, 100); // Throttle viewport updates
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

  // Force fit view when needed - with debouncing
  useEffect(() => {
    console.log(`DiagramFlow rendering with ${nodes.length} nodes and ${edges.length} edges`);
    
    if (reactFlowInstanceRef.current && shouldFitView && nodes.length > 0) {
      const timeout = setTimeout(() => {
        if (reactFlowInstanceRef.current) {
          console.log('Fitting view to diagram content');
          reactFlowInstanceRef.current.fitView({ 
            padding: 0.2,
            includeHiddenNodes: false
          });
        }
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [schemaKey, shouldFitView, nodes.length, edges.length]);

  // Performance options for ReactFlow
  const flowOptions = useMemo(() => ({
    fitView: shouldFitView && nodes.length > 0,
    fitViewOptions: { padding: 0.2 },
    minZoom: 0.5,
    maxZoom: 2,
    deleteKeyCode: null, // Disable deletion with Delete key
    defaultViewport: viewportRef.current,
    attributionPosition: 'bottom-right' as PanelPosition,
    snapToGrid: false, // Disable snap to grid for smoother panning
    elevateNodesOnSelect: false // Don't change z-index when selecting nodes
  }), [shouldFitView, nodes.length]);

  return (
    <div className="flex-1 diagram-container" data-testid="diagram-flow">
      <ReactFlow
        key={`flow-${schemaKey}`}
        nodes={memoizedNodes}
        edges={memoizedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        onMove={onMove}
        onMoveEnd={onMove}
        {...flowOptions}
      >
        <Controls showInteractive={false} />
        <Background gap={16} size={1} color="#e5e7eb" />
      </ReactFlow>
    </div>
  );
});

DiagramFlow.displayName = 'DiagramFlow';
