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
  try {
    // Custom comparison function for memoization using efficient deep equality
    const schemaEqual = deepEqual(prevProps.schema, nextProps.schema);
    const collapsedEqual = deepEqual(prevProps.collapsedPaths, nextProps.collapsedPaths);
    const notationPathsEqual = prevProps.expandedNotationPaths === nextProps.expandedNotationPaths ||
      (prevProps.expandedNotationPaths && nextProps.expandedNotationPaths &&
       prevProps.expandedNotationPaths.size === nextProps.expandedNotationPaths.size &&
       [...prevProps.expandedNotationPaths].every(path => nextProps.expandedNotationPaths!.has(path)));
    
    const result = (
      schemaEqual &&
      prevProps.error === nextProps.error &&
      prevProps.groupProperties === nextProps.groupProperties &&
      collapsedEqual &&
      prevProps.maxDepth === nextProps.maxDepth &&
      prevProps.onAddNotation === nextProps.onAddNotation &&
      notationPathsEqual
    );
    
    return result;
  } catch (error) {
    console.error('Error in SchemaDiagram memo comparison:', error);
    // If there's an error in comparison, force a re-render to be safe
    return false;
  }
});

SchemaDiagram.displayName = 'SchemaDiagram';