
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

export const SchemaDiagram: React.FC<SchemaDiagramProps> = memo((props) => {
  return <DiagramContainer {...props} />;
});

SchemaDiagram.displayName = 'SchemaDiagram';
