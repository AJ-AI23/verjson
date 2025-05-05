
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
  const lastSchemaKeyRef = useRef<number>(schemaKey);

  // Store viewport when it changes
  const onMove = useCallback((event: any) => {
    if (reactFlowInstanceRef.current) {
      const { x, y, zoom } = reactFlowInstanceRef.current.getViewport();
      viewportRef.current = { x, y, zoom };
      console.log('Stored viewport on move:', viewportRef.current);
    }
  }, []);

  const onMoveEnd = useCallback((event: any) => {
    if (reactFlowInstanceRef.current) {
      const { x, y, zoom } = reactFlowInstanceRef.current.getViewport();
      viewportRef.current = { x, y, zoom };
      console.log('Move ended, viewport stored:', viewportRef.current);
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
      }, 250); // Increased timeout to ensure rendering is complete
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
    
    // Store schema key to detect real schema changes
    const schemaChanged = lastSchemaKeyRef.current !== schemaKey;
    lastSchemaKeyRef.current = schemaKey;

    // We should only restore viewport when:
    // 1. We have a stored viewport
    // 2. We're not fitting the view
    // 3. We have the ReactFlow instance
    // 4. There's been some change (nodes, edges, or schema)
    if (
      reactFlowInstanceRef.current && 
      viewportRef.current && 
      !shouldFitView
    ) {
      console.log('Change detected, preparing to restore viewport:', 
        { nodesLengthChanged, schemaChanged, viewport: viewportRef.current });
      
      // Use a longer timeout for schema changes, shorter for other updates
      const timeoutDelay = schemaChanged ? 300 : (nodesLengthChanged ? 200 : 100);
      
      // Use a short timeout to ensure the diagram has been updated before setting viewport
      const timeoutId = setTimeout(() => {
        if (reactFlowInstanceRef.current && viewportRef.current) {
          console.log('Setting viewport after timeout:', viewportRef.current);
          reactFlowInstanceRef.current.setViewport(viewportRef.current);
        }
      }, timeoutDelay);
      
      return () => clearTimeout(timeoutId);
    }
  }, [nodes, edges, schemaKey, shouldFitView]);

  // Effect to capture viewport before fit view changes
  useEffect(() => {
    // Capture viewport before shouldFitView changes to true
    if (shouldFitView === false && reactFlowInstanceRef.current) {
      const { x, y, zoom } = reactFlowInstanceRef.current.getViewport();
      viewportRef.current = { x, y, zoom };
      console.log('Stored viewport before fit view change:', viewportRef.current);
    }
  }, [shouldFitView]);

  // Special effect to handle post-schema-change viewport restoration
  useEffect(() => {
    // Only run this effect when schema key changes and we're not in initial render
    if (!isInitialRender.current && schemaKey > 0 && viewportRef.current && !shouldFitView) {
      console.log('Schema changed, preparing viewport restoration');
      const timeoutId = setTimeout(() => {
        if (reactFlowInstanceRef.current && viewportRef.current) {
          console.log('Restoring viewport after schema change:', viewportRef.current);
          reactFlowInstanceRef.current.setViewport(viewportRef.current);
        }
      }, 350); // Longer timeout for schema changes
      
      return () => clearTimeout(timeoutId);
    }
  }, [schemaKey, shouldFitView]);

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
