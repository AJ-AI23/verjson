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
import { SequenceDiagramData, DiagramNode, DiagramEdge, DiagramNodeType, Lifeline, AnchorNode as AnchorNodeType } from '@/types/diagram';
import { DiagramStyles, defaultLightTheme } from '@/types/diagramStyles';
import { calculateSequenceLayout } from '@/lib/diagram/sequenceLayout';
import { getNodeTypeConfig } from '@/lib/diagram/sequenceNodeTypes';
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
import { useEditorSettings } from '@/contexts/EditorSettingsContext';
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
  theme: initialTheme = 'light',
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
  const { settings } = useEditorSettings();
  
  const [currentTheme, setCurrentTheme] = useState(initialTheme);
  const [selectedNode, setSelectedNode] = useState<DiagramNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<DiagramEdge | null>(null);
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [isEdgeEditorOpen, setIsEdgeEditorOpen] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragStartPositions, setDragStartPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [nodeHeights, setNodeHeights] = useState<Map<string, number>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const previousLayoutRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const [mousePosition, setMousePosition] = useState<{ viewport: { x: number; y: number }; flow: { x: number; y: number } } | null>(null);

  const activeTheme = styles?.themes?.[currentTheme] || styles?.themes?.light || defaultLightTheme;

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

// Helper component to track mouse position in both viewport and flow coordinates
const MousePositionTracker: React.FC<{
  onMouseMove: (pos: { viewport: { x: number; y: number }; flow: { x: number; y: number } }) => void;
  onMouseLeave: () => void;
}> = ({ onMouseMove, onMouseLeave }) => {
  const { screenToFlowPosition } = useReactFlow();
  
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const container = document.querySelector('.react-flow');
      if (container) {
        const bounds = container.getBoundingClientRect();
        const viewportPos = {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top
        };
        const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        onMouseMove({ viewport: viewportPos, flow: flowPos });
      }
    };
    
    const container = document.querySelector('.react-flow');
    if (container) {
      container.addEventListener('mousemove', handleMouseMove as any);
      container.addEventListener('mouseleave', onMouseLeave);
    }
    
    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove as any);
        container.removeEventListener('mouseleave', onMouseLeave);
      }
    };
  }, [screenToFlowPosition, onMouseMove, onMouseLeave]);
  
  return null;
};

  // Add node on lifeline callback
  const handleAddNodeOnLifeline = useCallback((sourceLifelineId: string, yPosition: number, lifelineHeight: number) => {
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
    const anchorHeight = 16;
    const minSpacing = 50;
    const LIFELINE_HEADER_HEIGHT = 100;
    
    // Position node starting at click position + half node height + half anchor height offset
    const nodeY = yPosition + (nodeHeight / 2) + (anchorHeight / 2);
    
    // Enforce bottom limit - node bottom should not exceed lifeline height
    const maxNodeY = LIFELINE_HEADER_HEIGHT + lifelineHeight - nodeHeight;
    const constrainedNodeY = Math.min(nodeY, maxNodeY);
    
    const newNodeBottom = constrainedNodeY + nodeHeight;
    
    const updatedNodes = diagramNodes.map(node => {
      const existingNodeY = node.yPosition || 0;
      // If existing node overlaps with new node position, move it down
      if (existingNodeY >= constrainedNodeY - minSpacing && existingNodeY < newNodeBottom + minSpacing) {
        const newY = Math.min(newNodeBottom + minSpacing, maxNodeY);
        return {
          ...node,
          yPosition: newY,
          anchors: node.anchors // Anchors don't need yPosition - calculated from node position
        };
      }
      return node;
    });
    
    // Create new node
    const newNode: DiagramNode = {
      id: nodeId,
      type: 'endpoint',
      label: 'New Endpoint',
      anchors: [
        { id: sourceAnchorId, lifelineId: sourceLifelineId, anchorType: 'source' },
        { id: targetAnchorId, lifelineId: targetLifelineId, anchorType: 'target' }
      ],
      yPosition: constrainedNodeY
    };
    
    const finalNodes = [...updatedNodes, newNode];
    onDataChange({ ...data, lifelines: updatedLifelines, nodes: finalNodes });
  }, [diagramNodes, lifelines, data, onDataChange]);

  // Calculate layout with validation and recovery
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    // Skip recalculation during active drag operations - use ref for synchronous check
    if (isDraggingRef.current) {
      console.log('🚫 [SequenceDiagramRenderer] BLOCKED layout recalculation during active drag');
      return previousLayoutRef.current;
    }
    
    console.log('✅ [SequenceDiagramRenderer] Calculating layout...', { 
      diagramNodesCount: diagramNodes.length,
      lifelinesCount: lifelines.length,
      isDragging: isDraggingRef.current
    });
    
    const layout = calculateSequenceLayout({
      lifelines,
      nodes: diagramNodes,
      styles: activeTheme,
      nodeHeights
    });
    
    // Extract calculated yPosition values and persist them if they changed
    console.log('🔍 [SequenceDiagramRenderer] Persistence check:', {
      hasCalculatedYPositions: !!layout.calculatedYPositions,
      calculatedYPositionsSize: layout.calculatedYPositions?.size,
      hasOnDataChange: !!onDataChange,
      isDragging: isDraggingRef.current,
      diagramNodesCount: diagramNodes.length
    });
    
    if (layout.calculatedYPositions && layout.calculatedYPositions.size > 0 && onDataChange && !isDraggingRef.current) {
      const hasChanges = diagramNodes.some(node => {
        const calculatedY = layout.calculatedYPositions?.get(node.id);
        return calculatedY !== undefined && calculatedY !== node.yPosition;
      });
      
      console.log('🔍 [SequenceDiagramRenderer] hasChanges check:', {
        hasChanges,
        firstThreeNodes: diagramNodes.slice(0, 3).map(node => ({
          id: node.id,
          currentYPosition: node.yPosition,
          calculatedYPosition: layout.calculatedYPositions?.get(node.id)
        }))
      });
      
      if (hasChanges) {
        console.log('💾 [SequenceDiagramRenderer] Persisting calculated yPosition values');
        const updatedNodes = diagramNodes.map(node => {
          const calculatedY = layout.calculatedYPositions?.get(node.id);
          if (calculatedY !== undefined) {
            return { ...node, yPosition: calculatedY };
          }
          return node;
        });
        
        setTimeout(() => {
          onDataChange({ ...data, nodes: updatedNodes });
        }, 100);
      }
    }
    
    // Validate edge creation and attempt recovery if needed
    if (layout.edges.length === 0 && diagramNodes.length > 0) {
      console.error('❌ [SequenceDiagramRenderer] No edges created! Attempting recovery...');
      
      // Check if nodes have anchors
      const nodesWithoutAnchors = diagramNodes.filter(n => !n.anchors || n.anchors.length !== 2);
      if (nodesWithoutAnchors.length > 0) {
        console.error('❌ [SequenceDiagramRenderer] Found nodes without proper anchors:', 
          nodesWithoutAnchors.map(n => ({ id: n.id, label: n.label }))
        );
        
        // Attempt to regenerate anchors for nodes that are missing them
        if (onDataChange && lifelines.length > 0) {
          console.warn('⚠️ [SequenceDiagramRenderer] Attempting to auto-repair missing anchors...');
          
          const repairedNodes = diagramNodes.map(node => {
            if (!node.anchors || node.anchors.length !== 2) {
              // Auto-generate anchors between first two lifelines
              const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
              const sourceLifeline = sortedLifelines[0];
              const targetLifeline = sortedLifelines[Math.min(1, sortedLifelines.length - 1)];
              
              const nodeConfig = getNodeTypeConfig(node.type);
              const nodeHeight = nodeConfig?.defaultHeight || 70;
              const nodeY = node.yPosition || 100;
              const nodeCenterY = nodeY + (nodeHeight / 2);
              
              const newAnchors: [AnchorNodeType, AnchorNodeType] = [
                { 
                  id: `anchor-${node.id}-source`, 
                  lifelineId: sourceLifeline.id,
                  anchorType: 'source'
                },
                { 
                  id: `anchor-${node.id}-target`, 
                  lifelineId: targetLifeline.id,
                  anchorType: 'target'
                }
              ];
              
              return {
                ...node,
                anchors: newAnchors
              };
            }
            return node;
          });
          
          // Update document with repaired nodes
          setTimeout(() => {
            console.log('✅ [SequenceDiagramRenderer] Updating document with repaired anchors');
            onDataChange({ ...data, nodes: repairedNodes });
          }, 0);
        }
      }
    } else {
      console.log('✅ [SequenceDiagramRenderer] Layout calculated successfully:', {
        nodesCount: layout.nodes.length,
        edgesCount: layout.edges.length
      });
    }
    
    // Store layout for use during drag
    previousLayoutRef.current = layout;
    return layout;
  }, [lifelines, diagramNodes, activeTheme, isRenderMode, nodeHeights, onDataChange, data, isDragging]);

  // Handle node height changes
  const handleNodeHeightChange = useCallback((nodeId: string, height: number) => {
    setNodeHeights(prev => {
      const newHeights = new Map(prev);
      newHeights.set(nodeId, height);
      return newHeights;
    });
  }, []);

  // Attach handlers to nodes
  const nodesWithHandlers = useMemo(() => {
    // Extract custom lifeline colors from styles
    const customLifelineColors: Record<string, string> = {};
    if (styles?.customNodeStyles) {
      Object.entries(styles.customNodeStyles).forEach(([key, value]) => {
        if (key.startsWith('lifeline-') && value.backgroundColor) {
          customLifelineColors[key] = value.backgroundColor;
        }
      });
    }

    return layoutNodes.map(node => {
      if (node.type === 'columnLifeline') {
        return {
          ...node,
          data: {
            ...node.data,
            customLifelineColors,
            onAddNode: (lifelineId: string, yPosition: number) => handleAddNodeOnLifeline(lifelineId, yPosition, settings.sequenceDiagramHeight),
            readOnly,
            lifelineHeight: settings.sequenceDiagramHeight
          }
        };
      }
      if (node.type === 'sequenceNode') {
        return {
          ...node,
          data: {
            ...node.data,
            onHeightChange: handleNodeHeightChange,
            calculatedHeight: nodeHeights.get(node.id)
          }
        };
      }
      return node;
    });
  }, [layoutNodes, handleAddNodeOnLifeline, handleNodeHeightChange, readOnly, styles?.customNodeStyles]);

  const [nodes, setNodes, handleNodesChange] = useNodesState(nodesWithHandlers);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(layoutEdges);

  // Update nodes when layout changes and apply handlers
  useEffect(() => {
    setNodes(nodesWithHandlers);
  }, [nodesWithHandlers, setNodes]);

  // Update edges when layout changes
  useEffect(() => {
    console.log('[SequenceDiagramRenderer] Updating edges from layout:', {
      edgeCount: layoutEdges.length,
      edgeIds: layoutEdges.map(e => e.id)
    });
    setEdges(layoutEdges);
  }, [layoutEdges, setEdges]);

  // Update anchor positions when node heights change
  useEffect(() => {
    if (nodeHeights.size === 0) return;

    setNodes(currentNodes =>
      currentNodes.map(n => {
        if (n.type === 'anchorNode') {
          const anchorData = n.data as any;
          const connectedNodeId = anchorData?.connectedNodeId;
          if (!connectedNodeId) return n;

          const actualHeight = nodeHeights.get(connectedNodeId);
          if (!actualHeight) return n;

          // Find the connected node's Y position
          const connectedNode = currentNodes.find(node => node.id === connectedNodeId);
          if (!connectedNode) return n;

          // Position anchor at the vertical center of the actual rendered node
          const anchorY = connectedNode.position.y + (actualHeight / 2) - 8;

          return {
            ...n,
            position: { x: n.position.x, y: anchorY }
          };
        }
        return n;
      })
    );
  }, [nodeHeights, setNodes]);

  const onNodesChangeHandler = useCallback((changes: any) => {
    // Store initial positions when drag starts
    const dragStartChange = changes.find((c: any) => c.type === 'position' && c.dragging === true);
    if (dragStartChange) {
      console.log('🟢 [DRAG START] Setting isDraggingRef.current = true');
      isDraggingRef.current = true;
      setIsDragging(true);
      
      const startPositions = new Map<string, { x: number; y: number }>();
      nodes.forEach(n => {
        if (selectedNodeIds.includes(n.id) && n.type === 'sequenceNode') {
          startPositions.set(n.id, { x: n.position.x, y: n.position.y });
        }
      });
      setDragStartPositions(startPositions);
    }
    
    // Detect drag end
    const dragEndChange = changes.find((c: any) => c.type === 'position' && c.dragging === false && c.position);
    if (dragEndChange && dragEndChange.type === 'position') {
      console.log('🔴 [DRAG END] Setting isDraggingRef.current = false');
      isDraggingRef.current = false;
      setIsDragging(false);
      
      // Simply sort all nodes by their current visual Y position and reorder data
      if (onDataChange) {
        const sortedVisualNodes = nodes
          .filter(n => n.type === 'sequenceNode')
          .sort((a, b) => a.position.y - b.position.y);
        
        // Reorder diagram nodes to match visual order
        const reorderedNodes = sortedVisualNodes
          .map(visualNode => diagramNodes.find(n => n.id === visualNode.id))
          .filter(Boolean) as DiagramNode[];
        
        // Recalculate positions with cumulative spacing based on node heights
        const verticalSpacing = 20;
        let currentY = 150; // Starting Y position
        
        const updatedNodes = reorderedNodes.map((node) => {
          const actualHeight = nodeHeights.get(node.id);
          const nodeConfig = getNodeTypeConfig(node.type);
          const height = actualHeight || nodeConfig?.defaultHeight || 70;
          
          const nodeY = currentY;
          const centerY = nodeY + (height / 2);
          
          // Update currentY for next node
          currentY += height + verticalSpacing;
          
          return {
            ...node,
            yPosition: nodeY,
            anchors: node.anchors // Anchors don't need yPosition - calculated from node
          };
        });
        
        console.log('📝 [DROP] Reordered nodes based on visual position');
        onDataChange({ ...data, nodes: updatedNodes });
      }
    }
    
    // Constrain sequence node movement to vertical only during drag
    const constrainedChanges = changes.map((change: any) => {
      if (change.type === 'position' && change.dragging) {
        const node = nodes.find(n => n.id === change.id);
        if (node?.type === 'sequenceNode') {
          // Multi-node drag disabled - only single node swapping is supported
          
          // Get node height to calculate constraints
          const actualHeight = nodeHeights.get(node.id);
          const diagramNode = diagramNodes.find(n => n.id === node.id);
          const nodeConfig = diagramNode ? getNodeTypeConfig(diagramNode.type) : null;
          const nodeHeight = actualHeight || nodeConfig?.defaultHeight || 70;
          
          // Constrain Y position to keep node within lifeline bounds
          const LIFELINE_HEADER_HEIGHT = 100;
          const minY = LIFELINE_HEADER_HEIGHT + 40; // Top constraint
          const maxY = LIFELINE_HEADER_HEIGHT + settings.sequenceDiagramHeight - nodeHeight; // Bottom constraint
          
          const newY = change.position?.y || node.position.y;
          const constrainedY = Math.max(minY, Math.min(newY, maxY));
          
          // Keep original X position, only allow Y to change within constraints
          return {
            ...change,
            position: {
              x: node.position.x,
              y: constrainedY
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
        // Use actual measured height, fall back to default if not yet measured
        const actualHeight = nodeHeights.get(dragChange.id);
        const diagramNode = diagramNodes.find(n => n.id === dragChange.id);
        const nodeConfig = diagramNode ? getNodeTypeConfig(diagramNode.type) : null;
        const nodeHeight = actualHeight || nodeConfig?.defaultHeight || 70;
        const newY = dragChange.position.y;
        const nodeCenterY = newY + (nodeHeight / 2);
        
        // Update anchor positions for the dragged node during drag
        if (!(selectedNodeIds.includes(dragChange.id) && selectedNodeIds.length > 1)) {
          setNodes(currentNodes =>
            currentNodes.map(n => {
              const anchorData = n.data as any;
              if (n.type === 'anchorNode' && anchorData?.connectedNodeId === dragChange.id) {
                return { ...n, position: { x: n.position.x, y: nodeCenterY - 8 } };
              }
              return n;
            })
          );
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
            const currentNodeY = n.yPosition || 100;
            
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
                lifelineId: otherOriginalLifeline,
                anchorType: otherOriginalType
              };
              updatedAnchors[otherAnchorIndex] = {
                ...otherAnchor,
                lifelineId: draggedOriginalLifeline,
                anchorType: draggedOriginalType
              };
            } else {
              // Update the dragged anchor to new lifeline
              updatedAnchors[anchorIndex] = {
                ...draggedAnchor,
                lifelineId: closestLifelineId
              };
              
              // Other anchor stays the same
              updatedAnchors[otherAnchorIndex] = {
                ...otherAnchor
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
                yPosition: currentNodeY
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
          const currentNodeY = connectedNode.yPosition || 100;
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
            // No need to update the diagram node position since it's calculated from lifelines
            // The node's Y position is stored in connectedNode.yPosition
            return n;
          });
        });
        
        onDataChange({ ...data, nodes: updatedDiagramNodes });
      } else {
        // Regular node position update - also update connected anchors
        const movedDiagramNode = diagramNodes.find(n => n.id === moveChange.id);
        const nodeConfig = movedDiagramNode ? getNodeTypeConfig(movedDiagramNode.type) : null;
        const nodeHeight = nodeConfig?.defaultHeight || 70;
        
        // Constrain vertical position to be below lifeline headers and above lifeline bottom
        const LIFELINE_HEADER_HEIGHT = 100;
        const MIN_Y_POSITION = LIFELINE_HEADER_HEIGHT + 20; // 20px padding below header
        const MAX_Y_POSITION = LIFELINE_HEADER_HEIGHT + settings.sequenceDiagramHeight - nodeHeight; // Bottom constraint
        const GRID_SIZE = 10; // Snap to 10px grid
        
        // Snap to grid and constrain to minimum and maximum position
        const snappedY = Math.round(moveChange.position.y / GRID_SIZE) * GRID_SIZE;
        const constrainedY = Math.max(MIN_Y_POSITION, Math.min(snappedY, MAX_Y_POSITION));
        
        // If multi-select, update all selected nodes
        if (selectedNodeIds.includes(moveChange.id) && selectedNodeIds.length > 1) {
          const originalY = movedDiagramNode?.yPosition || 0;
          const deltaY = constrainedY - originalY;
          
          const MAX_Y_POSITION_FOR_MULTI = LIFELINE_HEADER_HEIGHT + settings.sequenceDiagramHeight;
          
          // Update all selected nodes with the same delta
          const updatedNodes = diagramNodes.map(n => {
            if (selectedNodeIds.includes(n.id)) {
              const nConfig = getNodeTypeConfig(n.type);
              const nHeight = nConfig?.defaultHeight || 70;
              const currentY = n.yPosition || 0;
              const newY = n.id === moveChange.id ? constrainedY : currentY + deltaY;
              const snappedNewY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
              const maxYForNode = MAX_Y_POSITION_FOR_MULTI - nHeight;
              const constrainedNewY = Math.max(MIN_Y_POSITION, Math.min(snappedNewY, maxYForNode));
              const centerY = constrainedNewY + (nHeight / 2);
              
              // Anchors don't need explicit yPosition - calculated from node position
              
              return {
                ...n,
                yPosition: constrainedNewY,
                anchors: n.anchors // Keep anchors as is
              };
            }
            return n;
          });
          
          // Reorder nodes by Y position to maintain correct array order
          const sortedUpdatedNodes = [...updatedNodes].sort((a, b) => 
            (a.yPosition || 0) - (b.yPosition || 0)
          );
          
          // Recalculate positions with proper vertical spacing
          const verticalSpacing = 20;
          let currentY = LIFELINE_HEADER_HEIGHT + 40;
          
          const recalculatedNodes = sortedUpdatedNodes.map(node => {
            const nodeConfig = getNodeTypeConfig(node.type);
            const measuredHeight = nodeHeights.get(node.id);
            const height = measuredHeight || nodeConfig?.defaultHeight || 70;
            
            const nodeCenterY = currentY + (height / 2);
            
            // Anchors don't need explicit yPosition - calculated from node position
            
            currentY += height + verticalSpacing;
            
            return {
              ...node,
              yPosition: currentY - height - verticalSpacing, // Use the position we calculated
              anchors: node.anchors // Keep anchors as is
            };
          });
          
          onDataChange({ ...data, nodes: recalculatedNodes });
        } else {
          // Single node update
          // X position is always calculated from anchors/lifelines, so we don't need to store it
          const nodeAnchors = movedDiagramNode?.anchors;
          
          // Update node and its anchors
          const nodeCenterY = constrainedY + (nodeHeight / 2);
          const updatedNodes = diagramNodes.map(n => {
            if (n.id === moveChange.id) {
              // Update node position - anchors don't need yPosition
              return { 
                ...n, 
                yPosition: constrainedY,
                anchors: n.anchors // Keep anchors as is
              };
            }
            return n;
          });
          
          // Reorder nodes by Y position to maintain correct array order
          const sortedUpdatedNodes = [...updatedNodes].sort((a, b) => 
            (a.yPosition || 0) - (b.yPosition || 0)
          );
          
          // Recalculate positions with proper vertical spacing
          const verticalSpacing = 20;
          let currentY = LIFELINE_HEADER_HEIGHT + 40;
          
          const recalculatedNodes = sortedUpdatedNodes.map(node => {
            const nodeConfig = getNodeTypeConfig(node.type);
            const measuredHeight = nodeHeights.get(node.id);
            const height = measuredHeight || nodeConfig?.defaultHeight || 70;
            
            const nodeCenterY = currentY + (height / 2);
            
            // Anchors don't need explicit yPosition - calculated from node position
            
            const nodeY = currentY;
            currentY += height + verticalSpacing;
            
            return {
              ...node,
              yPosition: nodeY,
              anchors: node.anchors // Keep anchors as is
            };
          });
          
          // Immediately update node and anchor positions visually
          setNodes(currentNodes => {
            const nodePositionMap = new Map(recalculatedNodes.map(n => [n.id, n.yPosition!]));
            const anchorPositionMap = new Map<string, number>();
            recalculatedNodes.forEach(n => {
              const centerY = n.yPosition! + ((nodeHeights.get(n.id) || 70) / 2);
              n.anchors?.forEach(a => anchorPositionMap.set(a.id, centerY));
            });
            
            return currentNodes.map(n => {
              const anchorData = n.data as any;
              if (n.type === 'sequenceNode' && nodePositionMap.has(n.id)) {
                return { ...n, position: { ...n.position, y: nodePositionMap.get(n.id)! } };
              }
              if (n.type === 'anchorNode' && anchorData?.connectedNodeId && anchorPositionMap.has(n.id)) {
                return { ...n, position: { ...n.position, y: anchorPositionMap.get(n.id)! - 8 } };
              }
              return n;
            });
          });
          
          onDataChange({ ...data, nodes: recalculatedNodes });
        }
      }
    }
  }, [handleNodesChange, onNodesChange, nodes, diagramNodes, data, onDataChange, lifelines, setNodes, selectedNodeIds, dragStartPositions, settings, nodeHeights]);

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
    
    // Also update the selectedNode state so the editor shows current values
    const updatedNode = updatedNodes.find(n => n.id === nodeId);
    if (updatedNode) {
      setSelectedNode(updatedNode);
    }
    
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
          diagramType="sequence"
          styles={styles}
          onStylesChange={onStylesChange}
          currentTheme={currentTheme}
          onThemeChange={setCurrentTheme}
        />
      )}

      <div className="flex-1 relative">
        <ReactFlow
          key={`sequence-diagram-${settings.sequenceDiagramHeight}`}
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
          
          {/* Mouse position tracker */}
          <MousePositionTracker 
            onMouseMove={setMousePosition}
            onMouseLeave={() => setMousePosition(null)}
          />
          
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
          
          {/* Mouse position tooltip for debugging */}
          {mousePosition && (
            <div 
              className="absolute pointer-events-none bg-background/90 border border-border px-2 py-1 rounded text-xs"
              style={{
                left: mousePosition.viewport.x + 15,
                top: mousePosition.viewport.y + 15,
                zIndex: 1000
              }}
            >
              x: {mousePosition.flow.x.toFixed(0)}, y: {mousePosition.flow.y.toFixed(0)}
            </div>
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
              nodes={diagramNodes}
              lifelines={lifelines}
            />
          )}
        </>
      )}
    </div>
  );
};