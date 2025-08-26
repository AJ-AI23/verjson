
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
  const [localMaxDepth, setLocalMaxDepth] = useState(maxDepth);

  // Update local maxDepth when prop changes
  useEffect(() => {
    if (maxDepth !== undefined) {
      setLocalMaxDepth(maxDepth);
    }
  }, [maxDepth]);

  // Deep memoize the schema and collapsedPaths to prevent unnecessary re-renders
  const memoizedSchema = useMemo(() => schema, [JSON.stringify(schema)]);
  const memoizedCollapsedPaths = useMemo(() => collapsedPaths, [JSON.stringify(collapsedPaths)]);

  // Debug logs - let's check the actual structure rather than console.log truncation
  useEffect(() => {
    console.log('DiagramContainer received schema - checking actual structure:');
    console.log('Schema type:', typeof schema);
    console.log('Schema is null:', schema === null);
    if (schema && schema.properties && schema.properties.exampleObject) {
      console.log('exampleObject type:', schema.properties.exampleObject.type);
      console.log('exampleObject has properties:', !!schema.properties.exampleObject.properties);
      if (schema.properties.exampleObject.properties) {
        console.log('exampleObject.properties keys:', Object.keys(schema.properties.exampleObject.properties));
        if (schema.properties.exampleObject.properties.nestedField) {
          console.log('nestedField exists:', true);
          console.log('nestedField type:', schema.properties.exampleObject.properties.nestedField.type);
          console.log('nestedField type is string:', typeof schema.properties.exampleObject.properties.nestedField.type === 'string');
        }
      }
    }
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
    <div className="flex flex-col flex-1 min-h-0">
      <DiagramHeader />
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
