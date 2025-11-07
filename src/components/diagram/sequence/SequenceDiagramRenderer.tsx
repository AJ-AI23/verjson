import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
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
  addEdge as addFlowEdge,
  useReactFlow
} from '@xyflow/react';
import { SequenceDiagramData, DiagramNode, DiagramEdge, DiagramNodeType, Lifeline } from '@/types/diagram';
import { DiagramStyles, defaultLightTheme } from '@/types/diagramStyles';
import { calculateSequenceLayout } from '@/lib/diagram/sequenceLayout';
import { getNodeTypeConfig } from '@/lib/diagram/sequenceNodeTypes';
import { 
  calculateAdjustedPositions, 
  applyAdjustedPositions,
  applyAdjustedPositionsToDiagramNodes,
  getNodeHeight 
} from '@/lib/diagram/verticalSpacing';
import { SequenceNode } from './SequenceNode';
import { SequenceEdge } from './SequenceEdge';
import { ColumnLifelineNode } from './ColumnLifelineNode';
import { AnchorNode } from './AnchorNode';
import { NodeEditor } from './NodeEditor';
import { EdgeEditor } from './EdgeEditor';
import { NodeToolbarWrapper } from './NodeToolbarWrapper';
import { DiagramStylesDialog } from './DiagramStylesDialog';
import { OpenApiImportDialog } from './OpenApiImportDialog';
import { DiagramHeader } from '../DiagramHeader';
import '@xyflow/react/dist/style.css';

