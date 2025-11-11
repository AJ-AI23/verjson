import React, { memo, useMemo } from 'react';
import '@xyflow/react/dist/style.css';
import { DiagramContainer } from './DiagramContainer';
import { CollapsedState } from '@/lib/diagram/types';
import { SequenceDiagramRenderer } from './sequence/SequenceDiagramRenderer';
import { DiagramDocument, SequenceDiagramData } from '@/types/diagram';
import { DiagramStyles, defaultLightTheme, defaultDarkTheme } from '@/types/diagramStyles';
import { migrateDiagramDocument } from '@/lib/diagramMigration';

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
  diagramRef?: React.RefObject<HTMLDivElement>;
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
  onToggleFullscreen,
  diagramRef
}) => {
  // Check if this is a diagram document and migrate if needed
  const diagramDocument = useMemo(() => {
    if (!isDiagram || !schema) return null;
    const migrated = migrateDiagramDocument(schema as DiagramDocument);
    console.log('🔄 [SchemaDiagram] diagramDocument recalculated:', {
      selectedTheme: migrated.selectedTheme,
      hasSelectedTheme: 'selectedTheme' in migrated
    });
    return migrated;
  }, [isDiagram, schema]);
  
  const isSequenceDiagram = diagramDocument?.type === 'sequence';

  // Ensure styles are initialized
  React.useEffect(() => {
    if (diagramDocument && !diagramDocument.styles && onSchemaChange) {
      const updatedDocument = {
        ...diagramDocument,
        styles: {
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
      themes: {
        light: defaultLightTheme,
        dark: defaultDarkTheme
      }
    };

    return (
      <div ref={diagramRef} className={`h-full flex flex-col min-h-0 ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
        <SequenceDiagramRenderer
          data={diagramDocument.data as SequenceDiagramData}
          styles={documentStyles}
          theme={diagramDocument.selectedTheme}
          workspaceId={workspaceId}
          isStylesDialogOpen={isStylesDialogOpen}
          onStylesDialogClose={onStylesDialogClose}
          isOpenApiImportOpen={isOpenApiImportOpen}
          onOpenApiImportClose={onOpenApiImportClose}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          onDataChange={(newData) => {
            if (onSchemaChange) {
              console.log('📝 [SchemaDiagram] onDataChange called', {
                currentTheme: diagramDocument.selectedTheme,
                hasSelectedTheme: 'selectedTheme' in diagramDocument
              });
              const updatedDocument = {
                ...diagramDocument,
                data: newData,
                selectedTheme: diagramDocument.selectedTheme, // Explicitly preserve theme
                metadata: {
                  ...diagramDocument.metadata,
                  modified: new Date().toISOString()
                }
              };
              console.log('📝 [SchemaDiagram] Calling onSchemaChange with theme:', updatedDocument.selectedTheme);
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
          onThemeChange={(newTheme: string) => {
            if (onSchemaChange) {
              const updatedDocument = {
                ...diagramDocument,
                selectedTheme: newTheme,
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