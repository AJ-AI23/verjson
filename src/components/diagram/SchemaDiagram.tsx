import React, { memo } from 'react';
import '@xyflow/react/dist/style.css';
import { DiagramContainer } from './DiagramContainer';
import { CollapsedState } from '@/lib/diagram/types';
import { deepEqual } from '@/lib/utils/deepEqual';

interface SchemaDiagramProps {
  schema: any;
  error: boolean;
  groupProperties?: boolean;
  collapsedPaths?: CollapsedState;
  maxDepth?: number;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  expandedNotationPaths?: Set<string>;
}

export const SchemaDiagram: React.FC<SchemaDiagramProps> = memo(({
  schema,
  error,
  groupProperties,
  collapsedPaths,
  maxDepth,
  onAddNotation,
  expandedNotationPaths
}) => {
  return (
    <div className="h-full flex flex-col min-h-0">
      <DiagramContainer 
        schema={schema}
        error={error}
        groupProperties={groupProperties}
        collapsedPaths={collapsedPaths}
        maxDepth={maxDepth}
        onAddNotation={onAddNotation}
        expandedNotationPaths={expandedNotationPaths}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Simplified comparison - only check if props are exactly the same
  // This allows React to handle updates more naturally when collapsedPaths changes
  return (
    prevProps.schema === nextProps.schema &&
    prevProps.error === nextProps.error &&
    prevProps.groupProperties === nextProps.groupProperties &&
    prevProps.collapsedPaths === nextProps.collapsedPaths &&
    prevProps.maxDepth === nextProps.maxDepth &&
    prevProps.onAddNotation === nextProps.onAddNotation &&
    prevProps.expandedNotationPaths === nextProps.expandedNotationPaths
  );
});

SchemaDiagram.displayName = 'SchemaDiagram';