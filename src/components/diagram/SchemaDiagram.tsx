import React, { memo } from 'react';
import '@xyflow/react/dist/style.css';
import { DiagramContainer } from './DiagramContainer';
import { CollapsedState } from '@/lib/diagram/types';
import { SequenceDiagramRenderer } from './sequence/SequenceDiagramRenderer';
import { DiagramDocument, SequenceDiagramData } from '@/types/diagram';
import { DiagramStyles } from '@/types/diagramStyles';

interface SchemaDiagramProps {
  schema: any;
  error: boolean;
  groupProperties?: boolean;
  collapsedPaths?: CollapsedState;
  maxDepth?: number;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  expandedNotationPaths?: Set<string>;
  isDiagram?: boolean;
  onSchemaChange?: (schema: any) => void;
  workspaceId?: string;
  isStylesDialogOpen?: boolean;
  onStylesDialogClose?: () => void;
}

export const SchemaDiagram: React.FC<SchemaDiagramProps> = memo(({
  schema,
  error,
  groupProperties,
  collapsedPaths,
  maxDepth,
  onAddNotation,
  expandedNotationPaths,
  isDiagram = false,
  onSchemaChange,
  workspaceId,
  isStylesDialogOpen,
  onStylesDialogClose
}) => {
  // Check if this is a diagram document
  const diagramDocument = isDiagram && schema ? schema as DiagramDocument : null;
  const isSequenceDiagram = diagramDocument?.type === 'sequence';

  if (isSequenceDiagram && diagramDocument) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <SequenceDiagramRenderer 
          data={diagramDocument.data as SequenceDiagramData}
          styles={diagramDocument.styles}
          workspaceId={workspaceId}
          isStylesDialogOpen={isStylesDialogOpen}
          onStylesDialogClose={onStylesDialogClose}
          onDataChange={(newData) => {
            if (onSchemaChange) {
              const updatedDocument = {
                ...diagramDocument,
                data: newData,
                metadata: {
                  ...diagramDocument.metadata,
                  modified: new Date().toISOString()
                }
              };
              onSchemaChange(updatedDocument);
            }
          }}
          onStylesChange={(newStyles: DiagramStyles) => {
            if (onSchemaChange) {
              const updatedDocument = {
                ...diagramDocument,
                styles: newStyles,
                metadata: {
                  ...diagramDocument.metadata,
                  modified: new Date().toISOString()
                }
              };
              onSchemaChange(updatedDocument);
            }
          }}
        />
      </div>
    );
  }

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
    
    return result;
  } catch (error) {
    console.error('Error in SchemaDiagram memo comparison:', error);
    // If there's an error in comparison, force a re-render to be safe
    return false;
  }
});

SchemaDiagram.displayName = 'SchemaDiagram';