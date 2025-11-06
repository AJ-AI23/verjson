import React, { memo } from 'react';
import '@xyflow/react/dist/style.css';
import { DiagramContainer } from './DiagramContainer';
import { CollapsedState } from '@/lib/diagram/types';
import { SequenceDiagramRenderer } from './sequence/SequenceDiagramRenderer';
import { DiagramDocument, SequenceDiagramData } from '@/types/diagram';
import { DiagramStyles, defaultLightTheme, defaultDarkTheme } from '@/types/diagramStyles';

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
  isOpenApiImportOpen?: boolean;
  onOpenApiImportClose?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
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
  onStylesDialogClose,
  isOpenApiImportOpen,
  onOpenApiImportClose,
  isFullscreen,
  onToggleFullscreen
}) => {
  // Check if this is a diagram document
  const diagramDocument = isDiagram && schema ? schema as DiagramDocument : null;
  const isSequenceDiagram = diagramDocument?.type === 'sequence';

  // Ensure styles are initialized
  React.useEffect(() => {
    if (diagramDocument && !diagramDocument.styles && onSchemaChange) {
      console.log('🎨 Initializing missing styles for diagram');
      const updatedDocument = {
        ...diagramDocument,
        styles: {
          activeTheme: 'light',
          themes: {
            light: defaultLightTheme,
            dark: defaultDarkTheme
          }
        }
      };
      onSchemaChange(updatedDocument);
    }
  }, [diagramDocument, onSchemaChange]);

  if (isSequenceDiagram && diagramDocument) {
    // Ensure styles are always defined with defaults
    const documentStyles = diagramDocument.styles || {
      activeTheme: 'light',
      themes: {
        light: defaultLightTheme,
        dark: defaultDarkTheme
      }
    };

    console.log('🎨 Rendering SequenceDiagram - isStylesDialogOpen:', isStylesDialogOpen, 'has styles:', !!documentStyles);

    return (
      <div className={`h-full flex flex-col min-h-0 ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
        <SequenceDiagramRenderer 
          data={diagramDocument.data as SequenceDiagramData}
          styles={documentStyles}
          workspaceId={workspaceId}
          isStylesDialogOpen={isStylesDialogOpen}
          onStylesDialogClose={onStylesDialogClose}
          isOpenApiImportOpen={isOpenApiImportOpen}
          onOpenApiImportClose={onOpenApiImportClose}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
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
      prevProps.maxDepth === nextProps.maxDepth &&
      prevProps.isStylesDialogOpen === nextProps.isStylesDialogOpen &&
      prevProps.isOpenApiImportOpen === nextProps.isOpenApiImportOpen &&
      prevProps.isFullscreen === nextProps.isFullscreen
    );
    
    return result;
  } catch (error) {
    console.error('Error in SchemaDiagram memo comparison:', error);
    // If there's an error in comparison, force a re-render to be safe
    return false;
  }
});

SchemaDiagram.displayName = 'SchemaDiagram';