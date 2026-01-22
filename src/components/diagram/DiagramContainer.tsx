
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { DiagramEmpty } from './DiagramEmpty';
import { DiagramHeader } from './DiagramHeader';
import { DiagramFlow } from './DiagramFlow';
import { useDiagramNodes } from './hooks/useDiagramNodes';
import { toast } from 'sonner';
import { CollapsedState } from '@/lib/diagram/types';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';
import { useCollisionAvoidance } from '@/hooks/useCollisionAvoidance';

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
    schemaKey,
    setNodes,
    clearStoredPositions
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

  // Auto-apply collision resolution after nodes are rendered and measured
  // We wait a short time for React Flow to measure the nodes
  useEffect(() => {
    if (!smartSpacing || !nodes || nodes.length < 2) return;
    
    // Clear any pending timeout
    if (collisionTimeoutRef.current) {
      clearTimeout(collisionTimeoutRef.current);
    }
    
    // Wait for nodes to be measured by React Flow (typically ~100-200ms after render)
    collisionTimeoutRef.current = window.setTimeout(() => {
      // Check if nodes have been measured
      const hasMeasuredNodes = nodes.some((node: any) => node.measured?.width && node.measured?.height);
      if (hasMeasuredNodes) {
        resolveAnimatedIfEnabled(nodes, setNodes, true);
      }
    }, 250);
    
    return () => {
      if (collisionTimeoutRef.current) {
        clearTimeout(collisionTimeoutRef.current);
      }
    };
  }, [schemaKey]); // Only run when schema changes, not on every node update

  // Check if there are any stored node positions
  const hasStoredPositions = Object.keys(nodePositionsRef.current).length > 0;

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
      />
    </div>
  );
};
