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
import { generateNodeId, generateAnchorIds, generateLifelineId } from '@/lib/diagram/idGenerator';
import { DiagramStyles, defaultLightTheme } from '@/types/diagramStyles';
import { calculateSequenceLayout, calculateProcessLayout } from '@/lib/diagram/sequenceLayout';
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
import { useDiagramClipboard } from '@/hooks/useDiagramClipboard';
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

  // Clipboard management for copy/paste
  const diagramClipboard = useDiagramClipboard();

  // Duplicate selected node handler
  const handleDuplicateNode = useCallback(() => {
    if (selectedNodeIds.length !== 1 || !onDataChange) return;
    
    const nodeId = selectedNodeIds[0];
    const node = diagramNodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Copy and immediately paste
    diagramClipboard.copyNode(node);
    const newNode = diagramClipboard.pasteNode(diagramNodes, lifelines);
    if (newNode) {
      onDataChange({ ...data, nodes: [...diagramNodes, newNode] });
      // Select the new node
      setSelectedNodeIds([newNode.id]);
    }
  }, [selectedNodeIds, diagramNodes, lifelines, data, onDataChange, diagramClipboard]);

  // Duplicate selected lifeline handler
  const handleDuplicateLifeline = useCallback(() => {
    if (!selectedLifelineId || !onDataChange) return;
    
    const lifeline = lifelines.find(l => l.id === selectedLifelineId);
    if (!lifeline) return;
    
    diagramClipboard.copyLifeline(lifeline);
    const newLifeline = diagramClipboard.pasteLifeline(lifelines);
    if (newLifeline) {
      onDataChange({ ...data, lifelines: [...lifelines, newLifeline] });
      setSelectedLifelineId(newLifeline.id);
    }
  }, [selectedLifelineId, lifelines, data, onDataChange, diagramClipboard]);

  // Keyboard shortcuts for process creation, deletion, navigation, and copy/paste
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore keyboard events when typing in inputs or textareas
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      // Copy (Ctrl+C / Cmd+C)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && !readOnly) {
        event.preventDefault();
        
        if (selectedNodeIds.length === 1) {
          const node = diagramNodes.find(n => n.id === selectedNodeIds[0]);
          if (node) {
            diagramClipboard.copyNode(node);
          }
        } else if (selectedLifelineId) {
          const lifeline = lifelines.find(l => l.id === selectedLifelineId);
          if (lifeline) {
            diagramClipboard.copyLifeline(lifeline);
          }
        } else if (selectedProcessId) {
          const process = (data.processes || []).find(p => p.id === selectedProcessId);
          if (process) {
            diagramClipboard.copyProcess(process);
          }
        }
        return;
      }
      
      // Paste (Ctrl+V / Cmd+V)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && !readOnly && onDataChange) {
        event.preventDefault();
        
        if (diagramClipboard.clipboardType === 'node') {
          const newNode = diagramClipboard.pasteNode(diagramNodes, lifelines);
          if (newNode) {
            onDataChange({ ...data, nodes: [...diagramNodes, newNode] });
            setSelectedNodeIds([newNode.id]);
          }
        } else if (diagramClipboard.clipboardType === 'lifeline') {
          const newLifeline = diagramClipboard.pasteLifeline(lifelines);
          if (newLifeline) {
            onDataChange({ ...data, lifelines: [...lifelines, newLifeline] });
            setSelectedLifelineId(newLifeline.id);
          }
        } else if (diagramClipboard.clipboardType === 'process') {
          const result = diagramClipboard.pasteProcess(data.processes || [], diagramNodes);
          if (result) {
            onDataChange({ 
              ...data, 
              processes: [...(data.processes || []), result.process],
              nodes: result.updatedNodes
            });
            setSelectedProcessId(result.process.id);
          }
        }
        return;
      }
      
      // Escape key handling
      if (event.key === 'Escape') {
        if (selectedAnchorId || processCreationMode === 'selecting-process') {
          setSelectedAnchorId(null);
          setAnchorTooltipPosition(null);
          setProcessCreationMode('none');
        }
        // Clear all selections
        setSelectedNodeIds([]);
        setToolbarPosition(null);
        setSelectedProcessId(null);
        setProcessToolbarPosition(null);
        setSelectedLifelineId(null);
        setLifelineToolbarPosition(null);
        return;
      }
      
      // Delete/Backspace key handling
      if ((event.key === 'Delete' || event.key === 'Backspace') && !readOnly && onDataChange) {
        event.preventDefault();
        
        // Delete selected nodes
        if (selectedNodeIds.length > 0) {
          // Collect all anchor IDs from nodes being deleted
          const deletedAnchorIds = new Set<string>();
          for (const nodeId of selectedNodeIds) {
            const node = diagramNodes.find(n => n.id === nodeId);
            if (node?.anchors) {
              for (const anchor of node.anchors) {
                deletedAnchorIds.add(anchor.id);
              }
            }
          }
          const updatedNodes = diagramNodes.filter(n => !selectedNodeIds.includes(n.id));
          const updatedProcesses = (data.processes || [])
            .map(process => ({
              ...process,
              anchorIds: process.anchorIds.filter(anchorId => !deletedAnchorIds.has(anchorId))
            }))
            .filter(process => process.anchorIds.length > 0);
          
          onDataChange({
            ...data,
            nodes: updatedNodes,
            processes: updatedProcesses
          });
          setSelectedNodeIds([]);
          setToolbarPosition(null);
          return;
        }
        
        // Delete selected lifeline
        if (selectedLifelineId) {
          const updatedLifelines = lifelines.filter(l => l.id !== selectedLifelineId);
          const deletedAnchorIds = new Set<string>();
          diagramNodes.forEach(node => {
            if (node.anchors?.some(anchor => anchor.lifelineId === selectedLifelineId)) {
              node.anchors.forEach(anchor => deletedAnchorIds.add(anchor.id));
            }
          });
          const updatedNodes = diagramNodes.filter(node => 
            !node.anchors?.some(anchor => anchor.lifelineId === selectedLifelineId)
          );
          const updatedProcesses = (data.processes || [])
            .map(process => ({
              ...process,
              anchorIds: process.anchorIds.filter(anchorId => !deletedAnchorIds.has(anchorId))
            }))
            .filter(process => process.anchorIds.length > 0);
          
          onDataChange({ ...data, lifelines: updatedLifelines, nodes: updatedNodes, processes: updatedProcesses });
          setSelectedLifelineId(null);
          setLifelineToolbarPosition(null);
          return;
        }
        
        // Delete selected process
        if (selectedProcessId) {
          const updatedProcesses = (data.processes || []).filter(p => p.id !== selectedProcessId);
          onDataChange({ ...data, processes: updatedProcesses });
          setSelectedProcessId(null);
          setProcessToolbarPosition(null);
          return;
        }
      }
      
      // Arrow key navigation for nodes
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        // Navigate between lifelines
        if (selectedLifelineId && lifelines.length > 1) {
          event.preventDefault();
          const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
          const currentIdx = sortedLifelines.findIndex(l => l.id === selectedLifelineId);
          
          if (event.key === 'ArrowLeft' && currentIdx > 0) {
            const newLifeline = sortedLifelines[currentIdx - 1];
            setSelectedLifelineId(newLifeline.id);
          } else if (event.key === 'ArrowRight' && currentIdx < sortedLifelines.length - 1) {
            const newLifeline = sortedLifelines[currentIdx + 1];
            setSelectedLifelineId(newLifeline.id);
          } else if ((event.key === 'ArrowDown') && diagramNodes.length > 0) {
            // Move from lifeline to first node on that lifeline
            const lifelineNodes = diagramNodes
              .filter(n => n.anchors?.some(a => a.lifelineId === selectedLifelineId))
              .sort((a, b) => (a.yPosition || 0) - (b.yPosition || 0));
            if (lifelineNodes.length > 0) {
              setSelectedLifelineId(null);
              setLifelineToolbarPosition(null);
              setSelectedNodeIds([lifelineNodes[0].id]);
            }
          }
          return;
        }
        
        // Navigate between nodes
        if (selectedNodeIds.length === 1 && diagramNodes.length > 1) {
          event.preventDefault();
          const currentNodeId = selectedNodeIds[0];
          const currentNode = diagramNodes.find(n => n.id === currentNodeId);
          if (!currentNode) return;
          
          const currentLifelineId = currentNode.anchors?.[0]?.lifelineId;
          const currentY = currentNode.yPosition || 0;
          
          let nextNode: DiagramNode | undefined;
          
          if (event.key === 'ArrowUp') {
            // Find node above on same lifeline, or go to lifeline header
            const sameLifelineNodes = diagramNodes
              .filter(n => n.anchors?.some(a => a.lifelineId === currentLifelineId) && (n.yPosition || 0) < currentY)
              .sort((a, b) => (b.yPosition || 0) - (a.yPosition || 0));
            
            if (sameLifelineNodes.length > 0) {
              nextNode = sameLifelineNodes[0];
            } else if (currentLifelineId) {
              // Move to the lifeline header
              setSelectedNodeIds([]);
              setToolbarPosition(null);
              setSelectedLifelineId(currentLifelineId);
              return;
            }
          } else if (event.key === 'ArrowDown') {
            // Find node below on same lifeline
            const sameLifelineNodes = diagramNodes
              .filter(n => n.anchors?.some(a => a.lifelineId === currentLifelineId) && (n.yPosition || 0) > currentY)
              .sort((a, b) => (a.yPosition || 0) - (b.yPosition || 0));
            nextNode = sameLifelineNodes[0];
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            // Find node on adjacent lifeline at similar Y position
            const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
            const currentLifelineIdx = sortedLifelines.findIndex(l => l.id === currentLifelineId);
            const targetLifelineIdx = event.key === 'ArrowLeft' ? currentLifelineIdx - 1 : currentLifelineIdx + 1;
            
            if (targetLifelineIdx >= 0 && targetLifelineIdx < sortedLifelines.length) {
              const targetLifelineId = sortedLifelines[targetLifelineIdx].id;
              const targetLifelineNodes = diagramNodes
                .filter(n => n.anchors?.some(a => a.lifelineId === targetLifelineId));
              
              if (targetLifelineNodes.length > 0) {
                // Find closest node by Y position
                nextNode = targetLifelineNodes.reduce((closest, node) => {
                  const closestDist = Math.abs((closest.yPosition || 0) - currentY);
                  const nodeDist = Math.abs((node.yPosition || 0) - currentY);
                  return nodeDist < closestDist ? node : closest;
                });
              }
            }
          }
          
          if (nextNode) {
            setSelectedNodeIds([nextNode.id]);
          }
          return;
        }
        
        // If no selection, select first node or lifeline
        if (selectedNodeIds.length === 0 && !selectedLifelineId && !selectedProcessId) {
          event.preventDefault();
          if (diagramNodes.length > 0) {
            const sortedNodes = [...diagramNodes].sort((a, b) => (a.yPosition || 0) - (b.yPosition || 0));
            setSelectedNodeIds([sortedNodes[0].id]);
          } else if (lifelines.length > 0) {
            const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
            setSelectedLifelineId(sortedLifelines[0].id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnchorId, processCreationMode, selectedNodeIds, selectedLifelineId, selectedProcessId, diagramNodes, lifelines, data, readOnly, onDataChange, diagramClipboard]);

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
      if (onFitViewReady) {
        onFitViewReady(() => {
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
      setTimeout(() => {
        try {
          fitView({ padding: 0.1, duration: 0 });
          setTimeout(() => {
            if (onReady) {
              onReady();
            }
          }, 300);
        } catch (error) {
          // Still call onReady even if fitView fails
          if (onReady) {
            onReady();
          }
        }
      }, 100);
    } else if (isRenderMode && nodesCount > 0 && edgesCount > 0 && hasInitialViewport) {
      // If we have initial viewport, just wait for layout then signal ready
      setTimeout(() => {
        if (onReady) {
          onReady();
        }
      }, 200);
    }
  }, [isRenderMode, nodesCount, edgesCount, fitView, onReady, hasInitialViewport, hasUserInteracted, allNodesMeasured, sequenceNodesCount, measuredHeightsCount]);
  
  return null;
};

  // Add node on lifeline callback
  const handleAddNodeOnLifeline = useCallback((sourceLifelineId: string, yPosition: number, lifelineHeight: number) => {
    if (!onDataChange || lifelines.length === 0) {
      return;
    }
    
    const nodeId = generateNodeId(diagramNodes);
    const [anchorId1, anchorId2] = generateAnchorIds(diagramNodes);
    
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
      const newLifelineId = generateLifelineId(lifelines);
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
    onDataChange({ ...data, lifelines: updatedLifelines, nodes: finalNodes });
  }, [diagramNodes, lifelines, data, onDataChange]);

  // Calculate layout with validation and recovery
  const { nodes: layoutNodes, edges: layoutEdges, calculatedYPositions } = useMemo(() => {
    // Skip recalculation during active drag operations - use ref for synchronous check
    if (isDraggingRef.current) {
      return previousLayoutRef.current;
    }
    
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
      // Check if nodes have anchors
      const nodesWithoutAnchors = diagramNodes.filter(n => !n.anchors || n.anchors.length !== 2);
      if (nodesWithoutAnchors.length > 0) {
        // Attempt to regenerate anchors for nodes that are missing them
        if (onDataChange && lifelines.length > 0) {
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
              
              // Preserve existing anchor IDs if they exist, only generate new ones if truly missing
              const existingAnchor0 = node.anchors?.[0];
              const existingAnchor1 = node.anchors?.[1];
              
              // Generate fallback IDs only if needed
              const fallbackIds = (!existingAnchor0?.id || !existingAnchor1?.id) 
                ? generateAnchorIds(diagramNodes) 
                : [existingAnchor0.id, existingAnchor1.id];
              
              const newAnchors: [AnchorNodeType, AnchorNodeType] = [
                { 
                  id: existingAnchor0?.id || fallbackIds[0], 
                  lifelineId: existingAnchor0?.lifelineId || sourceLifeline.id,
                  anchorType: existingAnchor0?.anchorType || 'source'
                },
                { 
                  id: existingAnchor1?.id || fallbackIds[1], 
                  lifelineId: existingAnchor1?.lifelineId || targetLifeline.id,
                  anchorType: existingAnchor1?.anchorType || 'target'
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
            onDataChange({ ...data, nodes: repairedNodes });
          }, 0);
        }
      }
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
      onDataChange({ ...data, nodes: updatedNodes });
    }
  }, [calculatedYPositions, onDataChange, diagramNodes, data, isDragging]);

  // Handle node height changes
  const handleNodeHeightChange = useCallback((nodeId: string, height: number) => {
    setNodeHeights(prev => {
      const oldHeight = prev.get(nodeId);
      if (oldHeight !== height) {
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
        
        return {
          ...node,
          draggable: !readOnly && !isRenderMode && isInteractive,
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
        
        // Check data changes (especially for process, lifeline, anchor, and sequence nodes)
        if (node.type === 'processNode' || node.type === 'columnLifeline' || node.type === 'anchorNode' || node.type === 'sequenceNode') {
          const nodeData = node.data as any;
          const prevData = prev.data as any;
          // Compare dataVersion which changes when properties or theme changes
          if (nodeData?.dataVersion !== prevData?.dataVersion) {
            return true;
          }
        }
        
        return false;
      });
    
    if (nodesChanged) {
      // Log what we're about to apply
      const sequenceNodePositions = nodesWithHandlers
        .filter(n => n.type === 'sequenceNode')
        .map(n => ({ id: n.id, y: n.position.y }));
      console.log('🔄 useEffect syncing nodesWithHandlers to setNodes:', sequenceNodePositions);
      
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
    // Block position and selection changes when interactivity is disabled
    if (!isInteractive) {
      const allowedChanges = changes.filter((c: any) => 
        c.type !== 'position' && c.type !== 'select'
      );
      if (allowedChanges.length > 0) {
        handleNodesChange(allowedChanges);
      }
      return;
    }
    
    // Store initial positions when drag starts
    const dragStartChange = changes.find((c: any) => c.type === 'position' && c.dragging === true);
    if (dragStartChange) {
      isDraggingRef.current = true;
      setIsDragging(true);
      
      const startPositions = new Map<string, { x: number; y: number }>();
      nodes.forEach(n => {
        // Store positions for the dragged node and any selected sequence nodes
        if (n.id === dragStartChange.id || (selectedNodeIds.includes(n.id) && n.type === 'sequenceNode') || n.type === 'columnLifeline') {
          startPositions.set(n.id, { x: n.position.x, y: n.position.y });
        }
      });
      setDragStartPositions(startPositions);
    }
    
    // Detect drag end for sequence nodes
    const dragEndChange = changes.find((c: any) => c.type === 'position' && c.dragging === false && c.position);
    if (dragEndChange && dragEndChange.type === 'position') {
      const draggedNode = nodes.find(n => n.id === dragEndChange.id);
      
      console.log(`🔲 DRAG END detected for node: ${dragEndChange.id}, type: ${draggedNode?.type}`);
      
      // Only process drag end for sequence nodes
      if (draggedNode?.type === 'sequenceNode') {
        isDraggingRef.current = false;
        setIsDragging(false);
        setLayoutVersion(v => v + 1);
        
        // Update the dragged node's yPosition to its new desired position
        // The matrix layout in calculateSequenceLayout will handle the rest
        if (onDataChange) {
          const dragEndNodeId = dragEndChange.id;
          const dragEndPosition = dragEndChange.position;
          
          // Get node height to calculate center Y
          const diagramNode = diagramNodes.find(n => n.id === dragEndNodeId);
          const nodeConfig = diagramNode ? getNodeTypeConfig(diagramNode.type) : null;
          const nodeHeight = nodeHeights.get(dragEndNodeId) || nodeConfig?.defaultHeight || 70;
          
          // Calculate the new center Y position for the dragged node
          const newCenterY = dragEndPosition.y + (nodeHeight / 2);
          
          console.log(`🔲 MATRIX: Updating ${dragEndNodeId} yPosition to ${newCenterY}, triggering layout recalc`);
          
          // Update only the dragged node's yPosition - the matrix layout will recalculate all positions
          const updatedNodes = diagramNodes.map(node => {
            if (node.id === dragEndNodeId) {
              return {
                ...node,
                yPosition: newCenterY
              };
            }
            return node;
          });
          
          onDataChange({ ...data, nodes: updatedNodes });
          
          // Don't apply the dropped position to React Flow - the layout will recalculate
          // Filter out the position change for this node entirely
          const filteredChanges = changes.filter((c: any) => 
            !(c.type === 'position' && c.id === dragEndNodeId)
          );
          
          if (filteredChanges.length > 0) {
            handleNodesChange(filteredChanges);
          }
          return; // Exit early, we handled this drag end
        }
      } else {
        // For non-sequence nodes (like lifelines), reset drag state and trigger layout recalc
        isDraggingRef.current = false;
        setIsDragging(false);
        setLayoutVersion(v => v + 1); // Trigger layout recalc to regenerate process nodes
      }
    }
    
    // Constrain sequence node movement to vertical only during drag AND snap to slots
    const SLOT_GAP = 50; // Gap between slots - must match sequenceLayout.ts
    const SLOT_START_Y = 140; // LIFELINE_HEADER_HEIGHT (100) + margin (40) - must match sequenceLayout.ts
    const MAX_SLOTS = 50;
    const DEFAULT_NODE_HEIGHT = 70;
    
    // Build lifeline position map for lane calculation
    const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
    const lifelinePositions = new Map<string, number>();
    sortedLifelines.forEach((lifeline, index) => {
      lifelinePositions.set(lifeline.id, index);
    });
    
    // Compute span for a node
    const computeSpan = (node: DiagramNode) => {
      if (!node.anchors || node.anchors.length < 2) return null;
      const ll0Pos = lifelinePositions.get(node.anchors[0].lifelineId);
      const ll1Pos = lifelinePositions.get(node.anchors[1].lifelineId);
      if (ll0Pos === undefined || ll1Pos === undefined) return null;
      const leftLane = Math.min(ll0Pos, ll1Pos);
      const rightLane = Math.max(ll0Pos, ll1Pos) - 1;
      return { leftLane, rightLane, width: rightLane - leftLane + 1 };
    };
    
    // Check conflicts
    const conflicts = (span: any, slotNodes: any[], positions: Map<string, any>) => {
      for (const n of slotNodes) {
        const other = positions.get(n.id);
        if (!other) continue;
        const ok = (span.rightLane + 2 <= other.leftLane) || (other.rightLane + 2 <= span.leftLane);
        if (!ok) return true;
      }
      return false;
    };
    
    // Calculate spans for all nodes
    const nodeSpans = new Map<string, any>();
    diagramNodes.forEach(node => {
      const span = computeSpan(node);
      if (span) nodeSpans.set(node.id, span);
    });
    
    // Find the dragging node to determine target slot
    const draggingChange = changes.find((c: any) => c.type === 'position' && c.dragging);
    let draggedSlot = 0;
    
    // Pre-calculate slot heights based on current node heights (before placement)
    // This helps determine which slot the cursor is in
    const preSlotHeights: number[] = [];
    for (let s = 0; s < MAX_SLOTS; s++) {
      preSlotHeights.push(DEFAULT_NODE_HEIGHT);
    }
    // Update with actual node heights based on their current slots
    diagramNodes.forEach(node => {
      const nodeY = node.yPosition ?? 0;
      const avgSlotHeight = DEFAULT_NODE_HEIGHT + SLOT_GAP;
      const estimatedSlot = Math.max(0, Math.round((nodeY - SLOT_START_Y) / avgSlotHeight));
      const clampedSlot = Math.min(MAX_SLOTS - 1, estimatedSlot);
      const nodeH = nodeHeights.get(node.id) || DEFAULT_NODE_HEIGHT;
      if (nodeH > preSlotHeights[clampedSlot]) {
        preSlotHeights[clampedSlot] = nodeH;
      }
    });
    
    if (draggingChange) {
      const draggedNode = nodes.find(n => n.id === draggingChange.id);
      if (draggedNode?.type === 'sequenceNode') {
        const draggedNodeHeight = nodeHeights.get(draggingChange.id) || DEFAULT_NODE_HEIGHT;
        const newY = draggingChange.position?.y || draggedNode.position.y;
        const draggedCenterY = newY + (draggedNodeHeight / 2);
        
        // Calculate slot by finding which slot boundary the cursor center falls into
        // Account for accumulated heights of previous slots
        let accumulatedY = SLOT_START_Y;
        draggedSlot = 0;
        for (let s = 0; s < MAX_SLOTS; s++) {
          const slotHeight = preSlotHeights[s];
          const slotEnd = accumulatedY + slotHeight + SLOT_GAP;
          if (draggedCenterY < slotEnd) {
            draggedSlot = s;
            break;
          }
          accumulatedY = slotEnd;
          draggedSlot = s + 1;
        }
        draggedSlot = Math.min(MAX_SLOTS - 1, draggedSlot);
      }
    }
    
    // Matrix layout: place dragged node first, then others in order
    const positions = new Map<string, any>();
    const slots: DiagramNode[][] = Array.from({ length: MAX_SLOTS }, () => []);
    
    // Place dragged node at its target slot
    if (draggingChange) {
      const draggedDiagramNode = diagramNodes.find(n => n.id === draggingChange.id);
      if (draggedDiagramNode && nodeSpans.has(draggingChange.id)) {
        const span = nodeSpans.get(draggingChange.id);
        const clampedSlot = Math.min(MAX_SLOTS - 1, Math.max(0, draggedSlot));
        positions.set(draggingChange.id, { slot: clampedSlot, ...span });
        slots[clampedSlot].push(draggedDiagramNode);
      }
    }
    
    // Sort other nodes by original Y position
    const otherNodes = diagramNodes
      .filter(n => n.id !== draggingChange?.id && nodeSpans.has(n.id))
      .sort((a, b) => (a.yPosition ?? 0) - (b.yPosition ?? 0));
    
    // Place other nodes at first available slot
    otherNodes.forEach(node => {
      const span = nodeSpans.get(node.id);
      let placedSlot = 0;
      for (let s = 0; s < MAX_SLOTS; s++) {
        if (!conflicts(span, slots[s], positions)) {
          placedSlot = s;
          break;
        }
      }
      positions.set(node.id, { slot: placedSlot, ...span });
      slots[placedSlot].push(node);
    });
    
    // Calculate dynamic slot heights based on the tallest node in each slot
    const slotHeights: number[] = [];
    for (let s = 0; s < MAX_SLOTS; s++) {
      if (slots[s].length === 0) {
        slotHeights.push(DEFAULT_NODE_HEIGHT);
      } else {
        let maxHeight = 0;
        slots[s].forEach(node => {
          const h = nodeHeights.get(node.id) || DEFAULT_NODE_HEIGHT;
          if (h > maxHeight) maxHeight = h;
        });
        slotHeights.push(maxHeight);
      }
    }
    
    // Calculate cumulative Y positions for each slot (center Y)
    const slotCenterYPositions: number[] = [];
    let currentY = SLOT_START_Y;
    for (let s = 0; s < MAX_SLOTS; s++) {
      const slotHeight = slotHeights[s];
      const centerY = currentY + (slotHeight / 2);
      slotCenterYPositions.push(centerY);
      currentY += slotHeight + SLOT_GAP;
    }
    
    // Helper to get center Y for a slot
    const slotToY = (slot: number): number => {
      return slotCenterYPositions[Math.min(slot, slotCenterYPositions.length - 1)];
    };
    
    // Constrain the dragging node's position
    const constrainedChanges = changes.map((change: any) => {
      if (change.type === 'position' && change.dragging) {
        const node = nodes.find(n => n.id === change.id);
        if (node?.type === 'sequenceNode') {
          const pos = positions.get(change.id);
          if (pos) {
            const snappedCenterY = slotToY(pos.slot);
            const nodeH = nodeHeights.get(change.id) || DEFAULT_NODE_HEIGHT;
            const snappedTopY = snappedCenterY - (nodeH / 2);
            
            // Lock X position to the original position from when drag started
            const startPos = dragStartPositions.get(node.id);
            const lockedX = startPos?.x ?? node.position.x;
            
            return {
              ...change,
              position: {
                x: lockedX,
                y: snappedTopY
              }
            };
          }
        }
      }
      return change;
    });

    handleNodesChange(constrainedChanges);
    
    // Real-time update of all nodes during drag
    if (draggingChange) {
      // Build calculated Y positions map for process layout (center Y)
      const calculatedYPositions = new Map<string, number>();
      positions.forEach((pos, nodeId) => {
        calculatedYPositions.set(nodeId, slotToY(pos.slot));
      });
      
      // Build nodes with updated yPosition for process layout calculation
      const nodesWithUpdatedPositions: DiagramNode[] = diagramNodes.map(node => ({
        ...node,
        yPosition: calculatedYPositions.get(node.id) ?? node.yPosition
      }));
      
      // Extract anchors from nodes
      const allAnchors: AnchorNodeType[] = nodesWithUpdatedPositions.flatMap(node => 
        node.anchors?.map(anchor => ({ ...anchor })) || []
      );
      
      // Calculate process layout with new positions
      // Use same dynamic spacing logic as calculateSequenceLayout
      const LIFELINE_WIDTH = 300;
      const NODE_HORIZONTAL_PADDING = 150;
      const horizontalSpacing = 100;
      const PROCESS_BOX_WIDTH = 50;
      const PROCESS_HORIZONTAL_GAP = 8;
      
      // Calculate process counts per lifeline for dynamic spacing
      const lifelineProcessCounts = new Map<string, number>();
      if (data.processes && data.processes.length > 0) {
        sortedLifelines.forEach(lifeline => {
          const processesOnLifeline = data.processes!.filter(process => {
            return process.anchorIds.some(id => {
              const anchor = allAnchors.find(a => a.id === id);
              return anchor?.lifelineId === lifeline.id;
            });
          });
          lifelineProcessCounts.set(lifeline.id, processesOnLifeline.length);
        });
      }
      
      const lifelineXPositions = new Map<string, number>();
      let currentX = NODE_HORIZONTAL_PADDING;
      sortedLifelines.forEach((lifeline) => {
        lifelineXPositions.set(lifeline.id, currentX);
        
        // Calculate spacing after this lifeline (same logic as sequenceLayout.ts)
        const processCount = lifelineProcessCounts.get(lifeline.id) || 0;
        const maxParallelOnThisLifeline = Math.min(processCount, 3);
        const processSpacingForThisLifeline = maxParallelOnThisLifeline > 0 
          ? (PROCESS_BOX_WIDTH * maxParallelOnThisLifeline) + (PROCESS_HORIZONTAL_GAP * (maxParallelOnThisLifeline - 1)) + 20
          : 0;
        
        currentX += LIFELINE_WIDTH + horizontalSpacing + processSpacingForThisLifeline;
      });
      
      const newProcessNodes = data.processes && data.processes.length > 0
        ? calculateProcessLayout(
            data.processes,
            allAnchors,
            nodesWithUpdatedPositions,
            lifelineXPositions,
            activeTheme,
            nodeHeights,
            calculatedYPositions
          )
        : [];
      
      // Update all node, anchor, and process positions in React Flow
      setNodes(currentNodes => {
        // Filter out old process nodes
        const nonProcessNodes = currentNodes.filter(n => n.type !== 'processNode');
        
        // Update sequence and anchor nodes
        const updatedNodes = nonProcessNodes.map(n => {
          if (n.type === 'sequenceNode') {
            const pos = positions.get(n.id);
            if (pos) {
              const nodeCenterY = slotToY(pos.slot);
              const nodeH = nodeHeights.get(n.id) || DEFAULT_NODE_HEIGHT;
              const topY = nodeCenterY - (nodeH / 2);
              return { ...n, position: { ...n.position, y: topY } };
            }
          }
          if (n.type === 'anchorNode') {
            const anchorData = n.data as any;
            const connectedNodeId = anchorData?.connectedNodeId;
            if (connectedNodeId) {
              const pos = positions.get(connectedNodeId);
              if (pos) {
                const nodeCenterY = slotToY(pos.slot);
                return { ...n, position: { ...n.position, y: nodeCenterY - 8 } };
              }
            }
          }
          return n;
        });
        
        // Add updated process nodes
        return [...updatedNodes, ...newProcessNodes];
      });
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
        
        // Find which lifeline this anchor should snap to based on X position
        const anchorX = moveChange.position.x + 8; // Add half width to get center
        let closestLifelineId = originalLifelineId;
        let closestLifelineX = originalAnchorX; // Default to current position
        let minDistance = Infinity;
        
        // Use layout positions to find closest lifeline
        // Note: lifeline node position.x is where anchors are positioned (left edge of lifeline)
        const sortedLifelines = [...lifelines].sort((a, b) => a.order - b.order);
        const lifelineLayoutNodes = layoutNodes.filter(n => n.type === 'columnLifeline');
        
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
        
        // Check if the anchor is part of a process - if so, it cannot be moved to a different lifeline
        const anchorIsInProcess = anchorData?.isInProcess || false;
        
        // If drop position is too far from any lifeline, snap back to original position from layout
        const SNAP_THRESHOLD = 150; // Max distance in pixels to consider a valid snap
        const shouldSnapBack = minDistance > SNAP_THRESHOLD || anchorIsInProcess;
        
        if (shouldSnapBack) {
          // Revert to original lifeline and use the anchor's layout position (includes process offset)
          closestLifelineId = originalLifelineId;
          closestLifelineX = originalAnchorX;
        }
        
        // Snap anchor to correct X position
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
              handleLifelineUpdate(lifelineId, { order: newOrder });
            } else {
              // Order didn't change - force snap back to correct position from layout
              const currentLifelineLayout = lifelineLayoutNodes.find(n => n.id === `lifeline-${lifelineId}`);
              const correctX = currentLifelineLayout?.position.x || (oldOrder * (300 + 100) + 150);
              
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
      } else if (movedNode?.type === 'sequenceNode') {
        // Sequence node positions are handled by the slot-based drag-end logic above (lines 746-877)
        // Do NOT recalculate here as it would overwrite the slot-based positions
        // Just update anchor positions visually to match the new node position
        const movedDiagramNode = diagramNodes.find(n => n.id === moveChange.id);
        const nodeConfig = movedDiagramNode ? getNodeTypeConfig(movedDiagramNode.type) : null;
        const nodeHeight = nodeHeights.get(moveChange.id) || nodeConfig?.defaultHeight || 70;
        const nodeCenterY = moveChange.position.y + (nodeHeight / 2);
        
        setNodes(currentNodes =>
          currentNodes.map(n => {
            const anchorData = n.data as any;
            if (n.type === 'anchorNode' && anchorData?.connectedNodeId === moveChange.id) {
              return { ...n, position: { x: n.position.x, y: nodeCenterY - 8 } };
            }
            return n;
          })
        );
      }
      // NOTE: Sequence node position updates are handled exclusively by the slot-based 
      // drag-end logic above (lines ~753-946). Do NOT add alternative positioning code here
      // as it would conflict and cause unpredictable behavior.
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
      // Collect all anchor IDs from nodes being deleted
      const deletedAnchorIds = new Set<string>();
      for (const nodeId of selectedNodeIds) {
        const node = diagramNodes.find(n => n.id === nodeId);
        if (node?.anchors) {
          for (const anchor of node.anchors) {
            deletedAnchorIds.add(anchor.id);
          }
        }
      }

      const updatedNodes = diagramNodes.filter(n => !selectedNodeIds.includes(n.id));
      
      // Remove deleted anchors from processes and filter out empty processes
      const updatedProcesses = (data.processes || [])
        .map(process => ({
          ...process,
          anchorIds: process.anchorIds.filter(anchorId => !deletedAnchorIds.has(anchorId))
        }))
        .filter(process => process.anchorIds.length > 0);
      
      onDataChange({
        ...data,
        nodes: updatedNodes,
        processes: updatedProcesses
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
    
    const updatedLifelines = lifelines.filter(l => l.id !== selectedLifelineId);
    
    // Collect anchor IDs from nodes connected to the deleted lifeline
    const deletedAnchorIds = new Set<string>();
    diagramNodes.forEach(node => {
      if (node.anchors?.some(anchor => anchor.lifelineId === selectedLifelineId)) {
        node.anchors.forEach(anchor => deletedAnchorIds.add(anchor.id));
      }
    });
    
    const updatedNodes = diagramNodes.filter(node => 
      !node.anchors?.some(anchor => anchor.lifelineId === selectedLifelineId)
    );
    
    // Remove deleted anchors from processes and filter out empty processes
    const updatedProcesses = (data.processes || [])
      .map(process => ({
        ...process,
        anchorIds: process.anchorIds.filter(anchorId => !deletedAnchorIds.has(anchorId))
      }))
      .filter(process => process.anchorIds.length > 0);
    
    onDataChange({ ...data, lifelines: updatedLifelines, nodes: updatedNodes, processes: updatedProcesses });
    setSelectedLifelineId(null);
    setLifelineToolbarPosition(null);
  }, [selectedLifelineId, lifelines, diagramNodes, data, onDataChange]);
  
  const handleLifelineUpdate = useCallback((lifelineId: string, updates: Partial<Lifeline>) => {
    if (!onDataChange) return;
    
    const oldOrderMap = new Map<string, number>();
    lifelines.forEach(l => oldOrderMap.set(l.id, l.order));
    
    let updatedLifelines: Lifeline[];
    let orderChanged = false;
    
    if (updates.order !== undefined) {
      const oldOrder = oldOrderMap.get(lifelineId);
      const newOrder = updates.order;
      
      if (oldOrder !== newOrder) {
        orderChanged = true;
        updatedLifelines = lifelines.map(l => {
          if (l.id === lifelineId) {
            return { ...l, ...updates };
          } else if (oldOrder !== undefined && newOrder < oldOrder) {
            if (l.order >= newOrder && l.order < oldOrder) {
              return { ...l, order: l.order + 1 };
            }
          } else if (oldOrder !== undefined && newOrder > oldOrder) {
            if (l.order > oldOrder && l.order <= newOrder) {
              return { ...l, order: l.order - 1 };
            }
          }
          return l;
        });
      } else {
        updatedLifelines = lifelines.map(l =>
          l.id === lifelineId ? { ...l, ...updates } : l
        );
      }
    } else {
      updatedLifelines = lifelines.map(l =>
        l.id === lifelineId ? { ...l, ...updates } : l
      );
    }
    
    if (orderChanged) {
      setLayoutVersion(prev => prev + 1);
    }
    
    onDataChange({ 
      ...data, 
      lifelines: updatedLifelines
    });
  }, [lifelines, diagramNodes, data, onDataChange]);
  
  const handleLifelineDelete = useCallback((lifelineId: string) => {
    if (!onDataChange) return;
    
    const updatedLifelines = lifelines.filter(l => l.id !== lifelineId);
    const updatedNodes = diagramNodes.filter(node => 
      !node.anchors?.some(anchor => anchor.lifelineId === lifelineId)
    );
    
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
    
    const updatedNodes = diagramNodes.map(n =>
      n.id === nodeId ? { ...n, ...updates } : n
    );
    
    // Also update the selectedNode state so the editor shows current values
    const updatedNode = updatedNodes.find(n => n.id === nodeId);
    if (updatedNode) {
      setSelectedNode(updatedNode);
    }
    
    onDataChange({ ...data, nodes: updatedNodes });
    
    // Force layout recalculation after a delay to allow the node to re-render
    setTimeout(() => {
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
    // Disable tooltips in render mode to prevent viewport resets
    if (isRenderMode) return;
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
  }, [diagramNodes, data.processes, isRenderMode]);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredElement(null);
  }, []);


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
          nodesFocusable={false}
          edgesFocusable={false}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
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
                  onDuplicate={selectedNodeIds.length === 1 ? handleDuplicateNode : undefined}
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
                  onDuplicate={handleDuplicateLifeline}
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