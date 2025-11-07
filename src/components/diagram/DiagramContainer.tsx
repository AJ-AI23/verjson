
import React, { useMemo, useState, useEffect } from 'react';
import { DiagramEmpty } from './DiagramEmpty';
import { DiagramHeader } from './DiagramHeader';
import { DiagramFlow } from './DiagramFlow';
import { useDiagramNodes } from './hooks/useDiagramNodes';
import { toast } from 'sonner';
import { CollapsedState } from '@/lib/diagram/types';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';

interface DiagramContainerProps {
  schema: any;
  error: boolean;
  groupProperties?: boolean;
  collapsedPaths?: CollapsedState;
  maxDepth?: number;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  expandedNotationPaths?: Set<string>;
}

export const DiagramContainer: React.FC<DiagramContainerProps> = ({ 
  schema, 
  error, 
  groupProperties = false,
  collapsedPaths = {},
  maxDepth,
  onAddNotation,
  expandedNotationPaths
}) => {
  const { settings } = useEditorSettings();
  const [localMaxDepth, setLocalMaxDepth] = useState(maxDepth);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    schemaKey
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

  // Show diagram based on nodes count and error state
  useEffect(() => {
    if (nodes && edges) {
      // Always show diagram even if only root node exists
    }
  }, [nodes, edges]);

  // Check if there are any stored node positions
  const hasStoredPositions = Object.keys(nodePositionsRef.current).length > 0;

  const handleMaxDepthChange = (newDepth: number) => {
    setLocalMaxDepth(newDepth);
    toast.success(`Diagram depth set to ${newDepth} levels`);
  };

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
      />
    </div>
  );
};
