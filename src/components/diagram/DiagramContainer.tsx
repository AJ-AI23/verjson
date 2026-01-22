
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Node } from '@xyflow/react';
import { DiagramEmpty } from './DiagramEmpty';
import { DiagramHeader } from './DiagramHeader';
import { DiagramFlow } from './DiagramFlow';
import { useDiagramNodes } from './hooks/useDiagramNodes';
import { toast } from 'sonner';
import { CollapsedState } from '@/lib/diagram/types';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';
import { useCollisionAvoidance } from '@/hooks/useCollisionAvoidance';
import { diagramDbg } from '@/lib/diagram/diagramDebug';

const dbg = (message: string, data?: any) => diagramDbg('DiagramContainer', message, data);

interface DiagramContainerProps {
  schema: any;
  error: boolean;
  groupProperties?: boolean;
  collapsedPaths?: CollapsedState;
  maxDepth?: number;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  expandedNotationPaths?: Set<string>;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const DiagramContainer: React.FC<DiagramContainerProps> = ({ 
  schema, 
  error, 
  groupProperties = false,
  collapsedPaths = {},
  maxDepth,
  onAddNotation,
  expandedNotationPaths,
  onToggleCollapse
}) => {
  const { settings } = useEditorSettings();
  const [localMaxDepth, setLocalMaxDepth] = useState(maxDepth);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { enabled: smartSpacing, toggle: toggleSmartSpacing, resolveAnimatedIfEnabled } = useCollisionAvoidance();
  const collisionTimeoutRef = useRef<number | null>(null);
  const prevSchemaKeyRef = useRef<number>(-1);
  // Ref to always hold the latest nodes – used inside timeouts to avoid stale closures
  const nodesRef = useRef<Node[]>([]);

  // Debug: confirm the container is mounted (and whether Smart Spacing is enabled)
  useEffect(() => {
    dbg('MOUNT', {
      smartSpacing,
      collisionAvoidancePref: typeof window !== 'undefined' ? localStorage.getItem('diagram-collision-avoidance') : undefined,
    });
    return () => dbg('UNMOUNT');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Update local maxDepth when prop changes
  useEffect(() => {
    if (maxDepth !== undefined) {
      setLocalMaxDepth(maxDepth);
    }
  }, [maxDepth]);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Deep memoize the schema and collapsedPaths to prevent unnecessary re-renders
  const memoizedSchema = useMemo(() => schema, [JSON.stringify(schema)]);
  const memoizedCollapsedPaths = useMemo(() => collapsedPaths, [JSON.stringify(collapsedPaths)]);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    nodePositionsRef,
    userDraggedPositionsRef,
    schemaKey,
    setNodes,
    clearStoredPositions,
    recordUserDrag
  } = useDiagramNodes(
    memoizedSchema, 
    error, 
    groupProperties, 
    memoizedCollapsedPaths,
    localMaxDepth,
    settings.maxIndividualProperties,
    settings.maxIndividualArrayItems,
    settings.truncateAncestralBoxes
  );

  // Keep nodesRef in sync with latest nodes
  useEffect(() => {
    nodesRef.current = nodes || [];
  }, [nodes]);

  // Debug: observe node regeneration + measurement state
  useEffect(() => {
    const measuredCount = (nodes || []).filter((n: any) => n.measured?.width && n.measured?.height).length;
    dbg('nodes updated', {
      schemaKey,
      nodeCount: nodes?.length ?? 0,
      measuredCount,
    });
  }, [nodes, schemaKey]);

  // Helper function to trigger smart spacing with delay
  const triggerSmartSpacing = useCallback((delay: number = 250) => {
    dbg('triggerSmartSpacing scheduled', {
      delay,
      schemaKey,
      smartSpacing,
      nodeCount: nodes?.length ?? 0,
    });
    
    // Clear any pending timeout
    if (collisionTimeoutRef.current) {
      clearTimeout(collisionTimeoutRef.current);
    }
    
    // Wait for nodes to be measured by React Flow
    collisionTimeoutRef.current = window.setTimeout(() => {
      const currentNodes = nodes;
      const nodeCount = currentNodes?.length ?? 0;
      const measuredCount = (currentNodes || []).filter((n: any) => n.measured?.width && n.measured?.height).length;
      const hasMeasuredNodes = measuredCount > 0;

      dbg('triggerSmartSpacing fired', {
        schemaKey,
        smartSpacing,
        nodeCount,
        hasMeasuredNodes,
        measuredCount,
      });

      if (!smartSpacing) return;
      if (!currentNodes || nodeCount < 2) return;
      if (!hasMeasuredNodes) return;

      dbg('calling resolveAnimatedIfEnabled (triggerSmartSpacing)', { schemaKey });
      resolveAnimatedIfEnabled(currentNodes, setNodes, true);
    }, delay);
  }, [smartSpacing, nodes, setNodes, resolveAnimatedIfEnabled]);

  // Auto-apply collision resolution after nodes are rendered and measured
  // schemaKey changes when: schema changes OR collapsedPaths changes
  // We do NOT include `nodes` in deps to prevent clearing the timer when nodes update (measurement pass)
  useEffect(() => {
    // Skip initial render
    if (prevSchemaKeyRef.current === -1) {
      prevSchemaKeyRef.current = schemaKey;
      return;
    }
    
    // Only trigger if schemaKey actually changed
    if (prevSchemaKeyRef.current !== schemaKey) {
      dbg('schemaKey changed -> scheduling auto smart spacing', {
        prevSchemaKey: prevSchemaKeyRef.current,
        nextSchemaKey: schemaKey,
        smartSpacing,
      });
      prevSchemaKeyRef.current = schemaKey;
      
      // Clear any pending timeout
      if (collisionTimeoutRef.current) {
        clearTimeout(collisionTimeoutRef.current);
      }
      
      // Wait for nodes to be measured by React Flow (longer delay for collapse changes)
      collisionTimeoutRef.current = window.setTimeout(() => {
        // Read fresh nodes from ref
        const currentNodes = nodesRef.current;
        const nodeCount = currentNodes.length;
        const measuredCount = currentNodes.filter((n: any) => n.measured?.width && n.measured?.height).length;
        const hasMeasuredNodes = measuredCount > 0;

        dbg('auto smart spacing timeout (schemaKey effect)', {
          schemaKey,
          smartSpacing,
          nodeCount,
          hasMeasuredNodes,
          measuredCount,
        });

        if (!smartSpacing) return;
        if (nodeCount < 2) return;
        if (!hasMeasuredNodes) return;

        dbg('calling resolveAnimatedIfEnabled (schemaKey effect)', { schemaKey });
        resolveAnimatedIfEnabled(currentNodes, setNodes, true);
      }, 350);
    }
    
    return () => {
      if (collisionTimeoutRef.current) {
        clearTimeout(collisionTimeoutRef.current);
      }
    };
    // Deliberately omit `nodes` – use nodesRef inside the timeout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaKey, smartSpacing, setNodes, resolveAnimatedIfEnabled]);

  // Handle node drag stop - record user drag position and trigger smart spacing
  const handleNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    // Record this position as user-dragged (will be preserved across layout recalculations)
    recordUserDrag(node.id, node.position);
    // Trigger smart spacing with a short delay after drag ends
    triggerSmartSpacing(100);
  }, [triggerSmartSpacing, recordUserDrag]);

  // Check if there are any user-dragged node positions (these are preserved across layout recalculations)
  const hasStoredPositions = Object.keys(userDraggedPositionsRef.current).length > 0;

  const handleMaxDepthChange = (newDepth: number) => {
    setLocalMaxDepth(newDepth);
    toast.success(`Diagram depth set to ${newDepth} levels`);
  };

  const handleResetLayout = useCallback(() => {
    clearStoredPositions();
    toast.success('Layout reset to calculated positions');
  }, [clearStoredPositions]);

  const handleApplySmartSpacing = useCallback(() => {
    if (nodes && nodes.length > 1) {
      resolveAnimatedIfEnabled(nodes, setNodes, true);
    }
  }, [nodes, setNodes, resolveAnimatedIfEnabled]);

  // Early returns for edge cases
  if (error) {
    return <DiagramEmpty error={true} />;
  }

  if (!schema) {
    return <DiagramEmpty noSchema={true} />;
  }
  
  // Always render diagram when we have a schema, regardless of nodes count
  return (
    <div className={`flex flex-col flex-1 min-h-0 ${
      isFullscreen 
        ? 'fixed inset-0 z-50 bg-background' 
        : ''
    }`}>
      <DiagramHeader 
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        diagramType="schema"
        onResetLayout={handleResetLayout}
        smartSpacing={smartSpacing}
        onToggleSmartSpacing={toggleSmartSpacing}
        onApplySmartSpacing={handleApplySmartSpacing}
      />
      <DiagramFlow
        nodes={nodes || []}
        edges={edges || []}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        schemaKey={schemaKey}
        shouldFitView={nodes?.length > 0 && !hasStoredPositions}
        onAddNotation={onAddNotation}
        expandedNotationPaths={expandedNotationPaths}
        onToggleCollapse={onToggleCollapse}
        onNodeDragStop={handleNodeDragStop}
      />
    </div>
  );
};
