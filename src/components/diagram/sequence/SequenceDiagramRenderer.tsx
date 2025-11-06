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
import { DiagramStyles } from '@/types/diagramStyles';
import { calculateSequenceLayout } from '@/lib/diagram/sequenceLayout';
import { getNodeTypeConfig } from '@/lib/diagram/sequenceNodeTypes';
import { SequenceNode } from './SequenceNode';
import { SequenceEdge } from './SequenceEdge';
import { ColumnLifelineNode } from './ColumnLifelineNode';
import { AnchorNode } from './AnchorNode';
import { NodeEditor } from './NodeEditor';
import { EdgeEditor } from './EdgeEditor';
import { DiagramToolbar } from './DiagramToolbar';
import { DiagramStylesDialog } from './DiagramStylesDialog';
import { OpenApiImportDialog } from './OpenApiImportDialog';
import { DiagramHeader } from '../DiagramHeader';
import '@xyflow/react/dist/style.css';

interface SequenceDiagramRendererProps {
  data: SequenceDiagramData;
  styles?: DiagramStyles;
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onDataChange?: (data: SequenceDiagramData) => void;
  onStylesChange?: (styles: DiagramStyles) => void;
  readOnly?: boolean;
  workspaceId?: string;
  isStylesDialogOpen?: boolean;
  onStylesDialogClose?: () => void;
  isOpenApiImportOpen?: boolean;
  onOpenApiImportClose?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const nodeTypes: NodeTypes = {
  sequenceNode: SequenceNode,
  columnLifeline: ColumnLifelineNode,
  anchorNode: AnchorNode,
};

const edgeTypes: EdgeTypes = {
  sequenceEdge: SequenceEdge,
};

export const SequenceDiagramRenderer: React.FC<SequenceDiagramRendererProps> = ({
  data,
  styles,
  onNodesChange,
  onEdgesChange,
  onDataChange,
  onStylesChange,
  readOnly = false,
  workspaceId,
  isStylesDialogOpen = false,
  onStylesDialogClose,
  isOpenApiImportOpen = false,
  onOpenApiImportClose,
  isFullscreen = false,
  onToggleFullscreen
}) => {
  const { lifelines, nodes: diagramNodes, edges: diagramEdges } = data;
  
  const [selectedNode, setSelectedNode] = useState<DiagramNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<DiagramEdge | null>(null);
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [isEdgeEditorOpen, setIsEdgeEditorOpen] = useState(false);

  const activeTheme = styles?.themes[styles?.activeTheme || 'light'] || styles?.themes.light;

  // Calculate layout
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    return calculateSequenceLayout({
      lifelines,
      nodes: diagramNodes,
      edges: diagramEdges,
      styles: activeTheme
    });
  }, [lifelines, diagramNodes, diagramEdges, activeTheme]);

  const [nodes, setNodes, handleNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(layoutEdges);

  const onNodesChangeHandler = useCallback((changes: any) => {
    handleNodesChange(changes);
    if (onNodesChange) {
      onNodesChange(nodes);
    }
    
    // Sync position changes back to data
    const moveChange = changes.find((c: any) => c.type === 'position' && c.position);
    if (moveChange && onDataChange) {
      // Check if this is an anchor node
      const movedNode = nodes.find(n => n.id === moveChange.id);
      const isAnchor = movedNode?.type === 'anchorNode';
      
      if (isAnchor) {
        // Update anchor position - snap to nearest lifeline
        const anchorData = movedNode?.data as any;
        
        // Find which lifeline this anchor should snap to based on X position
        const anchorX = moveChange.position.x + 8; // Add half width to get center
        let closestLifelineId = anchorData?.lifelineId;
        let closestLifelineX = 0;
        let minDistance = Infinity;
        
        // Calculate lifeline positions and find closest
        const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
        sortedLifelines.forEach((lifeline, index) => {
          const lifelineX = index * (300 + 100) + 150; // LIFELINE_WIDTH + horizontalSpacing + padding
          const distance = Math.abs(anchorX - lifelineX);
          if (distance < minDistance) {
            minDistance = distance;
            closestLifelineId = lifeline.id;
            closestLifelineX = lifelineX;
          }
        });
        
        // Snap anchor to lifeline X position
        const snappedX = closestLifelineX - 8; // Center the 16px anchor
        
        // Update the node that contains this anchor
        const updatedDiagramNodes = diagramNodes.map(n => {
          const anchorIndex = n.anchors?.findIndex(a => a.id === moveChange.id);
          if (anchorIndex !== undefined && anchorIndex !== -1) {
            // Get node height to determine center Y
            const nodeConfig = getNodeTypeConfig(n.type);
            const nodeHeight = nodeConfig?.defaultHeight || 70;
            const currentNodeY = n.position?.y || 100;
            
            // Keep both anchors at the node's current center Y position
            const nodeCenterY = currentNodeY + (nodeHeight / 2);
            
            const updatedAnchors = [...n.anchors];
            
            // Update the dragged anchor to new lifeline but keep Y at node center
            updatedAnchors[anchorIndex] = {
              ...updatedAnchors[anchorIndex],
              yPosition: nodeCenterY,
              lifelineId: closestLifelineId
            };
            
            // Also update the other anchor's Y to ensure they're both at node center
            const otherAnchorIndex = anchorIndex === 0 ? 1 : 0;
            updatedAnchors[otherAnchorIndex] = {
              ...updatedAnchors[otherAnchorIndex],
              yPosition: nodeCenterY
            };
            
            // Calculate new node position and dimensions based on both anchors
            const sourceAnchor = updatedAnchors[0];
            const targetAnchor = updatedAnchors[1];
            
            // Find lifeline X positions for both anchors
            const sourceLifeline = sortedLifelines.find(l => l.id === sourceAnchor.lifelineId);
            const targetLifeline = sortedLifelines.find(l => l.id === targetAnchor.lifelineId);
            
            if (sourceLifeline && targetLifeline) {
              const sourceIndex = sortedLifelines.indexOf(sourceLifeline);
              const targetIndex = sortedLifelines.indexOf(targetLifeline);
              
              const sourceX = sourceIndex * (300 + 100) + 150;
              const targetX = targetIndex * (300 + 100) + 150;
              
              const MARGIN = 40;
              const leftX = Math.min(sourceX, targetX);
              const rightX = Math.max(sourceX, targetX);
              
              // Calculate node width and position with margins
              const nodeWidth = Math.abs(rightX - leftX) - (MARGIN * 2);
              let nodeX: number;
              
              if (nodeWidth >= 180) {
                nodeX = leftX + MARGIN;
              } else {
                // Center if too narrow
                nodeX = (leftX + rightX) / 2 - 90;
              }
              
              // Keep the same Y position (don't move vertically)
              return {
                ...n,
                anchors: updatedAnchors as [typeof updatedAnchors[0], typeof updatedAnchors[1]],
                position: { x: nodeX, y: currentNodeY }
              };
            }
          }
          return n;
        });
        
        // Apply the snap by updating anchor and node positions immediately
        setNodes(currentNodes => {
          const connectedNode = updatedDiagramNodes.find(n => 
            n.anchors?.some(a => a.id === moveChange.id)
          );
          
          if (!connectedNode) return currentNodes;
          
          const nodeConfig = getNodeTypeConfig(connectedNode.type);
          const nodeHeight = nodeConfig?.defaultHeight || 70;
          const currentNodeY = connectedNode.position?.y || 100;
          const nodeCenterY = currentNodeY + (nodeHeight / 2);
          
          return currentNodes.map(n => {
            // Update both anchor positions to be at node center
            const anchorData = n.data as any;
            if (n.type === 'anchorNode' && anchorData?.connectedNodeId === connectedNode.id) {
              // For the dragged anchor, use snappedX; for the other anchor, keep its X position
              const isTheDraggedAnchor = n.id === moveChange.id;
              return { 
                ...n, 
                position: { 
                  x: isTheDraggedAnchor ? snappedX : n.position.x, 
                  y: nodeCenterY - 8 
                } 
              };
            }
            // Update the node position (horizontal only)
            if (n.id === connectedNode.id) {
              return { ...n, position: { x: connectedNode.position?.x || 0, y: currentNodeY } };
            }
            return n;
          });
        });
        
        onDataChange({ ...data, nodes: updatedDiagramNodes });
      } else {
        // Regular node position update - also update connected anchors
        const movedDiagramNode = diagramNodes.find(n => n.id === moveChange.id);
        const nodeConfig = movedDiagramNode ? getNodeTypeConfig(movedDiagramNode.type) : null;
        const nodeHeight = nodeConfig?.defaultHeight || 70;
        
        // Constrain vertical position to be below lifeline headers
        const LIFELINE_HEADER_HEIGHT = 100;
        const MIN_Y_POSITION = LIFELINE_HEADER_HEIGHT + 20; // 20px padding below header
        const GRID_SIZE = 10; // Snap to 10px grid
        
        // Snap to grid and constrain to minimum position
        const snappedY = Math.round(moveChange.position.y / GRID_SIZE) * GRID_SIZE;
        const constrainedY = Math.max(MIN_Y_POSITION, snappedY);
        
        // Calculate the correct horizontal position based on anchors
        const nodeAnchors = movedDiagramNode?.anchors;
        let snappedX = moveChange.position.x;
        
        if (nodeAnchors && nodeAnchors.length === 2) {
          const MARGIN = 40; // Margin from lifeline for edges
          const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
          
          // Find lifeline X positions
          const sourceLifeline = sortedLifelines.find(l => l.id === nodeAnchors[0].lifelineId);
          const targetLifeline = sortedLifelines.find(l => l.id === nodeAnchors[1].lifelineId);
          
          if (sourceLifeline && targetLifeline) {
            const sourceIndex = sortedLifelines.indexOf(sourceLifeline);
            const targetIndex = sortedLifelines.indexOf(targetLifeline);
            
            const sourceX = sourceIndex * (300 + 100) + 150; // LIFELINE_WIDTH + spacing + padding
            const targetX = targetIndex * (300 + 100) + 150;
            
            const leftX = Math.min(sourceX, targetX);
            const rightX = Math.max(sourceX, targetX);
            
            // Calculate node width and position with margins
            const nodeWidth = Math.abs(rightX - leftX) - (MARGIN * 2);
            
            if (nodeWidth >= 180) {
              snappedX = leftX + MARGIN;
            } else {
              // Center if too narrow
              snappedX = (leftX + rightX) / 2 - 90;
            }
          }
        }
        
        // Update node and its anchors
        const nodeCenterY = constrainedY + (nodeHeight / 2);
        const updatedNodes = diagramNodes.map(n => {
          if (n.id === moveChange.id) {
            // Update node position and anchor Y positions
            const updatedAnchors = n.anchors?.map(anchor => ({
              ...anchor,
              yPosition: nodeCenterY
            }));
            
            return { 
              ...n, 
              position: { x: snappedX, y: constrainedY },
              anchors: updatedAnchors as [typeof updatedAnchors[0], typeof updatedAnchors[1]]
            };
          }
          return n;
        });
        
        // Immediately update node and anchor positions visually
        setNodes(currentNodes => 
          currentNodes.map(n => {
            const anchorData = n.data as any;
            if (n.id === moveChange.id) {
              return { ...n, position: { x: snappedX, y: constrainedY } };
            }
            if (n.type === 'anchorNode' && anchorData?.connectedNodeId === moveChange.id) {
              return { ...n, position: { ...n.position, y: nodeCenterY - 8 } };
            }
            return n;
          })
        );
        
        onDataChange({ ...data, nodes: updatedNodes });
      }
    }
  }, [handleNodesChange, onNodesChange, nodes, diagramNodes, data, onDataChange, lifelines, setNodes]);

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
    if (!onDataChange || lifelines.length === 0) return;
    
    const nodeId = `node-${Date.now()}`;
    const sourceAnchorId = `anchor-${nodeId}-source`;
    const targetAnchorId = `anchor-${nodeId}-target`;
    
    const sourceLifelineId = lifelines[0].id;
    const targetLifelineId = lifelines.length > 1 ? lifelines[1].id : sourceLifelineId;
    
    const newNode: DiagramNode = {
      id: nodeId,
      type,
      label: `New ${type}`,
      anchors: [
        { id: sourceAnchorId, lifelineId: sourceLifelineId, yPosition: 100, anchorType: 'source' },
        { id: targetAnchorId, lifelineId: targetLifelineId, yPosition: 100, anchorType: 'target' }
      ],
      position: { x: 100, y: 100 }
    };
    
    const updatedNodes = [...diagramNodes, newNode];
    onDataChange({ ...data, nodes: updatedNodes });
  }, [diagramNodes, lifelines, data, onDataChange]);

  const handleImportFromOpenApi = useCallback((nodes: DiagramNode[]) => {
    if (!onDataChange) return;
    
    const updatedNodes = [...diagramNodes, ...nodes];
    onDataChange({ ...data, nodes: updatedNodes });
  }, [diagramNodes, data, onDataChange]);

  return (
    <div className="w-full h-full flex flex-col" style={{ backgroundColor: activeTheme?.colors.background }}>
      <DiagramHeader 
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
      
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

      <NodeEditor
        node={selectedNode}
        lifelines={lifelines}
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

      <OpenApiImportDialog
        isOpen={isOpenApiImportOpen}
        onClose={onOpenApiImportClose || (() => {})}
        onImport={handleImportFromOpenApi}
        lifelines={lifelines}
        currentWorkspaceId={workspaceId}
      />

      {styles && onStylesChange && (
        <DiagramStylesDialog
          isOpen={isStylesDialogOpen}
          onClose={onStylesDialogClose || (() => {})}
          styles={styles}
          onStylesChange={onStylesChange}
        />
      )}
    </div>
  );
};