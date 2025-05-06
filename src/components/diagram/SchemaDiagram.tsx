
import React from 'react';
import '@xyflow/react/dist/style.css';
import { DiagramEmpty } from './DiagramEmpty';
import { DiagramHeader } from './DiagramHeader';
import { DiagramFlow } from './DiagramFlow';
import { useDiagramNodes } from './hooks/useDiagramNodes';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ChevronUp, ChevronDown, Minimize, Expand } from 'lucide-react';

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
    schemaKey,
    maxDepth,
    updateMaxDepth
  } = useDiagramNodes(schema, error, groupProperties);

  // Check if there are any stored node positions
  const hasStoredPositions = Object.keys(nodePositionsRef.current).length > 0;

  const handleDepthChange = (values: number[]) => {
    updateMaxDepth(values[0]);
  };

  const incrementDepth = () => {
    updateMaxDepth(Math.min(maxDepth + 1, 10));
  };

  const decrementDepth = () => {
    updateMaxDepth(Math.max(maxDepth - 1, 1));
  };

  const expandAll = () => {
    updateMaxDepth(10); // Set to maximum reasonable depth
  };

  const collapseAll = () => {
    updateMaxDepth(1); // Set to minimum depth
  };

  if (error) {
    return <DiagramEmpty error={true} />;
  }

  if (!schema || (Array.isArray(nodes) && nodes.length === 0)) {
    return <DiagramEmpty noSchema={true} />;
  }

  return (
    <div className="h-full flex flex-col">
      <DiagramHeader>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-500">Depth: {maxDepth}</span>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-6 w-6" 
              onClick={decrementDepth}
              disabled={maxDepth <= 1}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={incrementDepth}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
          </div>
          <div className="w-24 mx-1">
            <Slider 
              value={[maxDepth]} 
              min={1} 
              max={10} 
              step={1} 
              onValueChange={handleDepthChange} 
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={collapseAll}
            title="Collapse All"
          >
            <Minimize className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={expandAll}
            title="Expand All"
          >
            <Expand className="h-3 w-3" />
          </Button>
        </div>
      </DiagramHeader>
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
