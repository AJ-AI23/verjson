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
import { NodeToolbarWrapper } from './NodeToolbarWrapper';
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
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragStartPositions, setDragStartPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

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

  // Update edges when layout changes (e.g., when anchors are swapped)
  useEffect(() => {
    setEdges(layoutEdges);
  }, [layoutEdges, setEdges]);

  // Update nodes when layout changes and apply selection state
  useEffect(() => {
    const nodesWithSelection = layoutNodes.map(node => ({
      ...node,
      selected: selectedNodeIds.includes(node.id)
    }));
    setNodes(nodesWithSelection);
  }, [layoutNodes, selectedNodeIds, setNodes]);

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
      const updatedEdges = diagramEdges.filter(e => 
        !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
      );
      
      onDataChange({
        ...data,
        nodes: updatedNodes,
        edges: updatedEdges
      });
      
      setSelectedNodeIds([]);
      setToolbarPosition(null);
    }
  }, [selectedNodeIds, diagramNodes, diagramEdges, data, onDataChange]);
  
  // Close toolbar when clicking outside
  const onPaneClick = useCallback(() => {
    setSelectedNodeIds([]);
    setToolbarPosition(null);
  }, []);

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
          onPaneClick={onPaneClick}
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
          
          {/* Node selection toolbar */}
          {selectedNodeIds.length > 0 && toolbarPosition && (
            <NodeToolbarWrapper
              diagramPosition={toolbarPosition}
              selectedCount={selectedNodeIds.length}
              onEdit={handleEditNode}
              onDelete={handleDeleteNode}
            />
          )}
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