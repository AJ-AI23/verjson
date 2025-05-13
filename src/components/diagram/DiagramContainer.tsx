
import React, { useMemo, useState, useEffect } from 'react';
import { DiagramEmpty } from './DiagramEmpty';
import { DiagramHeader } from './DiagramHeader';
import { DiagramFlow } from './DiagramFlow';
import { useDiagramNodes } from './hooks/useDiagramNodes';
import { toast } from 'sonner';
import { CollapsedState } from '@/lib/diagram/types';

interface DiagramContainerProps {
  schema: any;
  error: boolean;
  groupProperties?: boolean;
  collapsedPaths?: CollapsedState;
  maxDepth?: number;
  onMaxDepthChange?: (newDepth: number) => void;
}

export const DiagramContainer: React.FC<DiagramContainerProps> = ({ 
  schema, 
  error, 
  groupProperties = false,
  collapsedPaths = {},
  maxDepth = 3,
  onMaxDepthChange
}) => {
  const [localMaxDepth, setLocalMaxDepth] = useState(maxDepth);

  // Deep memoize the schema and collapsedPaths to prevent unnecessary re-renders
  const memoizedSchema = useMemo(() => schema, [JSON.stringify(schema)]);
  const memoizedCollapsedPaths = useMemo(() => collapsedPaths, [JSON.stringify(collapsedPaths)]);

  // Update local maxDepth when prop changes
  useEffect(() => {
    if (maxDepth !== localMaxDepth) {
      setLocalMaxDepth(maxDepth);
    }
  }, [maxDepth]);

  // Debug logs
  useEffect(() => {
    console.log('DiagramContainer received schema:', schema);
    console.log('Schema is null or undefined:', schema === null || schema === undefined);
    console.log('Error state:', error);
    console.log('Collapsed paths count:', Object.keys(memoizedCollapsedPaths).length);
  }, [schema, error, memoizedCollapsedPaths]);

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
    localMaxDepth, 
    memoizedCollapsedPaths
  );

  // Debug logs for nodes and edges
  useEffect(() => {
    console.log(`DiagramContainer has ${nodes?.length || 0} nodes and ${edges?.length || 0} edges`);
    console.log('First few nodes:', nodes?.slice(0, 2));
  }, [nodes, edges]);

  // Check if there are any stored node positions
  const hasStoredPositions = Object.keys(nodePositionsRef.current).length > 0;

  const handleMaxDepthChange = (newDepth: number) => {
    setLocalMaxDepth(newDepth);
    if (onMaxDepthChange) {
      onMaxDepthChange(newDepth);
    }
    toast.success(`Diagram depth set to ${newDepth} levels`);
  };

  if (error) {
    console.log('DiagramContainer: Rendering DiagramEmpty due to error');
    return <DiagramEmpty error={true} />;
  }

  if (!schema || !nodes || nodes.length === 0) {
    console.log('DiagramContainer: Rendering DiagramEmpty due to no schema or no nodes');
    console.log('Schema exists:', !!schema);
    console.log('Nodes exist:', !!nodes);
    console.log('Nodes length:', nodes?.length || 0);
    return <DiagramEmpty noSchema={!schema} />;
  }

  return (
    <div className="h-full flex flex-col">
      <DiagramHeader maxDepth={localMaxDepth} onMaxDepthChange={handleMaxDepthChange} />
      <DiagramFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        schemaKey={schemaKey}
        shouldFitView={nodes.length > 0 && !hasStoredPositions}
      />
    </div>
  );
};
