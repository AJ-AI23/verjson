
import React, { memo } from 'react';
import '@xyflow/react/dist/style.css';
import { DiagramContainer } from './DiagramContainer';
import { CollapsedState } from '@/lib/diagram/types';

interface SchemaDiagramProps {
  schema: any;
  error: boolean;
  groupProperties?: boolean;
  collapsedPaths?: CollapsedState;
  maxDepth?: number;
}

export const SchemaDiagram: React.FC<SchemaDiagramProps> = memo(({
  schema,
  error,
  groupProperties,
  collapsedPaths,
  maxDepth
}) => {
  // Debug output to help diagnose issues
  console.log('SchemaDiagram rendering', { 
    hasSchema: !!schema, 
    error, 
    groupProperties, 
    collapsedPathsCount: collapsedPaths ? Object.keys(collapsedPaths).length : 0 
  });
  
  return <DiagramContainer 
    schema={schema}
    error={error}
    groupProperties={groupProperties}
    collapsedPaths={collapsedPaths}
    maxDepth={maxDepth}
  />;
}, (prevProps, nextProps) => {
  // Custom comparison function for memoization
  const schemaEqual = JSON.stringify(prevProps.schema) === JSON.stringify(nextProps.schema);
  const collapsedEqual = JSON.stringify(prevProps.collapsedPaths) === JSON.stringify(nextProps.collapsedPaths);
  return (
    schemaEqual &&
    prevProps.error === nextProps.error &&
    prevProps.groupProperties === nextProps.groupProperties &&
    collapsedEqual &&
    prevProps.maxDepth === nextProps.maxDepth
  );
});

SchemaDiagram.displayName = 'SchemaDiagram';