interface SequenceDiagramRendererProps {
  data: SequenceDiagramData;
  styles?: DiagramStyles;
  theme?: string; // Which theme to render: 'light' or 'dark'
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
  isRenderMode?: boolean;
  onRenderReady?: () => void;
  onFitViewReady?: (fitView: () => void) => void;
  initialViewport?: { x: number; y: number; zoom: number };
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
  hasUserInteractedWithViewport?: boolean;
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
  theme = 'light',
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
  onToggleFullscreen,
  isRenderMode = false,
  onRenderReady,
  onFitViewReady,
  initialViewport,
  onViewportChange,
  hasUserInteractedWithViewport = false
}) => {
  const { lifelines = [], nodes: diagramNodes } = data;
  
  const [selectedNode, setSelectedNode] = useState<DiagramNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<DiagramEdge | null>(null);
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [isEdgeEditorOpen, setIsEdgeEditorOpen] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragStartPositions, setDragStartPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const activeTheme = styles?.themes?.[theme] || styles?.themes?.light || defaultLightTheme;

// Helper component to handle fitView in render mode
const FitViewHelper: React.FC<{ 
  isRenderMode: boolean; 
  onReady?: () => void; 
  onFitViewReady?: (fitView: () => void) => void;
  nodesCount: number; 
  edgesCount: number;
  hasInitialViewport: boolean;
  hasUserInteracted: boolean;
}> = ({ 
  isRenderMode, 
  onReady,
  onFitViewReady,
  nodesCount,
  edgesCount,
  hasInitialViewport,
  hasUserInteracted
}) => {
  const { fitView } = useReactFlow();
  
  // Expose fitView function to parent for preview
  useEffect(() => {
    if (onFitViewReady && nodesCount > 0 && edgesCount > 0) {
      console.log('[FitViewHelper] Exposing fitView function to parent');
      onFitViewReady(() => {
        console.log('[FitViewHelper] fitView CALLED via onFitViewReady callback');
        fitView({ padding: 0.1, duration: 200 });
      });
    }
  }, [onFitViewReady, fitView, nodesCount, edgesCount]);
  
  // Auto-fit in render mode ONLY if no initial viewport is provided and user hasn't interacted
  useEffect(() => {
    if (isRenderMode && nodesCount > 0 && edgesCount > 0 && !hasInitialViewport && !hasUserInteracted) {
      console.log('[FitViewHelper] AUTO-FIT TRIGGERED - Nodes and edges ready, fitting view...', { 
        nodesCount, 
        edgesCount,
        hasUserInteracted,
        hasInitialViewport 
      });
      setTimeout(() => {
        try {
          console.log('[FitViewHelper] CALLING fitView() - AUTO-FIT');
          fitView({ padding: 0.1, duration: 0 });
          console.log('[FitViewHelper] fitView called successfully');
          setTimeout(() => {
            if (onReady) {
              console.log('[FitViewHelper] Calling onReady callback');
              onReady();
            }
          }, 300);
        } catch (error) {
          console.error('[FitViewHelper] Error in fitView:', error);
          // Still call onReady even if fitView fails
          if (onReady) {
            onReady();
          }
        }
      }, 100);
    } else if (isRenderMode && nodesCount > 0 && edgesCount > 0 && hasInitialViewport) {
      // If we have initial viewport, just wait for layout then signal ready
      console.log('[FitViewHelper] Using initial viewport, skipping fit', { hasInitialViewport, hasUserInteracted });
      setTimeout(() => {
        if (onReady) {
          console.log('[FitViewHelper] Calling onReady callback with fixed viewport');
          onReady();
        }
      }, 200);
    } else if (isRenderMode && nodesCount > 0 && edgesCount > 0 && hasUserInteracted) {
      console.log('[FitViewHelper] SKIPPING AUTO-FIT - User has interacted', { hasUserInteracted });
    } else if (isRenderMode) {
      console.log('[FitViewHelper] Waiting for nodes/edges...', { nodesCount, edgesCount, hasUserInteracted, hasInitialViewport });
    }
  }, [isRenderMode, nodesCount, edgesCount, fitView, onReady, hasInitialViewport, hasUserInteracted]);
  
  return null;
};

  // Add node on lifeline callback
  const handleAddNodeOnLifeline = useCallback((sourceLifelineId: string, yPosition: number) => {
    if (!onDataChange || lifelines.length === 0) return;
    
    const nodeId = `node-${Date.now()}`;
    const sourceAnchorId = `anchor-${nodeId}-source`;
    const targetAnchorId = `anchor-${nodeId}-target`;
    
    // Find the source lifeline and get the next one
    const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
    const sourceIndex = sortedLifelines.findIndex(l => l.id === sourceLifelineId);
    
    let targetLifelineId: string;
    let updatedLifelines = lifelines;
    
    // Check if there's a lifeline to the right
    if (sourceIndex < sortedLifelines.length - 1) {
      // Use the next lifeline
      targetLifelineId = sortedLifelines[sourceIndex + 1].id;
    } else {
      // Create a new lifeline
      const newLifelineId = `lifeline-${Date.now()}`;
      const newLifeline: Lifeline = {
        id: newLifelineId,
        name: `Service ${sortedLifelines.length + 1}`,
        order: sortedLifelines.length
      };
      updatedLifelines = [...lifelines, newLifeline];
      targetLifelineId = newLifelineId;
    }
    
    // Find nodes that need to be moved down
    const nodeHeight = 70;
    const minSpacing = 50;
    const newNodeBottom = yPosition + nodeHeight;
    
    const updatedNodes = diagramNodes.map(node => {
      const nodeY = node.position?.y || 0;
      // If existing node overlaps with new node position, move it down
      if (nodeY >= yPosition - minSpacing && nodeY < newNodeBottom + minSpacing) {
        const newY = newNodeBottom + minSpacing;
        const nodeCenterY = newY + nodeHeight / 2;
        return {
          ...node,
          position: { ...node.position, y: newY },
          anchors: node.anchors?.map(a => ({ ...a, yPosition: nodeCenterY })) as any
        };
      }
      return node;
    });
    
    const nodeCenterY = yPosition + nodeHeight / 2;
    const newNode: DiagramNode = {
      id: nodeId,
      type: 'endpoint',
      label: 'New Endpoint',
      anchors: [
        { id: sourceAnchorId, lifelineId: sourceLifelineId, yPosition: nodeCenterY, anchorType: 'source' },
        { id: targetAnchorId, lifelineId: targetLifelineId, yPosition: nodeCenterY, anchorType: 'target' }
      ],
      position: { x: 0, y: yPosition }
    };
    
    const finalNodes = [...updatedNodes, newNode];
    onDataChange({ ...data, lifelines: updatedLifelines, nodes: finalNodes });
  }, [diagramNodes, lifelines, data, onDataChange]);

  // Calculate layout
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    console.log('[SequenceRenderer] Calculating layout', {
      isRenderMode,
      lifelinesCount: lifelines?.length || 0,
      nodesCount: diagramNodes?.length || 0,
      hasActiveTheme: !!activeTheme
    });
    
    const layout = calculateSequenceLayout({
      lifelines,
      nodes: diagramNodes,
      styles: activeTheme
    });
    
    console.log('[SequenceRenderer] Layout calculated', {
      layoutNodesCount: layout.nodes?.length || 0,
      layoutEdgesCount: layout.edges?.length || 0,
      firstNode: layout.nodes?.[0],
      firstEdge: layout.edges?.[0]
    });
    
    return layout;
  }, [lifelines, diagramNodes, activeTheme, isRenderMode]);

  // Attach onAddNode handler to lifeline nodes
  const nodesWithHandlers = useMemo(() => {
    return layoutNodes.map(node => {
      if (node.type === 'columnLifeline') {
        return {
          ...node,
          data: {
            ...node.data,
            onAddNode: handleAddNodeOnLifeline,
            readOnly
          }
        };
      }
      return node;
    });
  }, [layoutNodes, handleAddNodeOnLifeline, readOnly]);

  const [nodes, setNodes, handleNodesChange] = useNodesState(nodesWithHandlers);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(layoutEdges);

  // Update nodes when layout changes and apply handlers
  useEffect(() => {
    setNodes(nodesWithHandlers);
  }, [nodesWithHandlers, setNodes]);

  const onNodesChangeHandler = useCallback((changes: any) => {
    // Store initial positions when drag starts
    const dragStartChange = changes.find((c: any) => c.type === 'position' && c.dragging === true);
    if (dragStartChange) {
      const startPositions = new Map<string, { x: number; y: number }>();
      nodes.forEach(n => {
        if (selectedNodeIds.includes(n.id) && n.type === 'sequenceNode') {
          startPositions.set(n.id, { x: n.position.x, y: n.position.y });
        }
      });
      setDragStartPositions(startPositions);
    }
    
    // Constrain sequence node movement to vertical only during drag
    const constrainedChanges = changes.map((change: any) => {
      if (change.type === 'position' && change.dragging) {
        const node = nodes.find(n => n.id === change.id);
        if (node?.type === 'sequenceNode') {
          // Multi-node drag disabled - only single node swapping is supported
          
          // Keep original X position, only allow Y to change
          return {
            ...change,
            position: {
              x: node.position.x,
              y: change.position?.y || node.position.y
            }
          };
        }
      }
      return change;
    });

    handleNodesChange(constrainedChanges);
    
     // Update anchors during drag
    const dragChange = constrainedChanges.find((c: any) => c.type === 'position' && c.dragging);
    if (dragChange) {
      const draggedNode = nodes.find(n => n.id === dragChange.id);
      if (draggedNode?.type === 'sequenceNode') {
        const diagramNode = diagramNodes.find(n => n.id === dragChange.id);
        const nodeConfig = diagramNode ? getNodeTypeConfig(diagramNode.type) : null;
        const nodeHeight = nodeConfig?.defaultHeight || 70;
        const newY = dragChange.position.y;
        const nodeCenterY = newY + (nodeHeight / 2);
        
        // For single node, check for swapping with other nodes
        if (!(selectedNodeIds.includes(dragChange.id) && selectedNodeIds.length > 1)) {
          // Update anchor positions for the dragged node
          setNodes(currentNodes =>
            currentNodes.map(n => {
              const anchorData = n.data as any;
              if (n.type === 'anchorNode' && anchorData?.connectedNodeId === dragChange.id) {
                return { ...n, position: { x: n.position.x, y: nodeCenterY - 8 } };
              }
              return n;
            })
          );
          
          // Check for collision and potential swap
          const otherSequenceNodes = nodes.filter(n => 
            n.type === 'sequenceNode' && n.id !== dragChange.id
          );
          
          let shouldSwapWith: Node | null = null;
          for (const otherNode of otherSequenceNodes) {
            const otherDiagramNode = diagramNodes.find(n => n.id === otherNode.id);
            const otherNodeConfig = otherDiagramNode ? getNodeTypeConfig(otherDiagramNode.type) : null;
            const otherNodeHeight = otherNodeConfig?.defaultHeight || 70;
            const otherNodeCenterY = otherNode.position.y + (otherNodeHeight / 2);
            
            // Check if dragged node's center has crossed the other node's center
            const draggedNodeOriginal = diagramNodes.find(n => n.id === dragChange.id);
            const originalY = draggedNodeOriginal?.position?.y || 0;
            const originalCenterY = originalY + (nodeHeight / 2);
            
            // Swap if centers have crossed
            if (originalCenterY < otherNodeCenterY && nodeCenterY > otherNodeCenterY) {
              // Dragging down and crossed center
              shouldSwapWith = otherNode;
              break;
            } else if (originalCenterY > otherNodeCenterY && nodeCenterY < otherNodeCenterY) {
              // Dragging up and crossed center
              shouldSwapWith = otherNode;
              break;
            }
          }
          
          if (shouldSwapWith) {
            // Perform swap - exchange Y positions
            const draggedDiagramNode = diagramNodes.find(n => n.id === dragChange.id);
            const swapDiagramNode = diagramNodes.find(n => n.id === shouldSwapWith.id);
            
            if (draggedDiagramNode && swapDiagramNode) {
              const draggedOriginalY = draggedDiagramNode.position?.y || 0;
              const swapOriginalY = swapDiagramNode.position?.y || 0;
              
              // Update diagram data with swapped positions
              const updatedDiagramNodes = diagramNodes.map(n => {
                if (n.id === dragChange.id) {
                  const nodeCenterY = swapOriginalY + (nodeHeight / 2);
                  return {
                    ...n,
                    position: { ...n.position, y: swapOriginalY },
                    anchors: n.anchors?.map(a => ({ ...a, yPosition: nodeCenterY })) as any
                  };
                }
                if (n.id === shouldSwapWith.id) {
                  const otherNodeConfig = getNodeTypeConfig(n.type);
                  const otherNodeHeight = otherNodeConfig?.defaultHeight || 70;
                  const nodeCenterY = draggedOriginalY + (otherNodeHeight / 2);
                  return {
                    ...n,
                    position: { ...n.position, y: draggedOriginalY },
                    anchors: n.anchors?.map(a => ({ ...a, yPosition: nodeCenterY })) as any
                  };
                }
                return n;
              });
              
              // Update visual positions
              setNodes(currentNodes =>
                currentNodes.map(n => {
                  if (n.id === dragChange.id) {
                    return { ...n, position: { x: n.position.x, y: swapOriginalY } };
                  }
                  if (n.id === shouldSwapWith.id) {
                    return { ...n, position: { x: n.position.x, y: draggedOriginalY } };
                  }
                  
                  // Update anchors for swapped nodes
                  const anchorData = n.data as any;
                  if (n.type === 'anchorNode') {
                    if (anchorData?.connectedNodeId === dragChange.id) {
                      const swapCenterY = swapOriginalY + (nodeHeight / 2);
                      return { ...n, position: { x: n.position.x, y: swapCenterY - 8 } };
                    }
                    if (anchorData?.connectedNodeId === shouldSwapWith.id) {
                      const otherNodeConfig = swapDiagramNode ? getNodeTypeConfig(swapDiagramNode.type) : null;
                      const otherNodeHeight = otherNodeConfig?.defaultHeight || 70;
                      const draggedCenterY = draggedOriginalY + (otherNodeHeight / 2);
                      return { ...n, position: { x: n.position.x, y: draggedCenterY - 8 } };
                    }
                  }
                  return n;
                })
              );
              
              onDataChange({ ...data, nodes: updatedDiagramNodes });
            }
          }
        }
      }
    }
    
    if (onNodesChange) {
      onNodesChange(nodes);
    }
    
    // Sync position changes back to data
    const moveChange = constrainedChanges.find((c: any) => c.type === 'position' && c.position && !c.dragging);
    if (moveChange && onDataChange) {
      // Check if this is a sequence node that just finished dragging
      const movedNode = nodes.find(n => n.id === moveChange.id);
      const isSequenceNode = movedNode?.type === 'sequenceNode';
      
      if (isSequenceNode) {
        // Apply vertical spacing adjustments
        const newY = moveChange.position.y;
        const adjustedPositions = calculateAdjustedPositions(
          moveChange.id,
          newY,
          diagramNodes
        );
        
        // Check if the adjustment is valid
        if (adjustedPositions === null) {
          // Invalid drag - would cause overlaps, revert to start position
          const startPos = dragStartPositions.get(moveChange.id);
          if (startPos) {
            setNodes(currentNodes => 
              currentNodes.map(n => {
                if (n.id === moveChange.id) {
                  return { ...n, position: startPos };
                }
                // Also revert anchor positions
                const anchorData = n.data as any;
                if (n.type === 'anchorNode' && anchorData?.connectedNodeId === moveChange.id) {
                  const diagramNode = diagramNodes.find(dn => dn.id === moveChange.id);
                  if (diagramNode) {
                    const nodeHeight = getNodeHeight(diagramNode);
                    const nodeCenterY = startPos.y + (nodeHeight / 2);
                    return { ...n, position: { x: n.position.x, y: nodeCenterY - 8 } };
                  }
                }
                return n;
              })
            );
          }
          // Clear drag start positions
          setDragStartPositions(new Map());
          handleNodesChange(constrainedChanges);
          return;
        }
        
        // Apply adjusted positions to visual nodes
        setNodes(currentNodes => {
          const updatedNodes = applyAdjustedPositions(currentNodes, adjustedPositions);
          
          // Update anchor positions for all adjusted nodes
          return updatedNodes.map(n => {
            const adjustedY = adjustedPositions.get(n.id);
            if (adjustedY !== undefined && n.type === 'sequenceNode') {
              const diagramNode = diagramNodes.find(dn => dn.id === n.id);
              if (diagramNode) {
                const nodeHeight = getNodeHeight(diagramNode);
                const nodeCenterY = adjustedY + (nodeHeight / 2);
                
                // Return node with updated position
                return n;
              }
            }
            
            // Update anchor positions for adjusted nodes
            const anchorData = n.data as any;
            if (n.type === 'anchorNode' && anchorData?.connectedNodeId) {
              const connectedAdjustedY = adjustedPositions.get(anchorData.connectedNodeId);
              if (connectedAdjustedY !== undefined) {
                const connectedDiagramNode = diagramNodes.find(dn => dn.id === anchorData.connectedNodeId);
                if (connectedDiagramNode) {
                  const nodeHeight = getNodeHeight(connectedDiagramNode);
                  const nodeCenterY = connectedAdjustedY + (nodeHeight / 2);
                  return { ...n, position: { x: n.position.x, y: nodeCenterY - 8 } };
                }
              }
            }
            
            return n;
          });
        });
        
        // Apply adjusted positions to diagram data
        const updatedDiagramNodes = applyAdjustedPositionsToDiagramNodes(
          diagramNodes,
          adjustedPositions
        );
        
        // Clear drag start positions after successful adjustment
        setDragStartPositions(new Map());
        
        onDataChange({ ...data, nodes: updatedDiagramNodes });
        
        // Skip further processing for sequence nodes
        return;
      }
      
      // Check if this is an anchor node
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
        
        // Check if we're swapping BEFORE updating diagram nodes
        let isSwapping = false;
        let draggedOriginalLifeline = '';
        const nodeWithAnchor = diagramNodes.find(n => n.anchors?.some(a => a.id === moveChange.id));
        if (nodeWithAnchor) {
          const draggedAnchorIndex = nodeWithAnchor.anchors.findIndex(a => a.id === moveChange.id);
          const otherAnchorIndex = draggedAnchorIndex === 0 ? 1 : 0;
          const otherAnchor = nodeWithAnchor.anchors[otherAnchorIndex];
          const draggedAnchor = nodeWithAnchor.anchors[draggedAnchorIndex];
          draggedOriginalLifeline = draggedAnchor.lifelineId;
          
          if (closestLifelineId === otherAnchor.lifelineId) {
            isSwapping = true;
          }
        }
        
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
            const otherAnchorIndex = anchorIndex === 0 ? 1 : 0;
            const otherAnchor = updatedAnchors[otherAnchorIndex];
            const draggedAnchor = updatedAnchors[anchorIndex];
            
            if (isSwapping) {
              // Swap the lifelines AND the anchor types (source/target)
              const draggedOriginalType = draggedAnchor.anchorType;
              const otherOriginalType = otherAnchor.anchorType;
              const otherOriginalLifeline = otherAnchor.lifelineId;
              
              updatedAnchors[anchorIndex] = {
                ...draggedAnchor,
                yPosition: nodeCenterY,
                lifelineId: otherOriginalLifeline,
                anchorType: otherOriginalType
              };
              updatedAnchors[otherAnchorIndex] = {
                ...otherAnchor,
                yPosition: nodeCenterY,
                lifelineId: draggedOriginalLifeline,
                anchorType: draggedOriginalType
              };
            } else {
              // Update the dragged anchor to new lifeline but keep Y at node center
              updatedAnchors[anchorIndex] = {
                ...draggedAnchor,
                yPosition: nodeCenterY,
                lifelineId: closestLifelineId
              };
              
              // Also update the other anchor's Y to ensure they're both at node center
              updatedAnchors[otherAnchorIndex] = {
                ...otherAnchor,
                yPosition: nodeCenterY
              };
            }
            
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
          
          // Helper to get lifeline X position
          const getLifelineX = (lifelineId: string) => {
            const lifeline = lifelines.find(l => l.id === lifelineId);
            if (!lifeline) return 0;
            const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
            const index = sortedLifelines.findIndex(l => l.id === lifelineId);
            return index * (300 + 100) + 150; // Match the calculation above
          };
          
          return currentNodes.map(n => {
            // Update anchor positions
            const anchorData = n.data as any;
            if (n.type === 'anchorNode' && anchorData?.connectedNodeId === connectedNode.id) {
              const isTheDraggedAnchor = n.id === moveChange.id;
              
              if (isSwapping) {
                // If swapping, both anchors move to each other's lifelines
                // Note: connectedNode already has the updated anchors with swapped lifelines
                const draggedAnchorIndex = connectedNode.anchors.findIndex(a => a.id === moveChange.id);
                const otherAnchorIndex = draggedAnchorIndex === 0 ? 1 : 0;
                
                if (isTheDraggedAnchor) {
                  // Dragged anchor moves to where other anchor was (closestLifelineId)
                  const newX = getLifelineX(closestLifelineId);
                  return { ...n, position: { x: newX - 8, y: nodeCenterY - 8 } };
                } else {
                  // Other anchor moves to where dragged anchor was (draggedOriginalLifeline)
                  const newX = getLifelineX(draggedOriginalLifeline);
                  return { ...n, position: { x: newX - 8, y: nodeCenterY - 8 } };
                }
              } else {
                // Normal drag - only update dragged anchor position
                return { 
                  ...n, 
                  position: { 
                    x: isTheDraggedAnchor ? snappedX : n.position.x, 
                    y: nodeCenterY - 8 
                  } 
                };
              }
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
        
        // If multi-select, update all selected nodes
        if (selectedNodeIds.includes(moveChange.id) && selectedNodeIds.length > 1) {
          const originalY = movedDiagramNode?.position?.y || 0;
          const deltaY = constrainedY - originalY;
          
          // Update all selected nodes with the same delta
          const updatedNodes = diagramNodes.map(n => {
            if (selectedNodeIds.includes(n.id)) {
              const nConfig = getNodeTypeConfig(n.type);
              const nHeight = nConfig?.defaultHeight || 70;
              const currentY = n.position?.y || 0;
              const newY = n.id === moveChange.id ? constrainedY : currentY + deltaY;
              const snappedNewY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
              const constrainedNewY = Math.max(MIN_Y_POSITION, snappedNewY);
              const centerY = constrainedNewY + (nHeight / 2);
              
              const updatedAnchors = n.anchors?.map(anchor => ({
                ...anchor,
                yPosition: centerY
              }));
              
              return {
                ...n,
                position: { ...n.position, y: constrainedNewY },
                anchors: updatedAnchors as [typeof updatedAnchors[0], typeof updatedAnchors[1]]
              };
            }
            return n;
          });
          
          onDataChange({ ...data, nodes: updatedNodes });
        } else {
          // Single node update
          // Calculate the correct horizontal position based on anchors (keep original X)
          const nodeAnchors = movedDiagramNode?.anchors;
          let originalX = movedDiagramNode?.position?.x || moveChange.position.x;
          
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
                originalX = leftX + MARGIN;
              } else {
                // Center if too narrow
                originalX = (leftX + rightX) / 2 - 90;
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
                position: { x: originalX, y: constrainedY },
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
                return { ...n, position: { x: originalX, y: constrainedY } };
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
    }
  }, [handleNodesChange, onNodesChange, nodes, diagramNodes, data, onDataChange, lifelines, setNodes, selectedNodeIds, dragStartPositions]);

  const onEdgesChangeHandler = useCallback((changes: any) => {
    handleEdgesChange(changes);
    if (onEdgesChange) {
      onEdgesChange(edges);
    }
  }, [handleEdgesChange, onEdgesChange, edges]);

  const onNodeClick = useCallback((event: any, node: Node) => {
    if (readOnly) return;
    
    // Only show toolbar for sequence nodes
    if (node.type !== 'sequenceNode') return;
    
    const diagramNode = diagramNodes.find(n => n.id === node.id);
    if (diagramNode) {
      // Check if Ctrl/Cmd key is pressed for multi-select
      const isMultiSelect = event.ctrlKey || event.metaKey;
      
      if (isMultiSelect) {
        // Toggle selection in multi-select mode
        setSelectedNodeIds(prev => {
          if (prev.includes(node.id)) {
            const newSelection = prev.filter(id => id !== node.id);
            if (newSelection.length === 0) {
              setToolbarPosition(null);
            } else {
              // Update toolbar position to first selected node
              const firstNode = nodes.find(n => n.id === newSelection[0]);
              if (firstNode) {
                const firstDiagram = diagramNodes.find(n => n.id === newSelection[0]);
                const nodeConfig = firstDiagram ? getNodeTypeConfig(firstDiagram.type) : null;
                const nodeWidth = (firstNode.data?.width as number) || 180;
                setToolbarPosition({
                  x: firstNode.position.x + nodeWidth / 2,
                  y: firstNode.position.y
                });
              }
            }
            return newSelection;
          } else {
            const newSelection = [...prev, node.id];
            // Update toolbar to clicked node
            const nodeConfig = getNodeTypeConfig(diagramNode.type);
            const nodeWidth = (node.data?.width as number) || 180;
            setToolbarPosition({
              x: node.position.x + nodeWidth / 2,
              y: node.position.y
            });
            return newSelection;
          }
        });
      } else {
        // Single selection mode
        if (selectedNodeIds.length === 1 && selectedNodeIds[0] === node.id) {
          // Clicking same node - deselect
          setSelectedNodeIds([]);
          setToolbarPosition(null);
        } else {
          // Select this node only
          setSelectedNodeIds([node.id]);
          const nodeConfig = getNodeTypeConfig(diagramNode.type);
          const nodeWidth = (node.data?.width as number) || 180;
          setToolbarPosition({
            x: node.position.x + nodeWidth / 2,
            y: node.position.y
          });
        }
      }
    }
  }, [diagramNodes, readOnly, selectedNodeIds, nodes]);
  
  const handleEditNode = useCallback(() => {
    // Only edit if single node is selected
    if (selectedNodeIds.length === 1) {
      const diagramNode = diagramNodes.find(n => n.id === selectedNodeIds[0]);
      if (diagramNode) {
        setSelectedNode(diagramNode);
        setIsNodeEditorOpen(true);
        setSelectedNodeIds([]);
        setToolbarPosition(null);
      }
    }
  }, [selectedNodeIds, diagramNodes]);
  
  const handleDeleteNode = useCallback(() => {
    if (selectedNodeIds.length > 0 && onDataChange) {
      const updatedNodes = diagramNodes.filter(n => !selectedNodeIds.includes(n.id));
      
      onDataChange({
        ...data,
        nodes: updatedNodes
      });
      
      setSelectedNodeIds([]);
      setToolbarPosition(null);
    }
  }, [selectedNodeIds, diagramNodes, data, onDataChange]);
  
  // Close toolbar when clicking outside
  const onPaneClick = useCallback(() => {
    setSelectedNodeIds([]);
    setToolbarPosition(null);
  }, []);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    // Edges are auto-generated, so we don't support editing them directly
    if (readOnly) return;
  }, [readOnly]);

  const onConnect = useCallback((connection: Connection) => {
    // Edges are auto-generated from anchors, manual connections not supported
    if (readOnly || !onDataChange) return;
  }, [readOnly, onDataChange]);

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
    onDataChange({ ...data, nodes: updatedNodes });
  }, [diagramNodes, data, onDataChange]);

  const handleEdgeUpdate = useCallback((edgeId: string, updates: Partial<DiagramEdge>) => {
    // Edges are auto-generated, no manual updates supported
  }, []);

  const handleEdgeDelete = useCallback((edgeId: string) => {
    // Edges are auto-generated, no manual deletion supported
  }, []);

  const handleImportFromOpenApi = useCallback((nodes: DiagramNode[]) => {
    if (!onDataChange) return;
    
    const updatedNodes = [...diagramNodes, ...nodes];
    onDataChange({ ...data, nodes: updatedNodes });
  }, [diagramNodes, data, onDataChange]);

  // Log rendering information
  console.log('[SequenceRenderer] Rendering with:', {
    isRenderMode,
    nodesCount: nodes?.length || 0,
    edgesCount: edges?.length || 0,
    hasActiveTheme: !!activeTheme,
    backgroundColor: activeTheme?.colors.background,
    firstThreeNodes: nodes?.slice(0, 3).map(n => ({ id: n.id, type: n.type, position: n.position })),
    firstThreeEdges: edges?.slice(0, 3).map(e => ({ id: e.id, source: e.source, target: e.target }))
  });

  return (
    <div className="w-full h-full flex flex-col" style={{ backgroundColor: activeTheme?.colors.background }}>
      {!isRenderMode && (
        <DiagramHeader 
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
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
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={!isRenderMode && !initialViewport}
          defaultViewport={initialViewport}
          onViewportChange={onViewportChange}
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
          {!isRenderMode && (
            <>
              <Controls />
              <MiniMap
                nodeColor={() => '#f1f5f9'}
                className="bg-white border border-slate-200"
              />
            </>
          )}
          
          {/* Render mode helper */}
          <FitViewHelper 
            isRenderMode={isRenderMode}
            onReady={onRenderReady}
            onFitViewReady={onFitViewReady}
            nodesCount={nodes.length}
            edgesCount={edges.length}
            hasInitialViewport={!!initialViewport}
            hasUserInteracted={hasUserInteractedWithViewport}
          />
          
          {/* Node selection toolbar */}
          {!isRenderMode && selectedNodeIds.length > 0 && toolbarPosition && (
            <NodeToolbarWrapper
              diagramPosition={toolbarPosition}
              selectedCount={selectedNodeIds.length}
              onEdit={handleEditNode}
              onDelete={handleDeleteNode}
            />
          )}
        </ReactFlow>
      </div>

      {!isRenderMode && (
        <>
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
        </>
      )}
    </div>
  );
};