
import React, { memo, useEffect } from 'react';
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
  useEffect(() => {
    console.log('SchemaDiagram rendering', { 
      hasSchema: !!schema, 
      schemaType: schema?.type,
      error, 
      groupProperties, 
      collapsedPathsCount: collapsedPaths ? Object.keys(collapsedPaths).length : 0 
    });
    
    if (schema) {
      console.log('Schema structure:', {
        type: schema.type,
        title: schema.title,
        properties: schema.properties ? Object.keys(schema.properties) : []
      });
    }
  }, [schema, error, groupProperties, collapsedPaths]);
  
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
  const result = (
    schemaEqual &&
    prevProps.error === nextProps.error &&
    prevProps.groupProperties === nextProps.groupProperties &&
    collapsedEqual &&
    prevProps.maxDepth === nextProps.maxDepth
  );
  
  if (!result) {
    console.log('SchemaDiagram props changed, will re-render');
  }
  
  return result;
});

SchemaDiagram.displayName = 'SchemaDiagram';
