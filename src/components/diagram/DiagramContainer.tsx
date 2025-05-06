
import React from 'react';
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
  const [localMaxDepth, setLocalMaxDepth] = React.useState(maxDepth);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    nodePositionsRef,
    schemaKey
  } = useDiagramNodes(schema, error, groupProperties, localMaxDepth, collapsedPaths);

  // Check if there are any stored node positions
  const hasStoredPositions = Object.keys(nodePositionsRef.current).length > 0;

  const handleMaxDepthChange = (newDepth: number) => {
    setLocalMaxDepth(newDepth);
    toast.success(`Diagram depth set to ${newDepth} levels`);
  };

  if (error) {
    return <DiagramEmpty error={true} />;
  }

  if (!schema || (Array.isArray(nodes) && nodes.length === 0)) {
    return <DiagramEmpty noSchema={true} />;
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
