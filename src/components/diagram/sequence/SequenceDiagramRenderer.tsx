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
  onThemeChange?: (theme: string) => void; // Called when theme changes
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
  onThemeChange,
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
  
  // Update local theme state when initialTheme prop changes
  React.useEffect(() => {
    setCurrentTheme(initialTheme);
  }, [initialTheme]);
  
  // Handle theme change and persist to document
  const handleThemeChange = useCallback((newTheme: string) => {
    setCurrentTheme(newTheme);
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  }, [onThemeChange]);
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
  
  // Calculate dynamic lifeline height based on nodes
  const calculateLifelineHeight = useCallback(() => {
    const LIFELINE_HEADER_HEIGHT = 100;
    const BOTTOM_MARGIN = 100; // Space for adding new nodes (about one node height)
    const MIN_HEIGHT = 500;
    
    if (diagramNodes.length === 0) {
      return MIN_HEIGHT;
    }
    
    // Find the maximum Y position considering node heights
    const maxY = diagramNodes.reduce((max, node) => {
      const nodeConfig = getNodeTypeConfig(node.type);
      const nodeHeight = nodeHeights.get(node.id) || nodeConfig?.defaultHeight || 70;
      const nodeY = node.yPosition || 0;
      const nodeBottom = nodeY + (nodeHeight / 2); // yPosition is center, add half height
      return Math.max(max, nodeBottom);
    }, 0);
    
    // Total height = header + max node bottom + bottom margin
    const calculatedHeight = maxY + BOTTOM_MARGIN;
    return Math.max(calculatedHeight, MIN_HEIGHT);
  }, [diagramNodes, nodeHeights]);
  
  const lifelineHeight = useMemo(() => calculateLifelineHeight(), [calculateLifelineHeight]);

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
    console.log('🆕 [handleAddNodeOnLifeline] Called:', {
      sourceLifelineId,
      yPosition,
      currentNodeCount: diagramNodes.length,
      hasOnDataChange: !!onDataChange
    });
    
    if (!onDataChange || lifelines.length === 0) {
      console.warn('⚠️ [handleAddNodeOnLifeline] Aborted - missing onDataChange or no lifelines');
      return;
    }
    
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
    
    // Node can be placed anywhere - lifeline will auto-extend
    const constrainedNodeY = nodeY;
    
    const newNodeBottom = constrainedNodeY + nodeHeight;
    
    const updatedNodes = diagramNodes.map(node => {
      const existingNodeY = node.yPosition || 0;
      // If existing node overlaps with new node position, move it down
      if (existingNodeY >= constrainedNodeY - minSpacing && existingNodeY < newNodeBottom + minSpacing) {
        const newY = newNodeBottom + minSpacing; // Node can extend infinitely
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
    console.log('💾 [handleAddNodeOnLifeline] Calling onDataChange with new node:', {
      newNodeId: nodeId,
      totalNodes: finalNodes.length,
      newNodeLabel: newNode.label
    });
    onDataChange({ ...data, lifelines: updatedLifelines, nodes: finalNodes });
  }, [diagramNodes, lifelines, data, onDataChange]);

  // Calculate layout with validation and recovery
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    // Skip recalculation during active drag operations - use ref for synchronous check
    if (isDraggingRef.current) {
      console.log('⏸️ [Layout] Skipping recalculation during drag');
      return previousLayoutRef.current;
    }
    
    console.log('🔄 [Layout] Recalculating layout:', {
      nodeCount: diagramNodes.length,
      lifelineCount: lifelines.length,
      isDragging
    });
    
    const layout = calculateSequenceLayout({
      lifelines,
      nodes: diagramNodes,
      styles: activeTheme,
      fullStyles: styles,
      nodeHeights
    });
    
    // Extract calculated yPosition values and persist them if they changed
    if (layout.calculatedYPositions && layout.calculatedYPositions.size > 0 && onDataChange && !isDraggingRef.current) {
      const hasChanges = diagramNodes.some(node => {
        const calculatedY = layout.calculatedYPositions?.get(node.id);
        return calculatedY !== undefined && calculatedY !== node.yPosition;
      });
      
      if (hasChanges) {
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
            onAddNode: (lifelineId: string, yPosition: number) => handleAddNodeOnLifeline(lifelineId, yPosition, lifelineHeight),
            readOnly,
            lifelineHeight: lifelineHeight
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
      
      // Update positions with slot-based cascading conflict resolution
      if (onDataChange) {
        const SLOT_HEIGHT = 100; // Each slot is 100 units
        const sequenceNodes = nodes.filter(n => n.type === 'sequenceNode');
        
        // Build lifeline position map for overlap detection
        const lifelinePositions = new Map<string, number>();
        const sortedLifelines = [...data.lifelines].sort((a, b) => a.order - b.order);
        sortedLifelines.forEach((lifeline, index) => {
          lifelinePositions.set(lifeline.id, index);
        });
        
        // Helper to check if two nodes overlap in lifeline range
        const nodesOverlap = (node1: DiagramNode, node2: DiagramNode): boolean => {
          if (!node1.anchors || !node2.anchors) return false;
          
          const n1Start = lifelinePositions.get(node1.anchors[0].lifelineId) || 0;
          const n1End = lifelinePositions.get(node1.anchors[1].lifelineId) || 0;
          const n2Start = lifelinePositions.get(node2.anchors[0].lifelineId) || 0;
          const n2End = lifelinePositions.get(node2.anchors[1].lifelineId) || 0;
          
          const min1 = Math.min(n1Start, n1End);
          const max1 = Math.max(n1Start, n1End);
          const min2 = Math.min(n2Start, n2End);
          const max2 = Math.max(n2Start, n2End);
          
          return !(max1 < min2 || max2 < min1);
        };
        
        // Create slot assignments: convert visual Y positions to slot indices
        const nodeToSlot = new Map<string, number>();
        sequenceNodes.forEach(n => {
          const visualY = n.position.y;
          const slot = Math.round(visualY / SLOT_HEIGHT);
          nodeToSlot.set(n.id, slot);
        });
        
        // Find which node was dragged (the one that moved most from its original yPosition)
        let draggedNodeId: string | null = null;
        let maxDelta = 0;
        diagramNodes.forEach(node => {
          const originalY = node.yPosition || 0;
          const visualY = nodes.find(n => n.id === node.id)?.position.y || 0;
          const delta = Math.abs(visualY - originalY);
          if (delta > maxDelta) {
            maxDelta = delta;
            draggedNodeId = node.id;
          }
        });
        
        // Build slot occupancy: which nodes are at which slots
        const slotOccupants = new Map<number, Set<string>>();
        nodeToSlot.forEach((slot, nodeId) => {
          if (!slotOccupants.has(slot)) {
            slotOccupants.set(slot, new Set());
          }
          slotOccupants.get(slot)!.add(nodeId);
        });
        
        // Cascade conflicts starting from the dragged node's slot
        if (draggedNodeId) {
          const draggedNode = diagramNodes.find(n => n.id === draggedNodeId);
          const draggedSlot = nodeToSlot.get(draggedNodeId)!;
          
          // Process slots from dragged slot downward to cascade conflicts
          const maxSlot = Math.max(...Array.from(nodeToSlot.values()));
          
          for (let currentSlot = draggedSlot; currentSlot <= maxSlot + 10; currentSlot++) {
            const occupants = slotOccupants.get(currentSlot);
            if (!occupants || occupants.size === 0) continue;
            
            // Check for conflicts at this slot
            const occupantsList = Array.from(occupants);
            let hasConflict = false;
            
            for (let i = 0; i < occupantsList.length; i++) {
              for (let j = i + 1; j < occupantsList.length; j++) {
                const node1 = diagramNodes.find(n => n.id === occupantsList[i]);
                const node2 = diagramNodes.find(n => n.id === occupantsList[j]);
                
                if (node1 && node2 && nodesOverlap(node1, node2)) {
                  hasConflict = true;
                  // Push the second node down to next slot
                  const nodeIdToPush = occupantsList[j];
                  occupants.delete(nodeIdToPush);
                  nodeToSlot.set(nodeIdToPush, currentSlot + 1);
                  
                  if (!slotOccupants.has(currentSlot + 1)) {
                    slotOccupants.set(currentSlot + 1, new Set());
                  }
                  slotOccupants.get(currentSlot + 1)!.add(nodeIdToPush);
                  
                  console.log(`🔄 [CONFLICT] Moved node ${nodeIdToPush} from slot ${currentSlot} to ${currentSlot + 1}`);
                  break;
                }
              }
              if (hasConflict) break;
            }
          }
        }
        
        // Convert slots back to Y positions
        const finalPositions = new Map<string, number>();
        nodeToSlot.forEach((slot, nodeId) => {
          finalPositions.set(nodeId, slot * SLOT_HEIGHT);
        });
        
        // Update nodes with final positions
        const updatedNodes = diagramNodes.map(node => ({
          ...node,
          yPosition: finalPositions.get(node.id) || node.yPosition || 0,
          anchors: node.anchors
        }));
        
        console.log('📝 [DROP] Repositioned nodes with cascading slot-based conflict resolution');
        onDataChange({ ...data, nodes: updatedNodes });
        
        // Force state update to trigger layout recalculation
        setIsDragging(false);
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
          
          // Only constrain top boundary - lifeline will auto-extend downward
          const LIFELINE_HEADER_HEIGHT = 100;
          const minY = LIFELINE_HEADER_HEIGHT + 40; // Top constraint
          
          const newY = change.position?.y || node.position.y;
          const constrainedY = Math.max(minY, newY);
          
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
        
        // Only constrain vertical position to be below lifeline headers - lifeline will auto-extend downward
        const LIFELINE_HEADER_HEIGHT = 100;
        const MIN_Y_POSITION = LIFELINE_HEADER_HEIGHT + 20; // 20px padding below header
        const GRID_SIZE = 10; // Snap to 10px grid
        
        // Snap to grid and constrain to minimum position only
        const snappedY = Math.round(moveChange.position.y / GRID_SIZE) * GRID_SIZE;
        const constrainedY = Math.max(MIN_Y_POSITION, snappedY);
        
        // If multi-select, update all selected nodes
        if (selectedNodeIds.includes(moveChange.id) && selectedNodeIds.length > 1) {
          const movedNodeHeight = nodeHeight;
          const originalCenterY = movedDiagramNode?.yPosition || 0;
          const originalTopY = originalCenterY - (movedNodeHeight / 2);
          const deltaY = constrainedY - originalTopY;
          
          // Update all selected nodes with the same delta
          const updatedNodes = diagramNodes.map(n => {
            if (selectedNodeIds.includes(n.id)) {
              const nConfig = getNodeTypeConfig(n.type);
              const nHeight = nodeHeights.get(n.id) || nConfig?.defaultHeight || 70;
              const currentY = n.yPosition || 0;
              const newTopY = n.id === moveChange.id ? constrainedY : (currentY - nHeight / 2) + deltaY;
              const snappedNewTopY = Math.round(newTopY / GRID_SIZE) * GRID_SIZE;
              const constrainedNewTopY = Math.max(MIN_Y_POSITION, snappedNewTopY); // No max constraint
              const centerY = constrainedNewTopY + (nHeight / 2);
              
              // Store CENTER Y as yPosition for consistent sorting
              return {
                ...n,
                yPosition: centerY,
                anchors: n.anchors
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
            currentY += height + verticalSpacing;
            
            // Store CENTER Y as yPosition for consistency with layout calculation
            return {
              ...node,
              yPosition: nodeCenterY,
              anchors: node.anchors
            };
          });
          
          onDataChange({ ...data, nodes: recalculatedNodes });
        } else {
          // Single node update
          // X position is always calculated from anchors/lifelines, so we don't need to store it
          const nodeAnchors = movedDiagramNode?.anchors;
          
          // Update node and its anchors - store CENTER Y as yPosition
          const measuredHeight = nodeHeights.get(moveChange.id) || nodeHeight;
          const nodeCenterY = constrainedY + (measuredHeight / 2);
          const updatedNodes = diagramNodes.map(n => {
            if (n.id === moveChange.id) {
              // Store CENTER Y as yPosition for consistency
              return { 
                ...n, 
                yPosition: nodeCenterY,
                anchors: n.anchors
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
            currentY += height + verticalSpacing;
            
            // Store CENTER Y as yPosition for consistency with layout calculation
            return {
              ...node,
              yPosition: nodeCenterY,
              anchors: node.anchors
            };
          });
          
          // Immediately update node and anchor positions visually
          setNodes(currentNodes => {
            const nodeTopYMap = new Map<string, number>();
            const anchorPositionMap = new Map<string, number>();
            recalculatedNodes.forEach(n => {
              const height = nodeHeights.get(n.id) || 70;
              const centerY = n.yPosition!; // yPosition is now CENTER Y
              const topY = centerY - (height / 2);
              nodeTopYMap.set(n.id, topY);
              n.anchors?.forEach(a => anchorPositionMap.set(a.id, centerY));
            });
            
            return currentNodes.map(n => {
              const anchorData = n.data as any;
              if (n.type === 'sequenceNode' && nodeTopYMap.has(n.id)) {
                return { ...n, position: { ...n.position, y: nodeTopYMap.get(n.id)! } };
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
          onThemeChange={handleThemeChange}
        />
      )}

      <div className="flex-1 relative">
        <ReactFlow
          key="sequence-diagram"
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
            currentWorkspaceId={workspaceId}
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