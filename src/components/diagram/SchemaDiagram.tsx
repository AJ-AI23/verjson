
import React from 'react';
import '@xyflow/react/dist/style.css';
import { DiagramEmpty } from './DiagramEmpty';
import { DiagramHeader } from './DiagramHeader';
import { DiagramFlow } from './DiagramFlow';
import { useDiagramNodes } from './hooks/useDiagramNodes';

interface SchemaDiagramProps {
  schema: any;
  error: boolean;
  groupProperties?: boolean;
}

export const SchemaDiagram = ({ schema, error, groupProperties = false }: SchemaDiagramProps) => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    nodePositionsRef,
    schemaKey
  } = useDiagramNodes(schema, error, groupProperties);

  if (error) {
    return <DiagramEmpty error={true} />;
  }

  if (!schema || (Array.isArray(nodes) && nodes.length === 0)) {
    return <DiagramEmpty noSchema={true} />;
  }

  return (
    <div className="h-full flex flex-col">
      <DiagramHeader />
      <DiagramFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        schemaKey={schemaKey}
        shouldFitView={nodes.length > 0 && !Object.keys(nodePositionsRef.current).length}
      />
    </div>
  );
};
