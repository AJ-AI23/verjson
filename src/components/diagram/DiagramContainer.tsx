
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
}

export const DiagramContainer: React.FC<DiagramContainerProps> = ({ 
  schema, 
  error, 
  groupProperties = false,
  collapsedPaths = {},
  maxDepth = 3
}) => {
  const [localMaxDepth, setLocalMaxDepth] = useState(maxDepth);

  // Deep memoize the schema and collapsedPaths to prevent unnecessary re-renders
  const memoizedSchema = useMemo(() => schema, [JSON.stringify(schema)]);
  const memoizedCollapsedPaths = useMemo(() => collapsedPaths, [JSON.stringify(collapsedPaths)]);

  // Debug logs
  useEffect(() => {
    console.log('DiagramContainer received schema:', schema);
    console.log('Schema is null or undefined:', schema === null || schema === undefined);
    console.log('Error state:', error);
    console.log('Root collapsed:', collapsedPaths?.root === true);
  }, [schema, error, collapsedPaths]);

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
    if (nodes && nodes.length > 0) {
      console.log('First node:', nodes[0]);
    }
  }, [nodes, edges]);

  // Check if there are any stored node positions
  const hasStoredPositions = Object.keys(nodePositionsRef.current).length > 0;

  const handleMaxDepthChange = (newDepth: number) => {
    setLocalMaxDepth(newDepth);
    toast.success(`Diagram depth set to ${newDepth} levels`);
  };

  if (error) {
    console.log('DiagramContainer: Rendering DiagramEmpty due to error');
    return <DiagramEmpty error={true} />;
  }

  if (!schema) {
    console.log('DiagramContainer: Rendering DiagramEmpty due to no schema');
    return <DiagramEmpty noSchema={true} />;
  }
  
  // Always render diagram when we have a schema, regardless of nodes count
  return (
    <div className="h-full flex flex-col">
      <DiagramHeader maxDepth={localMaxDepth} onMaxDepthChange={handleMaxDepthChange} />
      <DiagramFlow
        nodes={nodes || []}
        edges={edges || []}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        schemaKey={schemaKey}
        shouldFitView={nodes?.length > 0 && !hasStoredPositions}
      />
    </div>
  );
};
