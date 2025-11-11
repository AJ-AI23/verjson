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
import { ProcessNode } from './ProcessNode';
import { AnchorTooltip } from './AnchorTooltip';
import { NodeEditor } from './NodeEditor';
import { EdgeEditor } from './EdgeEditor';
import { NodeToolbarWrapper } from './NodeToolbarWrapper';
import { DiagramStylesDialog } from './DiagramStylesDialog';
import { OpenApiImportDialog } from './OpenApiImportDialog';
import { DiagramHeader } from '../DiagramHeader';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';
import { useProcessManagement } from '@/hooks/useProcessManagement';
import { ProcessEditor } from './ProcessEditor';
import { LifelineEditor } from './LifelineEditor';
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
  processNode: ProcessNode
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
  
  // Process selection state
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [isProcessEditorOpen, setIsProcessEditorOpen] = useState(false);
  const [processToolbarPosition, setProcessToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Lifeline selection state
  const [selectedLifelineId, setSelectedLifelineId] = useState<string | null>(null);
  const [isLifelineEditorOpen, setIsLifelineEditorOpen] = useState(false);
  const [lifelineToolbarPosition, setLifelineToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  
  const [dragStartPositions, setDragStartPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [nodeHeights, setNodeHeights] = useState<Map<string, number>>(new Map());
  const nodeHeightsRef = useRef<Map<string, number>>(new Map());
  
  // Update ref when nodeHeights changes
  useEffect(() => {
    nodeHeightsRef.current = nodeHeights;
  }, [nodeHeights]);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const previousLayoutRef = useRef<{ nodes: Node[]; edges: Edge[]; calculatedYPositions?: Map<string, number> }>({ nodes: [], edges: [] });
  const [mousePosition, setMousePosition] = useState<{ viewport: { x: number; y: number }; flow: { x: number; y: number } } | null>(null);

  // Process management state
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [anchorTooltipPosition, setAnchorTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [processCreationMode, setProcessCreationMode] = useState<'none' | 'selecting-process'>('none');

  const processManagement = useProcessManagement({
    processes: data.processes || [],
    nodes: diagramNodes,
    onProcessesChange: (processes) => {
      if (onDataChange) {
        onDataChange({ ...data, processes });
      }
    }
  });

  // Keyboard shortcuts for process creation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedAnchorId || processCreationMode === 'selecting-process') {
          setSelectedAnchorId(null);
          setAnchorTooltipPosition(null);
          setProcessCreationMode('none');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnchorId, processCreationMode]);

  const activeTheme = useMemo(
    () => styles?.themes?.[currentTheme] || styles?.themes?.light || defaultLightTheme,
    [styles?.themes, currentTheme]
  );
  
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
      const nodeHeight = nodeHeightsRef.current.get(node.id) || nodeConfig?.defaultHeight || 70;
      const nodeY = node.yPosition || 0;
      const nodeBottom = nodeY + (nodeHeight / 2); // yPosition is center, add half height
      return Math.max(max, nodeBottom);
    }, 0);
    
    // Total height = header + max node bottom + bottom margin
    const calculatedHeight = maxY + BOTTOM_MARGIN;
    return Math.max(calculatedHeight, MIN_HEIGHT);
  }, [diagramNodes]);
  
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
  const { nodes: layoutNodes, edges: layoutEdges, calculatedYPositions } = useMemo(() => {
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
      processes: data.processes || [],
      styles: activeTheme,
      fullStyles: styles,
      nodeHeights: nodeHeightsRef.current
    });
    
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
  }, [lifelines, diagramNodes, activeTheme, isRenderMode, onDataChange, data, isDragging]);

  // Sync calculated positions back to document when they change
  useEffect(() => {
    if (!calculatedYPositions || !onDataChange || isDraggingRef.current) return;
    
    // Check if any positions have changed
    let hasChanges = false;
    const updatedNodes = diagramNodes.map(node => {
      const calculatedY = calculatedYPositions.get(node.id);
      if (calculatedY !== undefined && calculatedY !== node.yPosition) {
        hasChanges = true;
        return { ...node, yPosition: calculatedY };
      }
      return node;
    });
    
    // Only update if there are actual changes
    if (hasChanges) {
      console.log('📝 [Position Sync] Syncing calculated positions back to document:', {
        changedNodes: updatedNodes.filter((node, i) => node.yPosition !== diagramNodes[i].yPosition)
          .map(n => ({ id: n.id, oldY: diagramNodes.find(dn => dn.id === n.id)?.yPosition, newY: n.yPosition }))
      });
      onDataChange({ ...data, nodes: updatedNodes });
    }
  }, [calculatedYPositions, onDataChange, diagramNodes, data, isDragging]);

  // Handle node height changes
  const handleNodeHeightChange = useCallback((nodeId: string, height: number) => {
    setNodeHeights(prev => {
      const newHeights = new Map(prev);
      newHeights.set(nodeId, height);
      return newHeights;
    });
  }, []);
  
  // Process selection and editing handlers
  const handleProcessSelect = useCallback((processId: string) => {
    if (readOnly) return;
    
    const process = (data.processes || []).find(p => p.id === processId);
    if (!process) return;
    
    setSelectedProcessId(processId);
    
    // We'll set the toolbar position in the node click handler
    // since we need the actual rendered position
  }, [readOnly, data.processes]);
  
  // Lifeline selection and editing handlers
  const handleLifelineSelect = useCallback((lifelineId: string) => {
    if (readOnly) return;
    
    const lifeline = lifelines.find(l => l.id === lifelineId);
    if (!lifeline) return;
    
    setSelectedLifelineId(lifelineId);
  }, [readOnly, lifelines]);

  // Memoize custom lifeline colors extraction
  const customLifelineColors = useMemo(() => {
    const colors: Record<string, string> = {};
    if (styles?.customNodeStyles) {
      Object.entries(styles.customNodeStyles).forEach(([key, value]) => {
        if (key.startsWith('lifeline-') && value.backgroundColor) {
          colors[key] = value.backgroundColor;
        }
      });
    }
    return colors;
  }, [styles?.customNodeStyles]);

  // Attach handlers to nodes
  const nodesWithHandlers = useMemo(() => {
    return layoutNodes.map(node => {
      if (node.type === 'columnLifeline') {
        const lifelineData = node.data as any;
        const isSelected = lifelineData?.column?.id === selectedLifelineId;
        const lifeline = lifelines.find(l => l.id === lifelineData?.column?.id);
        // Create dataVersion from lifeline properties to force re-render on changes
        const dataVersion = lifeline ? `${lifeline.name}-${lifeline.description}-${lifeline.color}-${lifeline.anchorColor}` : '';
        return {
          ...node,
          selectable: true,
          selected: isSelected,
          data: {
            ...node.data,
            customLifelineColors,
            onAddNode: (lifelineId: string, yPosition: number) => handleAddNodeOnLifeline(lifelineId, yPosition, lifelineHeight),
            readOnly,
            lifelineHeight: lifelineHeight,
            dataVersion
          }
        };
      }
      
      if (node.type === 'sequenceNode') {
        return {
          ...node,
          draggable: !readOnly,
          data: {
            ...node.data,
            onHeightChange: handleNodeHeightChange,
            calculatedHeight: nodeHeightsRef.current.get(node.id)
          }
        };
      }
      
      // Make anchor nodes selectable and pass isInProcess status
      if (node.type === 'anchorNode') {
        const anchorId = node.id;
        const isInProcess = processManagement.isAnchorInProcess(anchorId);
        
        return {
          ...node,
          selectable: !readOnly,
          selected: node.id === selectedAnchorId,
          data: {
            ...node.data,
            isInProcess
          }
        };
      }
      
      // Process nodes - make selectable with click handler
      if (node.type === 'processNode') {
        const processNode = node.data as any;
        const isHighlighted = processCreationMode === 'selecting-process';
        const isSelected = processNode?.processNode?.id === selectedProcessId;
        return {
          ...node,
          selectable: true,
          selected: isSelected,
          style: {
            ...node.style,
            opacity: isHighlighted ? 1 : undefined,
            cursor: 'pointer'
          },
          data: {
            ...node.data,
            theme: activeTheme
          }
        } as Node;
      }
      
      return node;
    });
  }, [layoutNodes, handleAddNodeOnLifeline, handleNodeHeightChange, readOnly, customLifelineColors, lifelineHeight, selectedAnchorId, processManagement, processCreationMode, activeTheme, selectedProcessId, handleProcessSelect, selectedLifelineId, lifelines]);

  const [nodes, setNodes, handleNodesChange] = useNodesState(nodesWithHandlers);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(layoutEdges);
  
  // Track previous values to prevent unnecessary updates
  const prevNodesRef = useRef<Node[]>([]);
  const prevEdgesRef = useRef<Edge[]>([]);

  // Update nodes when layout changes and apply handlers - with deduplication
  useEffect(() => {
    // Skip if nodes haven't actually changed (deep comparison of IDs, positions, and data)
    const nodesChanged = nodesWithHandlers.length !== prevNodesRef.current.length ||
      nodesWithHandlers.some((node, i) => {
        const prev = prevNodesRef.current[i];
        if (!prev) return true;
        
        // Check basic properties
        if (node.id !== prev.id || 
            node.type !== prev.type ||
            node.position.x !== prev.position.x ||
            node.position.y !== prev.position.y) {
          return true;
        }
        
        // Check data changes (especially for process and lifeline nodes)
        if (node.type === 'processNode' || node.type === 'columnLifeline') {
          const nodeData = node.data as any;
          const prevData = prev.data as any;
          // Compare dataVersion which changes when process/lifeline properties change
          if (nodeData?.dataVersion !== prevData?.dataVersion) {
            return true;
          }
        }
        
        return false;
      });
    
    if (nodesChanged) {
      prevNodesRef.current = nodesWithHandlers;
      setNodes(nodesWithHandlers);
    }
  }, [nodesWithHandlers, setNodes]);

  // Update edges when layout changes - with deduplication
  useEffect(() => {
    const edgesChanged = layoutEdges.length !== prevEdgesRef.current.length ||
      layoutEdges.some((edge, i) => {
        const prev = prevEdgesRef.current[i];
        return !prev || edge.id !== prev.id || edge.source !== prev.source || edge.target !== prev.target;
      });
    
    if (edgesChanged) {
      prevEdgesRef.current = layoutEdges;
      setEdges(layoutEdges);
    }
  }, [layoutEdges, setEdges]);

  const onNodesChangeHandler = useCallback((changes: any) => {
    // Log all position changes for debugging
    const positionChanges = changes.filter((c: any) => c.type === 'position');
    if (positionChanges.length > 0) {
      console.log('📍 [POSITION CHANGES]:', positionChanges.map((c: any) => ({
        id: c.id,
        dragging: c.dragging,
        hasPosition: !!c.position,
        position: c.position
      })));
    }
    
    // Store initial positions when drag starts
    const dragStartChange = changes.find((c: any) => c.type === 'position' && c.dragging === true);
    if (dragStartChange) {
      console.log('🟢 [DRAG START]', dragStartChange.id);
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
        // IMPORTANT: visual Y is top of node, but we need to convert to center Y for document
        const nodeToSlot = new Map<string, number>();
        sequenceNodes.forEach(n => {
          const diagramNode = diagramNodes.find(dn => dn.id === n.id);
          const nodeConfig = diagramNode ? getNodeTypeConfig(diagramNode.type) : null;
          const nodeHeight = nodeHeights.get(n.id) || nodeConfig?.defaultHeight || 70;
          
          const visualTopY = n.position.y;
          const centerY = visualTopY + (nodeHeight / 2); // Convert top Y to center Y
          const slot = Math.round(centerY / SLOT_HEIGHT);
          nodeToSlot.set(n.id, slot);
        });
        
        // Find which node was dragged (the one that moved most from its original yPosition)
        let draggedNodeId: string | null = null;
        let maxDelta = 0;
        diagramNodes.forEach(node => {
          const originalCenterY = node.yPosition || 0;
          const flowNode = nodes.find(n => n.id === node.id);
          if (flowNode) {
            const nodeConfig = getNodeTypeConfig(node.type);
            const nodeHeight = nodeHeights.get(node.id) || nodeConfig?.defaultHeight || 70;
            const visualTopY = flowNode.position.y;
            const currentCenterY = visualTopY + (nodeHeight / 2);
            const delta = Math.abs(currentCenterY - originalCenterY);
            if (delta > maxDelta) {
              maxDelta = delta;
              draggedNodeId = node.id;
            }
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
    
    // Handle anchor node clicks for process creation
    if (node.type === 'anchorNode') {
      const anchorId = node.id;
      const isInProcess = processManagement.isAnchorInProcess(anchorId);
      
      // If in process selection mode, add anchor to selected process
      if (processCreationMode === 'selecting-process' && selectedAnchorId) {
        // User should click on a process, not another anchor
        return;
      }
      
      // Show tooltip for anchor selection - get the actual DOM element position
      const anchorElement = event.target.closest('.react-flow__node');
      if (anchorElement) {
        const rect = anchorElement.getBoundingClientRect();
        setSelectedAnchorId(anchorId);
        setAnchorTooltipPosition({
          x: rect.left + rect.width / 2,
          y: rect.top
        });
      }
      return;
    }
    
    // Handle process node clicks
    if (node.type === 'processNode' && processCreationMode === 'selecting-process' && selectedAnchorId) {
      // Get process ID from node data (reliable method)
      const processId = node.data?.processId as string;
      if (!processId) {
        console.error('Process node missing processId in data:', node);
        return;
      }
      processManagement.addAnchorToProcess(selectedAnchorId, processId);
      setProcessCreationMode('none');
      setSelectedAnchorId(null);
      setAnchorTooltipPosition(null);
      return;
    }
    
    // Handle process node clicks
    if (node.type === 'processNode') {
      const processNode = node.data as any;
      const processId = processNode?.processNode?.id;
      if (processId) {
        // Clear other selections
        setSelectedNodeIds([]);
        setToolbarPosition(null);
        setSelectedLifelineId(null);
        setLifelineToolbarPosition(null);
        
        handleProcessSelect(processId);
        setProcessToolbarPosition({
          x: node.position.x,
          y: node.position.y
        });
      }
      return;
    }
    
    // Handle lifeline clicks
    if (node.type === 'columnLifeline') {
      const lifelineData = node.data as any;
      const lifelineId = lifelineData?.column?.id;
      if (lifelineId) {
        // Clear other selections
        setSelectedNodeIds([]);
        setToolbarPosition(null);
        setSelectedProcessId(null);
        setProcessToolbarPosition(null);
        
        // Toggle selection - clicking same lifeline deselects it
        if (selectedLifelineId === lifelineId) {
          setSelectedLifelineId(null);
          setLifelineToolbarPosition(null);
        } else {
          handleLifelineSelect(lifelineId);
          setLifelineToolbarPosition({
            x: node.position.x,
            y: node.position.y + 50 // Below header
          });
        }
      }
      return;
    }
    
    // Only show toolbar for sequence nodes
    if (node.type !== 'sequenceNode') return;
    
    const diagramNode = diagramNodes.find(n => n.id === node.id);
    if (diagramNode) {
      // Clear other selections
      setSelectedProcessId(null);
      setProcessToolbarPosition(null);
      setSelectedLifelineId(null);
      setLifelineToolbarPosition(null);
      
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
  }, [diagramNodes, readOnly, selectedNodeIds, nodes, processManagement, processCreationMode, selectedAnchorId, handleProcessSelect, handleLifelineSelect, selectedLifelineId]);
  
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

  // Process creation handlers
  const handleCreateProcess = useCallback(() => {
    if (selectedAnchorId) {
      processManagement.createProcess(selectedAnchorId);
      setSelectedAnchorId(null);
      setAnchorTooltipPosition(null);
    }
  }, [selectedAnchorId, processManagement]);

  const handleAddToExistingProcess = useCallback(() => {
    if (selectedAnchorId) {
      setProcessCreationMode('selecting-process');
    }
  }, [selectedAnchorId]);

  const handleRemoveFromProcess = useCallback(() => {
    if (selectedAnchorId) {
      // Find which process this anchor belongs to
      const process = data.processes?.find(p => p.anchorIds.includes(selectedAnchorId));
      if (process) {
        processManagement.removeAnchorFromProcess(selectedAnchorId, process.id);
      }
      setSelectedAnchorId(null);
      setAnchorTooltipPosition(null);
    }
  }, [selectedAnchorId, processManagement, data.processes]);
  
  const handleEditProcess = useCallback(() => {
    if (!selectedProcessId) return;
    const process = (data.processes || []).find(p => p.id === selectedProcessId);
    if (process) {
      setIsProcessEditorOpen(true);
    }
  }, [selectedProcessId, data.processes]);
  
  const handleDeleteProcess = useCallback(() => {
    if (!selectedProcessId || !onDataChange) return;
    
    const updatedProcesses = (data.processes || []).filter(p => p.id !== selectedProcessId);
    onDataChange({ ...data, processes: updatedProcesses });
    setSelectedProcessId(null);
    setProcessToolbarPosition(null);
  }, [selectedProcessId, data, onDataChange]);
  
  const handleProcessUpdate = useCallback((processId: string, updates: Partial<any>) => {
    if (!onDataChange) return;
    
    const updatedProcesses = (data.processes || []).map(p =>
      p.id === processId ? { ...p, ...updates } : p
    );
    
    onDataChange({ ...data, processes: updatedProcesses });
  }, [data, onDataChange]);
  
  const handleProcessDelete = useCallback((processId: string) => {
    if (!onDataChange) return;
    
    const updatedProcesses = (data.processes || []).filter(p => p.id !== processId);
    onDataChange({ ...data, processes: updatedProcesses });
  }, [data, onDataChange]);
  
  const handleEditLifeline = useCallback(() => {
    if (!selectedLifelineId) return;
    setIsLifelineEditorOpen(true);
  }, [selectedLifelineId]);
  
  const handleDeleteLifeline = useCallback(() => {
    if (!selectedLifelineId || !onDataChange) return;
    
    const updatedLifelines = lifelines.filter(l => l.id !== selectedLifelineId);
    onDataChange({ ...data, lifelines: updatedLifelines });
    setSelectedLifelineId(null);
    setLifelineToolbarPosition(null);
  }, [selectedLifelineId, lifelines, data, onDataChange]);
  
  const handleLifelineUpdate = useCallback((lifelineId: string, updates: Partial<Lifeline>) => {
    if (!onDataChange) return;
    
    const updatedLifelines = lifelines.map(l =>
      l.id === lifelineId ? { ...l, ...updates } : l
    );
    
    onDataChange({ ...data, lifelines: updatedLifelines });
  }, [lifelines, data, onDataChange]);
  
  const handleLifelineDelete = useCallback((lifelineId: string) => {
    if (!onDataChange) return;
    
    const updatedLifelines = lifelines.filter(l => l.id !== lifelineId);
    onDataChange({ ...data, lifelines: updatedLifelines });
  }, [lifelines, data, onDataChange]);

  // Close toolbar and tooltips when clicking outside
  const onPaneClick = useCallback(() => {
    setSelectedNodeIds([]);
    setToolbarPosition(null);
    setSelectedAnchorId(null);
    setAnchorTooltipPosition(null);
    setProcessCreationMode('none');
    setSelectedProcessId(null);
    setProcessToolbarPosition(null);
    setSelectedLifelineId(null);
    setLifelineToolbarPosition(null);
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
          className={processCreationMode === 'selecting-process' ? 'process-selection-mode' : ''}
          style={{
            filter: processCreationMode === 'selecting-process' ? 'brightness(0.95)' : undefined
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
          {!isRenderMode && (
            <>
              {selectedNodeIds.length > 0 && toolbarPosition && (
                <NodeToolbarWrapper
                  diagramPosition={toolbarPosition}
                  selectedCount={selectedNodeIds.length}
                  onEdit={handleEditNode}
                  onDelete={handleDeleteNode}
                />
              )}
              
              {selectedProcessId && processToolbarPosition && (
                <NodeToolbarWrapper
                  diagramPosition={processToolbarPosition}
                  selectedCount={1}
                  onEdit={handleEditProcess}
                  onDelete={handleDeleteProcess}
                />
              )}
              
              {selectedLifelineId && lifelineToolbarPosition && (
                <NodeToolbarWrapper
                  diagramPosition={lifelineToolbarPosition}
                  selectedCount={1}
                  onEdit={handleEditLifeline}
                  onDelete={handleDeleteLifeline}
                />
              )}
              
              {selectedAnchorId && anchorTooltipPosition && (
                <AnchorTooltip
                  anchorId={selectedAnchorId}
                  isInProcess={processManagement.isAnchorInProcess(selectedAnchorId)}
                  canAddProcess={!processManagement.isAnchorInProcess(selectedAnchorId)}
                  hasNearbyProcesses={true}
                  onCreateProcess={handleCreateProcess}
                  onAddToExisting={handleAddToExistingProcess}
                  onRemoveFromProcess={handleRemoveFromProcess}
                  position={anchorTooltipPosition}
                  open={true}
                  onOpenChange={(open) => {
                    if (!open) {
                      setSelectedAnchorId(null);
                      setAnchorTooltipPosition(null);
                      setProcessCreationMode('none');
                    }
                  }}
                />
              )}
            </>
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
          
          <ProcessEditor
            process={(data.processes || []).find(p => p.id === selectedProcessId) || null}
            isOpen={isProcessEditorOpen}
            onClose={() => {
              setIsProcessEditorOpen(false);
              setSelectedProcessId(null);
              setProcessToolbarPosition(null);
            }}
            onUpdate={handleProcessUpdate}
            onDelete={handleProcessDelete}
          />
          
          <LifelineEditor
            lifeline={lifelines.find(l => l.id === selectedLifelineId) || null}
            isOpen={isLifelineEditorOpen}
            onClose={() => {
              setIsLifelineEditorOpen(false);
              setSelectedLifelineId(null);
              setLifelineToolbarPosition(null);
            }}
            onUpdate={handleLifelineUpdate}
            onDelete={handleLifelineDelete}
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