
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
  highlightEnabled?: boolean;
  onNodeSelect?: (path: string | null) => void;
}

export const SchemaDiagram = ({ 
  schema, 
  error, 
  groupProperties = false,
  highlightEnabled = false,
  onNodeSelect
}: SchemaDiagramProps) => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    nodePositionsRef,
    schemaKey
  } = useDiagramNodes(schema, error, groupProperties);

  // Check if there are any stored node positions
  const hasStoredPositions = Object.keys(nodePositionsRef.current).length > 0;

  const handleNodeClick = (event: React.MouseEvent, node: any) => {
    if (highlightEnabled && onNodeSelect) {
      // Extract the path from the node data
      const path = node.data.jsonPath || null;
      onNodeSelect(path);
    }
  };

  const handlePaneClick = () => {
    // Clear selection when clicking on the empty diagram area
    if (highlightEnabled && onNodeSelect) {
      onNodeSelect(null);
    }
  };

  if (error) {
    return <DiagramEmpty error={true} />;
  }

  if (!schema || (Array.isArray(nodes) && nodes.length === 0)) {
    return <DiagramEmpty noSchema={true} />;
  }

  return (
    <div className="h-full flex flex-col">
      <DiagramHeader highlightEnabled={highlightEnabled} />
      <DiagramFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        schemaKey={schemaKey}
        shouldFitView={nodes.length > 0 && !hasStoredPositions}
        onNodeClick={highlightEnabled ? handleNodeClick : undefined}
        onPaneClick={highlightEnabled ? handlePaneClick : undefined}
      />
    </div>
  );
};
