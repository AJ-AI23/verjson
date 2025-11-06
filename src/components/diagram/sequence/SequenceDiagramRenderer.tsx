import React, { useMemo, useCallback, useState } from 'react';
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
  Edge,
  Connection,
  addEdge as addFlowEdge
} from '@xyflow/react';
import { SequenceDiagramData, DiagramNode, DiagramEdge, DiagramNodeType } from '@/types/diagram';
import { calculateSequenceLayout, calculateSwimlaneLayout } from '@/lib/diagram/sequenceLayout';
import { SequenceNode } from './SequenceNode';
import { SequenceEdge } from './SequenceEdge';
import { SwimlaneHeader } from './SwimlaneHeader';
import { NodeEditor } from './NodeEditor';
import { EdgeEditor } from './EdgeEditor';
import { DiagramToolbar } from './DiagramToolbar';
import '@xyflow/react/dist/style.css';

interface SequenceDiagramRendererProps {
  data: SequenceDiagramData;
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onDataChange?: (data: SequenceDiagramData) => void;
  readOnly?: boolean;
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
  onEdgesChange,
  onDataChange,
  readOnly = false
}) => {
  const { swimlanes, columns, nodes: diagramNodes, edges: diagramEdges } = data;
  
  const [selectedNode, setSelectedNode] = useState<DiagramNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<DiagramEdge | null>(null);
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [isEdgeEditorOpen, setIsEdgeEditorOpen] = useState(false);

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
    
    // Sync position changes back to data
    const moveChange = changes.find((c: any) => c.type === 'position' && c.position);
    if (moveChange && onDataChange) {
      const updatedNodes = diagramNodes.map(n =>
        n.id === moveChange.id ? { ...n, position: moveChange.position } : n
      );
      onDataChange({ ...data, nodes: updatedNodes });
    }
  }, [handleNodesChange, onNodesChange, nodes, diagramNodes, data, onDataChange]);

  const onEdgesChangeHandler = useCallback((changes: any) => {
    handleEdgesChange(changes);
    if (onEdgesChange) {
      onEdgesChange(edges);
    }
  }, [handleEdgesChange, onEdgesChange, edges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (readOnly) return;
    const diagramNode = diagramNodes.find(n => n.id === node.id);
    if (diagramNode) {
      setSelectedNode(diagramNode);
      setIsNodeEditorOpen(true);
    }
  }, [diagramNodes, readOnly]);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    if (readOnly) return;
    const diagramEdge = diagramEdges.find(e => e.id === edge.id);
    if (diagramEdge) {
      setSelectedEdge(diagramEdge);
      setIsEdgeEditorOpen(true);
    }
  }, [diagramEdges, readOnly]);

  const onConnect = useCallback((connection: Connection) => {
    if (readOnly || !onDataChange) return;
    
    const newEdge: DiagramEdge = {
      id: `edge-${Date.now()}`,
      source: connection.source!,
      target: connection.target!,
      type: 'default'
    };
    
    const updatedEdges = [...diagramEdges, newEdge];
    onDataChange({ ...data, edges: updatedEdges });
    
    setEdges((eds) => addFlowEdge(connection, eds));
  }, [readOnly, diagramEdges, data, onDataChange, setEdges]);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<DiagramNode>) => {
    if (!onDataChange) return;
    
    const updatedNodes = diagramNodes.map(n =>
      n.id === nodeId ? { ...n, ...updates } : n
    );
    onDataChange({ ...data, nodes: updatedNodes });
  }, [diagramNodes, data, onDataChange]);

  const handleNodeDelete = useCallback((nodeId: string) => {
    if (!onDataChange) return;
    
    const updatedNodes = diagramNodes.filter(n => n.id !== nodeId);
    const updatedEdges = diagramEdges.filter(e => e.source !== nodeId && e.target !== nodeId);
    onDataChange({ ...data, nodes: updatedNodes, edges: updatedEdges });
  }, [diagramNodes, diagramEdges, data, onDataChange]);

  const handleEdgeUpdate = useCallback((edgeId: string, updates: Partial<DiagramEdge>) => {
    if (!onDataChange) return;
    
    const updatedEdges = diagramEdges.map(e =>
      e.id === edgeId ? { ...e, ...updates } : e
    );
    onDataChange({ ...data, edges: updatedEdges });
  }, [diagramEdges, data, onDataChange]);

  const handleEdgeDelete = useCallback((edgeId: string) => {
    if (!onDataChange) return;
    
    const updatedEdges = diagramEdges.filter(e => e.id !== edgeId);
    onDataChange({ ...data, edges: updatedEdges });
  }, [diagramEdges, data, onDataChange]);

  const handleAddNode = useCallback((type: DiagramNodeType) => {
    if (!onDataChange || swimlanes.length === 0 || columns.length === 0) return;
    
    const newNode: DiagramNode = {
      id: `node-${Date.now()}`,
      type,
      label: `New ${type}`,
      swimlaneId: swimlanes[0].id,
      columnId: columns[0].id,
      position: { x: 100, y: 100 }
    };
    
    const updatedNodes = [...diagramNodes, newNode];
    onDataChange({ ...data, nodes: updatedNodes });
  }, [diagramNodes, swimlanes, columns, data, onDataChange]);

  return (
    <div className="w-full h-full flex flex-col">
      {!readOnly && (
        <DiagramToolbar
          onAddNode={handleAddNode}
          onClearSelection={() => {
            setSelectedNode(null);
            setSelectedEdge(null);
          }}
          hasSelection={selectedNode !== null || selectedEdge !== null}
        />
      )}

      <div className="flex-1 relative">
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
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable={!readOnly}
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

      <NodeEditor
        node={selectedNode}
        swimlanes={swimlanes}
        columns={columns}
        isOpen={isNodeEditorOpen}
        onClose={() => {
          setIsNodeEditorOpen(false);
          setSelectedNode(null);
        }}
        onUpdate={handleNodeUpdate}
        onDelete={handleNodeDelete}
      />

      <EdgeEditor
        edge={selectedEdge}
        isOpen={isEdgeEditorOpen}
        onClose={() => {
          setIsEdgeEditorOpen(false);
          setSelectedEdge(null);
        }}
        onUpdate={handleEdgeUpdate}
        onDelete={handleEdgeDelete}
      />
    </div>
  );
};
