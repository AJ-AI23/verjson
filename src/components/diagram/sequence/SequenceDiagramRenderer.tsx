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
import { calculateSequenceLayout, calculateEvenSpacing } from '@/lib/diagram/sequenceLayout';
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
  onGetViewportReady?: (getViewport: () => { x: number; y: number; zoom: number }) => void;
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
  onGetViewportReady,
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
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Store original diagram yPositions at drag start for snapback
  const dragStartYPositionsRef = useRef<Map<string, number>>(new Map());
  const [nodeHeights, setNodeHeights] = useState<Map<string, number>>(new Map());
  const nodeHeightsRef = useRef<Map<string, number>>(new Map());
  const initialHeightsAppliedRef = useRef(false);
  
  // Update ref when nodeHeights changes
  useEffect(() => {
    nodeHeightsRef.current = nodeHeights;
    
    // Trigger layout recalculation once all initial heights are measured
    if (!initialHeightsAppliedRef.current && diagramNodes.length > 0 && nodeHeights.size >= diagramNodes.length) {
      initialHeightsAppliedRef.current = true;
      setLayoutVersion(v => v + 1);
    }
  }, [nodeHeights, diagramNodes.length]);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const [layoutVersion, setLayoutVersion] = useState(0); // Force layout recalculation
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const previousLayoutRef = useRef<{ nodes: Node[]; edges: Edge[]; calculatedYPositions?: Map<string, number> }>({ nodes: [], edges: [] });
  const [hoveredElement, setHoveredElement] = useState<{ id: string; description?: string; position: { x: number; y: number } } | null>(null);

  // Process management state
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [anchorTooltipPosition, setAnchorTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [processCreationMode, setProcessCreationMode] = useState<'none' | 'selecting-process'>('none');
  
  // Interactivity state for Controls toggle
  const [isInteractive, setIsInteractive] = useState(true);
  
  // Clear all selections when interactivity is disabled
  useEffect(() => {
    if (!isInteractive) {
      setSelectedNodeIds([]);
      setToolbarPosition(null);
      setSelectedAnchorId(null);
      setAnchorTooltipPosition(null);
      setProcessCreationMode('none');
      setSelectedProcessId(null);
      setProcessToolbarPosition(null);
      setSelectedLifelineId(null);
      setLifelineToolbarPosition(null);
    }
  }, [isInteractive]);
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
  onGetViewportReady?: (getViewport: () => { x: number; y: number; zoom: number }) => void;
  nodesCount: number; 
  edgesCount: number;
  hasInitialViewport: boolean;
  hasUserInteracted: boolean;
  sequenceNodesCount: number;
  measuredHeightsCount: number;
}> = ({ 
  isRenderMode, 
  onReady,
  onFitViewReady,
  onGetViewportReady,
  nodesCount,
  edgesCount,
  hasInitialViewport,
  hasUserInteracted,
  sequenceNodesCount,
  measuredHeightsCount
}) => {
  const { fitView, getViewport } = useReactFlow();
  
  // Check if all sequence nodes have been measured
  const allNodesMeasured = sequenceNodesCount === 0 || measuredHeightsCount >= sequenceNodesCount;
  
  // Expose fitView and getViewport functions to parent for preview
  useEffect(() => {
    if (nodesCount > 0 && edgesCount > 0 && allNodesMeasured) {
      console.log('[FitViewHelper] Exposing fitView and getViewport functions to parent', { 
        allNodesMeasured, 
        sequenceNodesCount, 
        measuredHeightsCount 
      });
      if (onFitViewReady) {
        onFitViewReady(() => {
          console.log('[FitViewHelper] fitView CALLED via onFitViewReady callback');
          fitView({ padding: 0.1, duration: 200 });
        });
      }
      if (onGetViewportReady) {
        onGetViewportReady(() => getViewport());
      }
    }
  }, [onFitViewReady, onGetViewportReady, fitView, getViewport, nodesCount, edgesCount, allNodesMeasured, sequenceNodesCount, measuredHeightsCount]);
  
  // Auto-fit in render mode ONLY if no initial viewport is provided and user hasn't interacted
  // AND all nodes have been measured
  useEffect(() => {
    if (isRenderMode && nodesCount > 0 && edgesCount > 0 && !hasInitialViewport && !hasUserInteracted && allNodesMeasured) {
      console.log('[FitViewHelper] AUTO-FIT TRIGGERED - Nodes measured and edges ready, fitting view...', { 
        nodesCount, 
        edgesCount,
        hasUserInteracted,
        hasInitialViewport,
        sequenceNodesCount,
        measuredHeightsCount,
        allNodesMeasured
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
      console.log('[FitViewHelper] Waiting for nodes/edges or height measurements...', { 
        nodesCount, 
        edgesCount, 
        hasUserInteracted, 
        hasInitialViewport,
        sequenceNodesCount,
        measuredHeightsCount,
        allNodesMeasured
      });
    }
  }, [isRenderMode, nodesCount, edgesCount, fitView, onReady, hasInitialViewport, hasUserInteracted, allNodesMeasured, sequenceNodesCount, measuredHeightsCount]);
  
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
    const anchorId1 = `anchor-${Date.now()}-1`;
    const anchorId2 = `anchor-${Date.now()}-2`;
    
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
    
    // yPosition is where the user clicked - this should be the node's center
    const nodeY = yPosition;
    
    // Node can be placed anywhere - lifeline will auto-extend
    const constrainedNodeY = nodeY;
    
    const newNodeBottom = constrainedNodeY + nodeHeight / 2;
    const newNodeTop = constrainedNodeY - nodeHeight / 2;
    
    // Don't manually push nodes down here - let calculateEvenSpacing handle all positioning
    // It will properly check for horizontal overlap (lifeline conflicts) and only separate nodes that actually conflict
    const updatedNodes = diagramNodes;
    
    // Create new node
    const newNode: DiagramNode = {
      id: nodeId,
      type: 'endpoint',
      label: 'New Endpoint',
      anchors: [
        { id: anchorId1, lifelineId: sourceLifelineId, anchorType: 'source' },
        { id: anchorId2, lifelineId: targetLifelineId, anchorType: 'target' }
      ],
      yPosition: constrainedNodeY,
      data: {
        method: 'GET',
        path: '/api/endpoint'
      }
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
      isDragging,
      layoutVersion,
      nodeHeightsCount: nodeHeights.size,
      nodeHeightsEntries: Array.from(nodeHeights.entries()).map(([id, h]) => ({ id, height: h })),
      sampleNode: diagramNodes[0] ? {
        id: diagramNodes[0].id,
        label: diagramNodes[0].label,
        data: diagramNodes[0].data
      } : null
    });
    
    const layout = calculateSequenceLayout({
      lifelines,
      nodes: diagramNodes,
      processes: data.processes || [],
      styles: activeTheme,
      fullStyles: styles,
      nodeHeights: nodeHeightsRef.current,
      isRenderMode
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
                  id: `anchor-${Date.now()}-1`, 
                  lifelineId: sourceLifeline.id,
                  anchorType: 'source'
                },
                { 
                  id: `anchor-${Date.now()}-2`, 
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
  }, [lifelines, diagramNodes, activeTheme, isRenderMode, onDataChange, data, isDragging, layoutVersion]);

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
    console.log('📏 [handleNodeHeightChange] Node height measured:', { nodeId, height });
    setNodeHeights(prev => {
      const oldHeight = prev.get(nodeId);
      if (oldHeight !== height) {
        console.log('📏 [handleNodeHeightChange] Height changed, updating:', { nodeId, oldHeight, newHeight: height });
        
        // Trigger layout recalculation when height changes after initial load
        // This ensures anchors are repositioned correctly when node heights change
        if (initialHeightsAppliedRef.current) {
          // Use setTimeout to batch multiple height changes in same frame
          setTimeout(() => setLayoutVersion(v => v + 1), 0);
        }
      }
      const newHeights = new Map(prev);
      newHeights.set(nodeId, height);
      return newHeights;
    });
  }, []);
  
  // Process selection and editing handlers
  const handleProcessSelect = useCallback((processId: string) => {
    if (readOnly || !isInteractive) return;
    
    const process = (data.processes || []).find(p => p.id === processId);
    if (!process) return;
    
    setSelectedProcessId(processId);
    
    // We'll set the toolbar position in the node click handler
    // since we need the actual rendered position
  }, [readOnly, data.processes, isInteractive]);
  
  // Lifeline selection and editing handlers
  const handleLifelineSelect = useCallback((lifelineId: string) => {
    if (readOnly || !isInteractive) return;
    
    const lifeline = lifelines.find(l => l.id === lifelineId);
    if (!lifeline) return;
    
    setSelectedLifelineId(lifelineId);
  }, [readOnly, lifelines, isInteractive]);

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
    console.log('🔄 [nodesWithHandlers] Recalculating with:', {
      layoutNodesCount: layoutNodes.length,
      diagramNodesCount: diagramNodes.length,
      currentTheme,
      sampleDiagramNode: diagramNodes[0] ? {
        id: diagramNodes[0].id,
        label: diagramNodes[0].label,
        type: diagramNodes[0].type,
        data: diagramNodes[0].data
      } : null
    });
    
    return layoutNodes.map(node => {
      if (node.type === 'columnLifeline') {
        const lifelineData = node.data as any;
        const isSelected = lifelineData?.column?.id === selectedLifelineId;
        const lifeline = lifelines.find(l => l.id === lifelineData?.column?.id);
        // Create dataVersion from lifeline properties AND theme to force re-render on changes
        const dataVersion = lifeline ? `${lifeline.name}-${lifeline.description}-${lifeline.color}-${lifeline.anchorColor}-${lifeline.order}-${currentTheme}` : currentTheme;
        return {
          ...node,
          draggable: !readOnly && !isRenderMode && isInteractive,
          selectable: !readOnly && !isRenderMode && isInteractive,
          selected: isSelected && !isRenderMode && isInteractive,
          data: {
            ...node.data,
            customLifelineColors,
            onAddNode: isInteractive ? (lifelineId: string, yPosition: number) => handleAddNodeOnLifeline(lifelineId, yPosition, lifelineHeight) : undefined,
            readOnly: readOnly || isRenderMode || !isInteractive,
            lifelineHeight: lifelineHeight,
            dataVersion,
            styles: activeTheme,
            isRenderMode
          }
        };
      }
      
      if (node.type === 'sequenceNode') {
        const diagramNode = diagramNodes.find(n => n.id === node.id);
        // Include theme and node properties in dataVersion for re-render on changes
        const dataVersion = diagramNode 
          ? `${currentTheme}-${diagramNode.label}-${diagramNode.type}-${JSON.stringify(diagramNode.data || {})}`
          : currentTheme;
        
        const isDraggable = !readOnly && !isRenderMode && isInteractive;
        // Log draggable state for first node only to avoid spam
        if (node.id === diagramNodes[0]?.id) {
          console.log('🎯 [sequenceNode draggable]', { nodeId: node.id, isDraggable, readOnly, isRenderMode, isInteractive });
        }
        
        return {
          ...node,
          draggable: isDraggable,
          selectable: !readOnly && !isRenderMode && isInteractive,
          selected: node.selected && isInteractive,
          data: {
            ...node.data,
            onHeightChange: handleNodeHeightChange,
            calculatedHeight: nodeHeightsRef.current.get(node.id),
            styles: activeTheme,
            dataVersion,
            isRenderMode
          }
        };
      }
      
      // Make anchor nodes selectable and pass isInProcess status
      if (node.type === 'anchorNode') {
        const anchorId = node.id;
        const isInProcess = processManagement.isAnchorInProcess(anchorId);
        const anchorData = node.data as any;
        const lifeline = lifelines.find(l => l.id === anchorData?.lifelineId);
        // Include theme and lifeline colors in dataVersion for re-render on theme change
        const dataVersion = `${currentTheme}-${lifeline?.anchorColor || ''}-${lifeline?.color || ''}`;
        
        return {
          ...node,
          draggable: !readOnly && !isRenderMode && isInteractive,
          selectable: !readOnly && !isRenderMode && isInteractive,
          selected: node.id === selectedAnchorId && !isRenderMode && isInteractive,
          data: {
            ...node.data,
            isInProcess,
            styles: activeTheme,
            lifelines,
            dataVersion,
            isRenderMode
          }
        };
      }
      
      // Process nodes - make selectable with click handler
      if (node.type === 'processNode') {
        const processNode = node.data as any;
        const isHighlighted = processCreationMode === 'selecting-process';
        const isSelected = processNode?.processNode?.id === selectedProcessId;
        const process = processNode?.processNode;
        // Include theme and process color in dataVersion for re-render on theme change
        const dataVersion = `${currentTheme}-${process?.description || ''}-${process?.color || ''}`;
        
        return {
          ...node,
          draggable: false, // Process nodes should never be draggable - their position is calculated from anchors
          selectable: !readOnly && !isRenderMode && isInteractive,
          selected: isSelected && !isRenderMode && isInteractive,
          style: {
            ...node.style,
            opacity: isHighlighted ? 1 : undefined,
            cursor: isRenderMode ? 'default' : 'pointer'
          },
          data: {
            ...node.data,
            theme: activeTheme,
            dataVersion,
            isRenderMode
          }
        } as Node;
      }
      
      // Default: ensure interactivity controls for any other node types
      return {
        ...node,
        selectable: !readOnly && !isRenderMode && isInteractive,
        draggable: !readOnly && !isRenderMode && isInteractive,
        selected: node.selected && isInteractive
      };
    });
  }, [layoutNodes, handleAddNodeOnLifeline, handleNodeHeightChange, readOnly, customLifelineColors, lifelineHeight, selectedAnchorId, processManagement, processCreationMode, activeTheme, selectedProcessId, handleProcessSelect, selectedLifelineId, lifelines, currentTheme, diagramNodes, isInteractive]);

  // Process edges to add render mode properties
  const edgesWithRenderMode = useMemo(() => {
    return layoutEdges.map(edge => ({
      ...edge,
      selectable: !readOnly && !isRenderMode,
      focusable: !readOnly && !isRenderMode,
    }));
  }, [layoutEdges, readOnly, isRenderMode]);

  const [nodes, setNodes, handleNodesChange] = useNodesState(nodesWithHandlers);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(edgesWithRenderMode);
  
  // Track previous values to prevent unnecessary updates
  const prevNodesRef = useRef<Node[]>([]);
  const prevEdgesRef = useRef<Edge[]>([]);

  // Update nodes when layout changes and apply handlers - with deduplication
  useEffect(() => {
    // CRITICAL: Skip node updates during active drag to prevent React Flow drag interruption
    if (isDraggingRef.current) {
      console.log('⏸️ [Nodes Update] Skipping during drag');
      return;
    }
    
    // Skip if nodes haven't actually changed (deep comparison of IDs, positions, and data)
    const nodesChanged = nodesWithHandlers.length !== prevNodesRef.current.length ||
      nodesWithHandlers.some((node, i) => {
        const prev = prevNodesRef.current[i];
        if (!prev) return true;
        
        // Check basic properties including draggable
        if (node.id !== prev.id || 
            node.type !== prev.type ||
            node.position.x !== prev.position.x ||
            node.position.y !== prev.position.y ||
            node.draggable !== prev.draggable) {
          console.log('📝 [Node Change Detected] Basic properties changed:', { 
            nodeId: node.id, 
            type: node.type,
            posChanged: node.position.y !== prev.position.y,
            draggableChanged: node.draggable !== prev.draggable
          });
          return true;
        }
        
        // Check data changes (especially for process, lifeline, anchor, and sequence nodes)
        if (node.type === 'processNode' || node.type === 'columnLifeline' || node.type === 'anchorNode' || node.type === 'sequenceNode') {
          const nodeData = node.data as any;
          const prevData = prev.data as any;
          // Compare dataVersion which changes when properties or theme changes
          if (nodeData?.dataVersion !== prevData?.dataVersion) {
            console.log('📝 [Node Change Detected] dataVersion changed:', { 
              nodeId: node.id, 
              type: node.type,
              oldVersion: prevData?.dataVersion,
              newVersion: nodeData?.dataVersion 
            });
            return true;
          }
        }
        
        return false;
      });
    
    if (nodesChanged) {
      console.log('📝 [Nodes Update] Updating nodes state:', {
        count: nodesWithHandlers.length,
        changedNodes: nodesWithHandlers.filter((node, i) => {
          const prev = prevNodesRef.current[i];
          return !prev || node.id !== prev.id || (node.data as any)?.dataVersion !== (prev.data as any)?.dataVersion;
        }).map(n => ({ id: n.id, type: n.type }))
      });
      prevNodesRef.current = nodesWithHandlers;
      setNodes(nodesWithHandlers);
    }
  }, [nodesWithHandlers, setNodes]);

  // Update edges when layout changes - with deduplication
  useEffect(() => {
    const edgesChanged = edgesWithRenderMode.length !== prevEdgesRef.current.length ||
      edgesWithRenderMode.some((edge, i) => {
        const prev = prevEdgesRef.current[i];
        if (!prev || edge.id !== prev.id || edge.source !== prev.source || edge.target !== prev.target) {
          return true;
        }
        // Check if handles changed (important for anchor position swaps)
        if (edge.sourceHandle !== prev.sourceHandle || edge.targetHandle !== prev.targetHandle) {
          return true;
        }
        // Check if edge data changed (e.g., theme)
        const edgeData = edge.data as any;
        const prevData = prev.data as any;
        if (edgeData?.styles?.id !== prevData?.styles?.id) {
          return true;
        }
        return false;
      });
    
    if (edgesChanged) {
      prevEdgesRef.current = edgesWithRenderMode;
      setEdges(edgesWithRenderMode);
    }
  }, [edgesWithRenderMode, setEdges]);

  const onNodesChangeHandler = useCallback((changes: any) => {
    // Debug: Log every call to this handler with full change details
    console.log('🔧 [onNodesChangeHandler] Called with', changes.length, 'changes:', 
      changes.map((c: any) => ({ type: c.type, id: c.id, dragging: c.dragging, hasPosition: !!c.position, position: c.position }))
    );
    
    // Block position and selection changes when interactivity is disabled
    if (!isInteractive) {
      console.log('🔧 [onNodesChangeHandler] Blocked - isInteractive is false');
      const allowedChanges = changes.filter((c: any) => 
        c.type !== 'position' && c.type !== 'select'
      );
      if (allowedChanges.length > 0) {
        handleNodesChange(allowedChanges);
      }
      return;
    }
    
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
    
    // Store initial positions when drag starts (only on first drag frame)
    const dragStartChange = changes.find((c: any) => c.type === 'position' && c.dragging === true);
    if (dragStartChange && !isDraggingRef.current) {
      console.log('🟢 [DRAG START]', dragStartChange.id);
      isDraggingRef.current = true;
      setIsDragging(true);
      
      // Store positions in ref for immediate access (state is async)
      const startPositions = new Map<string, { x: number; y: number }>();
      nodes.forEach(n => {
        // Store positions for ALL sequence nodes to preserve X during drag
        if (n.type === 'sequenceNode' || n.type === 'columnLifeline') {
          startPositions.set(n.id, { x: n.position.x, y: n.position.y });
        }
      });
      dragStartPositionsRef.current = startPositions;
      setDragStartPositions(startPositions);
      
      // Store original diagram yPositions for snapback (before any sync updates)
      const startYPositions = new Map<string, number>();
      diagramNodes.forEach(n => {
        if (n.yPosition !== undefined) {
          startYPositions.set(n.id, n.yPosition);
        }
      });
      dragStartYPositionsRef.current = startYPositions;
      console.log('📍 [DRAG START] Stored original yPositions:', Object.fromEntries(startYPositions));
    }
    
    // Detect drag end
    const allDropChanges = changes.filter((c: any) => c.type === 'position' && c.dragging === false);
    if (allDropChanges.length > 0) {
      console.log('🔴 [POTENTIAL DROP] All changes with dragging=false:', allDropChanges.map((c: any) => ({
        id: c.id,
        hasPosition: !!c.position,
        position: c.position
      })));
    }
    
    const dragEndChange = changes.find((c: any) => c.type === 'position' && c.dragging === false && c.position);
    if (dragEndChange && dragEndChange.type === 'position') {
      console.log('🔴 [DRAG END] Detected drop for node:', dragEndChange.id, 'isDraggingRef was:', isDraggingRef.current);
      isDraggingRef.current = false;
      // Always reset isDragging state and force layout recalculation on any drag end
      setIsDragging(false);
      setLayoutVersion(v => v + 1);
      
      // Update positions with order-based conflict resolution
      // Nodes maintain their order unless dragged past another node
      if (onDataChange) {
        const sequenceNodes = nodes.filter(n => n.type === 'sequenceNode');
        
        console.log('🔍 [DROP DEBUG] Starting drop analysis:', {
          draggedNodeId: dragEndChange.id,
          totalSequenceNodes: sequenceNodes.length,
          totalDiagramNodes: diagramNodes.length
        });
        
        // Find the dragged node
        const draggedFlowNode = sequenceNodes.find(n => n.id === dragEndChange.id);
        if (!draggedFlowNode) {
          console.log('⚠️ [DROP] Dragged node not found in sequenceNodes');
          return;
        }
        
        // Get dragged node's new center Y position
        const draggedDiagramNode = diagramNodes.find(n => n.id === dragEndChange.id);
        const draggedNodeConfig = draggedDiagramNode ? getNodeTypeConfig(draggedDiagramNode.type) : null;
        const draggedNodeHeight = nodeHeights.get(dragEndChange.id) || draggedNodeConfig?.defaultHeight || 70;
        const draggedCenterY = draggedFlowNode.position.y + (draggedNodeHeight / 2);
        
        console.log('🔍 [DROP DEBUG] Dragged node info:', {
          draggedFlowNodePosition: draggedFlowNode.position,
          draggedNodeHeight,
          draggedCenterY,
          diagramNodeYPosition: draggedDiagramNode?.yPosition
        });
        
        // Get all nodes sorted by their ORIGINAL yPosition (before drag)
        const nodesByOriginalOrder = [...diagramNodes].sort((a, b) => (a.yPosition || 0) - (b.yPosition || 0));
        
        console.log('🔍 [DROP DEBUG] Nodes by original order:', nodesByOriginalOrder.map(n => ({
          id: n.id,
          label: n.label?.substring(0, 20),
          yPosition: n.yPosition
        })));
        
        // Find the dragged node's original index
        const originalIndex = nodesByOriginalOrder.findIndex(n => n.id === dragEndChange.id);
        
        // Find where the dragged node should be inserted based on its new position
        // Only count nodes that the dragged node has FULLY passed (crossed their center)
        let newOrderIndex = 0;
        console.log('🔍 [DROP DEBUG] Checking order change - draggedCenterY:', draggedCenterY);
        
        for (let i = 0; i < nodesByOriginalOrder.length; i++) {
          const node = nodesByOriginalOrder[i];
          if (node.id === dragEndChange.id) {
            console.log(`  [${i}] ${node.id} (DRAGGED NODE) - skipping`);
            continue;
          }
          
          const nodeCenterY = node.yPosition || 0;
          const passed = draggedCenterY > nodeCenterY;
          console.log(`  [${i}] ${node.id}: centerY=${nodeCenterY}, passed=${passed}`);
          
          if (passed) {
            newOrderIndex = i + 1;
          }
        }
        
        // Adjust index since we'll remove the dragged node
        const adjustedNewIndex = newOrderIndex > originalIndex ? newOrderIndex - 1 : newOrderIndex;
        
        console.log('🔍 [DROP DEBUG] Order calculation result:', {
          originalIndex,
          newOrderIndex,
          adjustedNewIndex,
          orderChanged: adjustedNewIndex !== originalIndex
        });
        
        // If order didn't change, restore original yPositions to trigger snapback
        // Use the positions stored at drag START (before any sync updates)
        if (adjustedNewIndex === originalIndex) {
          console.log('📋 [DROP] Order unchanged, restoring original yPositions for snapback');
          const originalYPositions = dragStartYPositionsRef.current;
          
          console.log('🔍 [DROP DEBUG] Original yPositions from drag start:', Object.fromEntries(originalYPositions));
          
          // Restore original yPositions from drag start
          const restoredNodes = diagramNodes.map(n => ({
            ...n,
            yPosition: originalYPositions.get(n.id) ?? n.yPosition,
            anchors: n.anchors // Keep tuple type
          }));
          
          console.log('🔍 [DROP DEBUG] Restored nodes yPositions:', restoredNodes.map(n => ({
            id: n.id,
            yPosition: n.yPosition
          })));
          
          onDataChange({ ...data, nodes: restoredNodes });
          return;
        }
        
        // Reorder nodes only when order actually changed
        const reorderedNodes = nodesByOriginalOrder.filter(n => n.id !== dragEndChange.id);
        const draggedNode = nodesByOriginalOrder.find(n => n.id === dragEndChange.id)!;
        reorderedNodes.splice(adjustedNewIndex, 0, draggedNode);
        
        console.log('📋 [DROP] Node order CHANGED:', {
          originalOrder: nodesByOriginalOrder.map(n => n.id),
          draggedNode: dragEndChange.id,
          originalIndex,
          newOrderIndex: adjustedNewIndex,
          finalOrder: reorderedNodes.map(n => n.id)
        });
        
        // Use the SAME calculateEvenSpacing function as the layout engine
        // This ensures 100% consistent spacing between drop and initial render
        const calculatedPositions = calculateEvenSpacing(reorderedNodes, nodeHeights, lifelines);
        
        console.log('🔍 [DROP DEBUG] Calculated new positions:', Object.fromEntries(calculatedPositions));
        
        const updatedNodes = reorderedNodes.map((node) => ({
          ...node,
          yPosition: calculatedPositions.get(node.id) || node.yPosition,
          anchors: node.anchors
        }));
        
        console.log('📝 [DROP] Repositioned nodes:', updatedNodes.map(n => ({
          id: n.id,
          newYPosition: n.yPosition
        })));
        
        onDataChange({ ...data, nodes: updatedNodes });
      }
    }
    
    // Constrain sequence node movement to vertical only during drag
    // On DROP, use the layout-calculated position to ensure proper snapback
    const constrainedChanges = changes.map((change: any) => {
      if (change.type === 'position' && change.position) {
        const node = nodes.find(n => n.id === change.id);
        if (node?.type === 'sequenceNode') {
          // Get original X position from drag start ref
          const storedPosition = dragStartPositionsRef.current.get(change.id);
          const originalX = storedPosition?.x ?? node.position.x;
          
          if (change.dragging === false) {
            // On DROP: Use the layout-calculated position for snapback
            // The previousLayoutRef contains the last calculated positions
            const layoutNode = previousLayoutRef.current.nodes.find(n => n.id === change.id);
            if (layoutNode) {
              console.log('🔄 [DROP POSITION] Using layout position for snapback', {
                nodeId: change.id,
                droppedY: change.position.y,
                layoutY: layoutNode.position.y
              });
              return {
                ...change,
                position: {
                  x: originalX,
                  y: layoutNode.position.y
                }
              };
            }
          }
          
          // During DRAG: Apply constraints
          const actualHeight = nodeHeights.get(node.id);
          const diagramNode = diagramNodes.find(n => n.id === node.id);
          const nodeConfig = diagramNode ? getNodeTypeConfig(diagramNode.type) : null;
          const nodeHeight = actualHeight || nodeConfig?.defaultHeight || 70;
          
          const LIFELINE_HEADER_HEIGHT = 100;
          const minY = LIFELINE_HEADER_HEIGHT + 40;
          
          const newY = change.position?.y || node.position.y;
          const constrainedY = Math.max(minY, newY);
          
          console.log('🔒 [POSITION CONSTRAIN]', { 
            nodeId: change.id, 
            dragging: change.dragging,
            storedX: storedPosition?.x, 
            attemptedX: change.position.x,
            usingX: originalX 
          });
          
          return {
            ...change,
            position: {
              x: originalX,
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
        // Update anchor position - snap to nearest lifeline if within valid distance
        const anchorData = movedNode?.data as any;
        const originalLifelineId = anchorData?.lifelineId;
        
        // Get the current layout position of this anchor (accounts for process box offsets)
        const anchorLayoutNode = layoutNodes.find(n => n.id === moveChange.id);
        const originalAnchorX = anchorLayoutNode ? anchorLayoutNode.position.x + 8 : 0; // Center of 16px anchor
        
        console.log('🎯 [ANCHOR DROP] Starting snap calculation:', {
          anchorId: moveChange.id,
          dropPosition: moveChange.position,
          originalLifelineId,
          anchorLayoutNode: anchorLayoutNode ? { id: anchorLayoutNode.id, position: anchorLayoutNode.position } : null,
          originalAnchorX,
          layoutNodesCount: layoutNodes.length,
          anchorNodesInLayout: layoutNodes.filter(n => n.type === 'anchorNode').map(n => ({ id: n.id, x: n.position.x }))
        });
        
        // Find which lifeline this anchor should snap to based on X position
        const anchorX = moveChange.position.x + 8; // Add half width to get center
        let closestLifelineId = originalLifelineId;
        let closestLifelineX = originalAnchorX; // Default to current position
        let minDistance = Infinity;
        
        // Use layout positions to find closest lifeline
        // Note: lifeline node position.x is where anchors are positioned (left edge of lifeline)
        const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
        const lifelineLayoutNodes = layoutNodes.filter(n => n.type === 'columnLifeline');
        
        console.log('📍 [ANCHOR DROP] Lifeline positions:', lifelineLayoutNodes.map(n => ({
          id: n.id,
          x: n.position.x
        })));
        
        sortedLifelines.forEach((lifeline, index) => {
          // Get actual position from layout nodes - this is where anchors are positioned
          // Don't add 150 - anchors are at lifeline left edge, not center
          const layoutNode = lifelineLayoutNodes.find(n => n.id === `lifeline-${lifeline.id}`);
          const lifelineX = layoutNode ? layoutNode.position.x : index * (300 + 100) + 150;
          const distance = Math.abs(anchorX - lifelineX);
          if (distance < minDistance) {
            minDistance = distance;
            closestLifelineId = lifeline.id;
            closestLifelineX = lifelineX;
          }
        });
        
        console.log('🔍 [ANCHOR DROP] Closest lifeline found:', {
          anchorX,
          closestLifelineId,
          closestLifelineX,
          minDistance
        });
        
        // Check if the anchor is part of a process - if so, it cannot be moved to a different lifeline
        const anchorIsInProcess = anchorData?.isInProcess || false;
        
        // If drop position is too far from any lifeline, snap back to original position from layout
        const SNAP_THRESHOLD = 150; // Max distance in pixels to consider a valid snap
        const shouldSnapBack = minDistance > SNAP_THRESHOLD || anchorIsInProcess;
        
        if (shouldSnapBack) {
          // Revert to original lifeline and use the anchor's layout position (includes process offset)
          closestLifelineId = originalLifelineId;
          closestLifelineX = originalAnchorX;
          console.log('↩️ [ANCHOR DROP] Snapping back to original position' + (anchorIsInProcess ? ' - anchor is in process' : ' - drop too far') + ':', {
            anchorId: moveChange.id,
            minDistance,
            threshold: SNAP_THRESHOLD,
            anchorIsInProcess,
            originalLifelineId,
            originalAnchorX,
            willSnapTo: closestLifelineX - 8
          });
        } else {
          console.log('✅ [ANCHOR DROP] Valid snap to new lifeline:', {
            anchorId: moveChange.id,
            newLifelineId: closestLifelineId,
            newX: closestLifelineX - 8
          });
        }
        
        // Snap anchor to correct X position
        const snappedX = closestLifelineX - 8; // Center the 16px anchor
        
        console.log('📌 [ANCHOR DROP] Final snapped position:', {
          anchorId: moveChange.id,
          snappedX,
          closestLifelineX,
          originalAnchorX
        });
        
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
            // yPosition is already the CENTER Y of the node (set by layout)
            const nodeCenterY = n.yPosition || 100;
            
            const updatedAnchors = [...n.anchors];
            const otherAnchorIndex = anchorIndex === 0 ? 1 : 0;
            const otherAnchor = updatedAnchors[otherAnchorIndex];
            const draggedAnchor = updatedAnchors[anchorIndex];
            
            if (isSwapping) {
              // When swapping to the same lifeline as the other anchor, swap their lifelineIds
              // Keep anchorType unchanged - the layout will handle edge handle positions based on lifeline X positions
              updatedAnchors[anchorIndex] = {
                ...draggedAnchor,
                lifelineId: otherAnchor.lifelineId
              };
              updatedAnchors[otherAnchorIndex] = {
                ...otherAnchor,
                lifelineId: draggedOriginalLifeline
              };
            } else {
              // Update the dragged anchor to new lifeline
              // Clear processId when moving to a different lifeline (process is lifeline-specific)
              updatedAnchors[anchorIndex] = {
                ...draggedAnchor,
                lifelineId: closestLifelineId,
                processId: undefined // Clear process association when changing lifeline
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
                yPosition: nodeCenterY
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
          
          // yPosition is already the CENTER Y of the node (set by layout)
          const nodeCenterY = connectedNode.yPosition || 100;
          
          // Helper to get lifeline X position from layout (accounts for process box offsets)
          const getLifelineX = (lifelineId: string) => {
            const lifeline = lifelines.find(l => l.id === lifelineId);
            if (!lifeline) return 0;
            const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
            const index = sortedLifelines.findIndex(l => l.id === lifelineId);
            // Use layout position if available, fall back to simple calculation
            const lifelineLayoutNodes = layoutNodes.filter(n => n.type === 'columnLifeline');
            const layoutNode = lifelineLayoutNodes.find(n => n.id === `lifeline-${lifelineId}`);
            return layoutNode ? layoutNode.position.x + 150 : index * (300 + 100) + 150; // Center of lifeline
          };
          
          return currentNodes.map(n => {
            // Update anchor positions
            const anchorData = n.data as any;
            if (n.type === 'anchorNode' && anchorData?.connectedNodeId === connectedNode.id) {
              const isTheDraggedAnchor = n.id === moveChange.id;
              
              if (isSwapping) {
                // When swapping anchorType (arrow direction), restore from layout positions
                // React Flow has already moved the node, so we need to reset to original layout position
                const anchorLayoutNode = layoutNodes.find(ln => ln.id === n.id);
                if (anchorLayoutNode) {
                  return { ...n, position: { ...anchorLayoutNode.position } };
                }
                return n;
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
        
        // Process anchorIds don't need updating when swapping - only anchorType changes
        const updatedProcesses = data.processes || [];
        
        onDataChange({ ...data, nodes: updatedDiagramNodes, processes: updatedProcesses });
      } else if (movedNode?.type === 'columnLifeline') {
        // Handle lifeline drag - update order based on new X position
        const lifelineData = movedNode.data as any;
        const lifelineId = lifelineData?.column?.id;
        
        if (lifelineId) {
          const movedLifeline = lifelines.find(l => l.id === lifelineId);
          if (movedLifeline) {
            // Get actual lifeline positions from layout nodes (accounts for process box spacing)
            const lifelineLayoutNodes = layoutNodes.filter(n => n.type === 'columnLifeline');
            const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
            
            // Build position map from actual layout positions
            const lifelineXPositions = sortedLifelines.map((l, index) => {
              const layoutNode = lifelineLayoutNodes.find(n => n.id === `lifeline-${l.id}`);
              return {
                lifeline: l,
                x: layoutNode?.position.x || (index * (300 + 100) + 150), // Use layout position or fallback
                order: index
              };
            });
            
            // Find the closest position slot based on new X coordinate
            const newX = moveChange.position.x;
            const targetPosition = lifelineXPositions.reduce((closest, current) => {
              const currentDistance = Math.abs(current.x - newX);
              const closestDistance = Math.abs(closest.x - newX);
              return currentDistance < closestDistance ? current : closest;
            });
            
            const newOrder = targetPosition.order;
            const oldOrder = movedLifeline.order;
            
            // Only update if order actually changed
            if (newOrder !== oldOrder) {
              console.log('🔄 [LifelineDrag] Updating lifeline order:', {
                lifelineId,
                oldOrder,
                newOrder,
                newX
              });
              
              handleLifelineUpdate(lifelineId, { order: newOrder });
            } else {
              // Order didn't change - force snap back to correct position from layout
              const currentLifelineLayout = lifelineLayoutNodes.find(n => n.id === `lifeline-${lifelineId}`);
              const correctX = currentLifelineLayout?.position.x || (oldOrder * (300 + 100) + 150);
              
              console.log('↩️ [LifelineDrag] Snapping back to correct position:', {
                lifelineId,
                order: oldOrder,
                correctX,
                attemptedX: newX
              });
              
              // Force update nodes to snap back to correct position
              setNodes(currentNodes => 
                currentNodes.map(n => {
                  if (n.id === moveChange.id) {
                    return { ...n, position: { x: correctX, y: 0 } };
                  }
                  return n;
                })
              );
            }
          }
        }
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
  }, [handleNodesChange, onNodesChange, nodes, diagramNodes, data, onDataChange, lifelines, setNodes, selectedNodeIds, dragStartPositions, settings, nodeHeights, layoutNodes, isInteractive]);

  const onEdgesChangeHandler = useCallback((changes: any) => {
    handleEdgesChange(changes);
    if (onEdgesChange) {
      onEdgesChange(edges);
    }
  }, [handleEdgesChange, onEdgesChange, edges]);

  const onNodeClick = useCallback((event: any, node: Node) => {
    if (readOnly || !isInteractive) return;
    
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
  }, [diagramNodes, readOnly, selectedNodeIds, nodes, processManagement, processCreationMode, selectedAnchorId, handleProcessSelect, handleLifelineSelect, selectedLifelineId, isInteractive]);
  
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

  // Get the anchor type for the selected anchor
  const getSelectedAnchorType = useCallback((): 'source' | 'target' => {
    if (!selectedAnchorId) return 'source';
    for (const node of diagramNodes) {
      for (const anchor of node.anchors) {
        if (anchor.id === selectedAnchorId) {
          return anchor.anchorType;
        }
      }
    }
    return 'source';
  }, [selectedAnchorId, diagramNodes]);

  const handleSwitchAnchorType = useCallback(() => {
    if (!selectedAnchorId || !onDataChange) return;
    
    // Find the node containing this anchor
    const updatedNodes = diagramNodes.map(node => {
      const anchorIndex = node.anchors.findIndex(a => a.id === selectedAnchorId);
      if (anchorIndex === -1) return node;
      
      // Swap the anchor types for both anchors of this node
      const updatedAnchors: [typeof node.anchors[0], typeof node.anchors[1]] = [
        { ...node.anchors[0], anchorType: node.anchors[0].anchorType === 'source' ? 'target' : 'source' },
        { ...node.anchors[1], anchorType: node.anchors[1].anchorType === 'source' ? 'target' : 'source' }
      ];
      
      return { ...node, anchors: updatedAnchors };
    });
    
    onDataChange({ ...data, nodes: updatedNodes });
    setSelectedAnchorId(null);
    setAnchorTooltipPosition(null);
  }, [selectedAnchorId, diagramNodes, data, onDataChange]);
  
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
    
    // Remove lifeline and all connected nodes
    const updatedLifelines = lifelines.filter(l => l.id !== selectedLifelineId);
    const updatedNodes = diagramNodes.filter(node => 
      !node.anchors?.some(anchor => anchor.lifelineId === selectedLifelineId)
    );
    
    console.log('🗑️ [handleDeleteLifeline] Deleting lifeline and connected nodes:', {
      lifelineId: selectedLifelineId,
      deletedNodesCount: diagramNodes.length - updatedNodes.length
    });
    
    onDataChange({ ...data, lifelines: updatedLifelines, nodes: updatedNodes });
    setSelectedLifelineId(null);
    setLifelineToolbarPosition(null);
  }, [selectedLifelineId, lifelines, diagramNodes, data, onDataChange]);
  
  const handleLifelineUpdate = useCallback((lifelineId: string, updates: Partial<Lifeline>) => {
    if (!onDataChange) return;
    
    console.log('🔄 [handleLifelineUpdate] Updating lifeline:', { lifelineId, updates });
    
    // Create a map of old lifeline orders
    const oldOrderMap = new Map<string, number>();
    lifelines.forEach(l => oldOrderMap.set(l.id, l.order));
    
    let updatedLifelines: Lifeline[];
    let orderChanged = false;
    
    // Handle order changes specially to maintain unique sequential orders
    if (updates.order !== undefined) {
      const oldOrder = oldOrderMap.get(lifelineId);
      const newOrder = updates.order;
      
      if (oldOrder !== newOrder) {
        orderChanged = true;
        console.log('🔄 [handleLifelineUpdate] Reordering from', oldOrder, 'to', newOrder);
        
        // Update all lifelines to maintain sequential unique orders
        updatedLifelines = lifelines.map(l => {
          if (l.id === lifelineId) {
            // This is the lifeline being moved
            return { ...l, ...updates };
          } else if (oldOrder !== undefined && newOrder < oldOrder) {
            // Moving a lifeline earlier - shift affected lifelines forward
            if (l.order >= newOrder && l.order < oldOrder) {
              return { ...l, order: l.order + 1 };
            }
          } else if (oldOrder !== undefined && newOrder > oldOrder) {
            // Moving a lifeline later - shift affected lifelines backward
            if (l.order > oldOrder && l.order <= newOrder) {
              return { ...l, order: l.order - 1 };
            }
          }
          return l;
        });
        
        console.log('🔄 [handleLifelineUpdate] Old lifelines:', lifelines.map(l => ({ id: l.id, order: l.order })));
        console.log('🔄 [handleLifelineUpdate] New lifelines:', updatedLifelines.map(l => ({ id: l.id, order: l.order })));
      } else {
        // Order didn't actually change, just update other properties
        updatedLifelines = lifelines.map(l =>
          l.id === lifelineId ? { ...l, ...updates } : l
        );
      }
    } else {
      // No order change, just update the lifeline
      updatedLifelines = lifelines.map(l =>
        l.id === lifelineId ? { ...l, ...updates } : l
      );
    }
    
    if (orderChanged) {
      // Force layout recalculation by incrementing version
      // Note: We do NOT swap anchor types - arrow direction should be maintained as originally defined
      setLayoutVersion(prev => prev + 1);
    }
    
    onDataChange({ 
      ...data, 
      lifelines: updatedLifelines
    });
  }, [lifelines, diagramNodes, data, onDataChange]);
  
  const handleLifelineDelete = useCallback((lifelineId: string) => {
    if (!onDataChange) return;
    
    // Remove lifeline and all connected nodes
    const updatedLifelines = lifelines.filter(l => l.id !== lifelineId);
    const updatedNodes = diagramNodes.filter(node => 
      !node.anchors?.some(anchor => anchor.lifelineId === lifelineId)
    );
    
    console.log('🗑️ [handleLifelineDelete] Deleting lifeline and connected nodes:', {
      lifelineId,
      deletedNodesCount: diagramNodes.length - updatedNodes.length
    });
    
    onDataChange({ ...data, lifelines: updatedLifelines, nodes: updatedNodes });
  }, [lifelines, diagramNodes, data, onDataChange]);

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
    if (readOnly || !isInteractive) return;
  }, [readOnly, isInteractive]);

  const onConnect = useCallback((connection: Connection) => {
    // Edges are auto-generated from anchors, manual connections not supported
    if (readOnly || !onDataChange || !isInteractive) return;
  }, [readOnly, onDataChange, isInteractive]);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<DiagramNode>) => {
    if (!onDataChange) return;
    
    console.log('📝 [handleNodeUpdate] Updating node:', { nodeId, updates });
    
    const updatedNodes = diagramNodes.map(n =>
      n.id === nodeId ? { ...n, ...updates } : n
    );
    
    // Also update the selectedNode state so the editor shows current values
    const updatedNode = updatedNodes.find(n => n.id === nodeId);
    if (updatedNode) {
      setSelectedNode(updatedNode);
    }
    
    console.log('📝 [handleNodeUpdate] Calling onDataChange with updated nodes');
    onDataChange({ ...data, nodes: updatedNodes });
    
    // Force layout recalculation after a delay to allow the node to re-render
    // The ResizeObserver in handleNodeHeightChange will measure the new height
    // and that will trigger another layout recalculation if the height changed.
    // This initial recalculation ensures the layout updates for non-height changes too.
    setTimeout(() => {
      console.log('🔄 [handleNodeUpdate] Triggering layout recalculation for node update');
      setLayoutVersion(v => v + 1);
    }, 150);
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

  // Handle node hover for tooltip
  const handleNodeMouseEnter = useCallback((event: React.MouseEvent, node: Node) => {
    const container = document.querySelector('.react-flow');
    if (!container) return;
    
    const bounds = container.getBoundingClientRect();
    const viewportPos = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    };
    
    let elementId: string;
    let elementDescription: string | undefined;
    
    switch (node.type) {
      case 'sequenceNode': {
        elementId = node.id;
        const diagramNode = diagramNodes.find(n => n.id === node.id);
        elementDescription = diagramNode?.description;
        break;
      }
      case 'columnLifeline': {
        // Lifeline data is stored in node.data.column
        const lifelineData = (node.data as any)?.column;
        elementId = lifelineData?.id || node.id;
        elementDescription = lifelineData?.description;
        break;
      }
      case 'anchorNode': {
        elementId = node.id;
        // Anchor nodes have format like "anchor-xxx" - find the parent node
        const parentNode = diagramNodes.find(n => 
          n.anchors.some(a => a.id === node.id)
        );
        if (parentNode) {
          const anchor = parentNode.anchors.find(a => a.id === node.id);
          elementDescription = `${anchor?.anchorType} anchor for ${parentNode.label}`;
        }
        break;
      }
      case 'processNode': {
        // Process ID is stored in node.data.processId
        const processId = (node.data as any)?.processId;
        elementId = processId || node.id;
        const process = (data.processes || []).find(p => p.id === processId);
        elementDescription = process?.description;
        break;
      }
      default:
        return; // Don't show tooltip for unknown types
    }
    
    setHoveredElement({
      id: elementId,
      description: elementDescription,
      position: viewportPos
    });
  }, [diagramNodes, data.processes]);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredElement(null);
  }, []);

  // Log rendering information
  const sequenceNodes = nodes?.filter(n => n.type === 'sequenceNode') || [];
  console.log('[SequenceRenderer] Rendering with:', {
    isRenderMode,
    nodesCount: nodes?.length || 0,
    edgesCount: edges?.length || 0,
    hasActiveTheme: !!activeTheme,
    backgroundColor: activeTheme?.colors.background,
    sequenceNodesWithDraggable: sequenceNodes.slice(0, 3).map(n => ({ 
      id: n.id, 
      type: n.type, 
      draggable: n.draggable,
      position: n.position 
    })),
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
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onNodeDragStart={(event, node) => console.log('🚀 [ReactFlow onNodeDragStart]', node.id)}
          onNodeDrag={(event, node) => console.log('🔄 [ReactFlow onNodeDrag]', node.id, node.position)}
          onNodeDragStop={(event, node) => console.log('🛑 [ReactFlow onNodeDragStop]', node.id)}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={!isRenderMode && !initialViewport}
          defaultViewport={initialViewport}
          onViewportChange={onViewportChange}
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable={!readOnly && !isRenderMode && isInteractive}
          nodesConnectable={!readOnly && !isRenderMode && isInteractive}
          edgesReconnectable={!readOnly && !isRenderMode && isInteractive}
          elementsSelectable={!readOnly && !isRenderMode && isInteractive}
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
              <Controls onInteractiveChange={setIsInteractive} />
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
            onGetViewportReady={onGetViewportReady}
            nodesCount={nodes.length}
            edgesCount={edges.length}
            hasInitialViewport={!!initialViewport}
            hasUserInteracted={hasUserInteractedWithViewport}
            sequenceNodesCount={diagramNodes.length}
            measuredHeightsCount={nodeHeights.size}
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
                  anchorType={getSelectedAnchorType()}
                  isInProcess={processManagement.isAnchorInProcess(selectedAnchorId)}
                  canAddProcess={!processManagement.isAnchorInProcess(selectedAnchorId)}
                  hasNearbyProcesses={true}
                  onCreateProcess={handleCreateProcess}
                  onAddToExisting={handleAddToExistingProcess}
                  onRemoveFromProcess={handleRemoveFromProcess}
                  onSwitchAnchorType={handleSwitchAnchorType}
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
          
          {/* Element hover tooltip */}
          {hoveredElement && (
            <div 
              className="absolute pointer-events-none bg-background/95 border border-border px-3 py-2 rounded-md shadow-lg text-sm max-w-xs"
              style={{
                left: hoveredElement.position.x + 15,
                top: hoveredElement.position.y + 15,
                zIndex: 1000
              }}
            >
              <span className="font-medium">{hoveredElement.id}</span>
              {hoveredElement.description && (
                <span className="text-muted-foreground"> - {hoveredElement.description}</span>
              )}
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