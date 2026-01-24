
import React, { useCallback, useEffect, useRef, memo } from 'react';
import { ReactFlow, Background, Controls, Node, Edge, ReactFlowInstance, OnNodesChange, OnEdgesChange } from '@xyflow/react';
import { NodeRenderer } from '@/components/schema-node/NodeRenderer';
import { diagramDbg } from '@/lib/diagram/diagramDebug';

const dbg = (message: string, data?: any) => diagramDbg('DiagramFlow', message, data);

interface DiagramFlowProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  schemaKey: number;
  shouldFitView: boolean;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  expandedNotationPaths?: Set<string>;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  onNodeDragStop?: (event: React.MouseEvent, node: Node, nodes: Node[]) => void;
  onNodeSelect?: (path: string) => void;
}

// React Flow passes 'selected' as a prop to custom node components
const nodeTypes = {
  schemaType: (props: any) => <NodeRenderer {...props} selected={props.selected} onAddNotation={props.data.onAddNotation} expandedNotationPaths={props.data.expandedNotationPaths} onToggleCollapse={props.data.onToggleCollapse} />,
  info: (props: any) => <NodeRenderer {...props} selected={props.selected} onAddNotation={props.data.onAddNotation} expandedNotationPaths={props.data.expandedNotationPaths} onToggleCollapse={props.data.onToggleCollapse} />,
  endpoint: (props: any) => <NodeRenderer {...props} selected={props.selected} onAddNotation={props.data.onAddNotation} expandedNotationPaths={props.data.expandedNotationPaths} onToggleCollapse={props.data.onToggleCollapse} />,
  components: (props: any) => <NodeRenderer {...props} selected={props.selected} onAddNotation={props.data.onAddNotation} expandedNotationPaths={props.data.expandedNotationPaths} onToggleCollapse={props.data.onToggleCollapse} />,
  method: (props: any) => <NodeRenderer {...props} selected={props.selected} onAddNotation={props.data.onAddNotation} expandedNotationPaths={props.data.expandedNotationPaths} onToggleCollapse={props.data.onToggleCollapse} />,
  response: (props: any) => <NodeRenderer {...props} selected={props.selected} onAddNotation={props.data.onAddNotation} expandedNotationPaths={props.data.expandedNotationPaths} onToggleCollapse={props.data.onToggleCollapse} />,
  requestBody: (props: any) => <NodeRenderer {...props} selected={props.selected} onAddNotation={props.data.onAddNotation} expandedNotationPaths={props.data.expandedNotationPaths} onToggleCollapse={props.data.onToggleCollapse} />,
};

export const DiagramFlow = memo(({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  schemaKey,
  shouldFitView,
  onAddNotation,
  expandedNotationPaths,
  onToggleCollapse,
  onNodeDragStop,
  onNodeSelect
}: DiagramFlowProps) => {
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
    if (reactFlowInstanceRef.current && shouldFitView && nodes.length > 0) {
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

  // Ensure root node is centered if it's the only node
  useEffect(() => {
    if (nodes.length === 1 && nodes[0].id === 'root' && reactFlowInstanceRef.current) {
      const timeout = setTimeout(() => {
        if (reactFlowInstanceRef.current) {
          reactFlowInstanceRef.current.fitView({ 
            padding: 0.4, // Larger padding for single node
            includeHiddenNodes: true
          });
        }
      }, 150);
      
      return () => clearTimeout(timeout);
    }
  }, [nodes]);

  // Handle node click for selection
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Always log for debugging (temporary)
    console.log('[DiagramFlow] onNodeClick fired', {
      nodeId: node.id,
      nodeType: node.type,
      path: node.data?.path,
      nodePath: node.data?.nodePath,
      hasOnNodeSelect: !!onNodeSelect
    });
    
    dbg('onNodeClick fired', {
      nodeId: node.id,
      nodeType: node.type,
      path: node.data?.path,
      nodePath: node.data?.nodePath,
      hasOnNodeSelect: !!onNodeSelect,
      nodeData: node.data
    });
    
    // Prefer nodePath (used by OpenAPI for structure path) over path (which may be API path like /v1/users)
    // For JSON Schema, path is the structure path (root.properties.x)
    // For OpenAPI, nodePath is the structure path (root.paths.-v1-users)
    const structurePath = node.data?.nodePath || node.data?.path;
    if (onNodeSelect && typeof structurePath === 'string') {
      console.log('[DiagramFlow] calling onNodeSelect', { structurePath });
      dbg('calling onNodeSelect', { structurePath });
      onNodeSelect(structurePath);
    } else {
      console.log('[DiagramFlow] onNodeSelect not called', { 
        onNodeSelect: !!onNodeSelect, 
        structurePath, 
        pathType: typeof structurePath 
      });
    }
  }, [onNodeSelect]);

  // Handle pane click for debugging
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    console.log('[DiagramFlow] onPaneClick fired (clicked empty space)');
    dbg('onPaneClick fired (clicked empty space)', { x: event.clientX, y: event.clientY });
  }, []);

  // Handle selection change for debugging
  const handleSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[], edges: Edge[] }) => {
    console.log('[DiagramFlow] onSelectionChange fired', {
      selectedNodesCount: selectedNodes.length,
      selectedNodeIds: selectedNodes.map(n => n.id),
      selectedNodePaths: selectedNodes.map(n => n.data?.nodePath || n.data?.path)
    });
    
    // Trigger selection when a single node is selected
    if (selectedNodes.length === 1 && onNodeSelect) {
      const node = selectedNodes[0];
      // Prefer nodePath for structure navigation
      const structurePath = node.data?.nodePath || node.data?.path;
      if (typeof structurePath === 'string') {
        console.log('[DiagramFlow] onSelectionChange -> calling onNodeSelect', { structurePath });
        onNodeSelect(structurePath);
      }
    }
  }, [onNodeSelect]);


  // Add onAddNotation, expandedNotationPaths, onToggleCollapse to all nodes
  // Also ensure nodes are selectable
  const nodesWithCallbacks = nodes.map(node => ({
    ...node,
    selectable: true, // Explicitly enable selection
    data: {
      ...node.data,
      onAddNotation,
      expandedNotationPaths,
      onToggleCollapse
    }
  }));

  // Debug: log when nodes change
  useEffect(() => {
    if (nodes.length > 0) {
      console.log('[DiagramFlow] nodes available', {
        count: nodes.length,
        samplePaths: nodes.slice(0, 3).map(n => ({ 
          id: n.id, 
          path: n.data?.path, 
          nodePath: n.data?.nodePath,
        })),
        hasOnNodeSelect: !!onNodeSelect
      });
      dbg('nodes available for selection', {
        count: nodes.length,
        samplePaths: nodes.slice(0, 3).map(n => ({ 
          id: n.id, 
          path: n.data?.path, 
          nodePath: n.data?.nodePath,
          selectable: n.selectable 
        }))
      });
    }
  }, [nodes, onNodeSelect]);

  return (
    <div className="flex-1 min-h-0 diagram-container" data-testid="diagram-flow">
      <ReactFlow
        key={`flow-${schemaKey}`}
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView={shouldFitView && nodes.length > 0}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={2}
        deleteKeyCode={null} // Disable deletion with Delete key
        onInit={onInit}
        onMove={onMove}
        onMoveEnd={onMove}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onSelectionChange={handleSelectionChange}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        defaultViewport={viewportRef.current} // Use stored viewport as default
      >
        <Controls />
        <Background gap={16} size={1} color="#e5e7eb" />
      </ReactFlow>
    </div>
  );
});

DiagramFlow.displayName = 'DiagramFlow';
