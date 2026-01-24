import React, { memo, useMemo, useRef } from 'react';
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
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  onNodeSelect?: (path: string) => void;
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
  diagramRef,
  onToggleCollapse,
  onNodeSelect
}) => {
  const diagramInstanceId = useRef(Math.random().toString(36).slice(2, 8)).current;

  // Debug tracing for diagram/editor reset
  React.useEffect(() => {
    console.log(`[SchemaDiagram ${diagramInstanceId}] MOUNT`, {
      isDiagram,
      error,
      hasSchema: !!schema,
    });
    return () => console.log(`[SchemaDiagram ${diagramInstanceId}] UNMOUNT`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const schemaSummary = schema && typeof schema === 'object'
      ? {
          keys: Object.keys(schema).slice(0, 12),
          verjson: (schema as any).verjson,
          type: (schema as any).type,
          hasOpenapi: !!(schema as any).openapi,
        }
      : { type: typeof schema };

    console.log(`[SchemaDiagram ${diagramInstanceId}] props update`, {
      isDiagram,
      error,
      schemaSummary,
    });
  }, [isDiagram, error, schema, diagramInstanceId]);
  // Theme preference stored in localStorage, not in document
  const [selectedTheme, setSelectedTheme] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('diagram-viewer-theme') || 'light';
    }
    return 'light';
  });

  // Persist theme changes to localStorage
  const handleThemeChange = React.useCallback((newTheme: string) => {
    setSelectedTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('diagram-viewer-theme', newTheme);
    }
  }, []);

  // Check if this is a diagram document and migrate if needed
  const diagramDocument = useMemo(() => {
    if (!isDiagram || !schema) return null;
    return migrateDiagramDocument(schema as DiagramDocument);
  }, [isDiagram, schema]);
  
  const isSequenceDiagram = diagramDocument?.type === 'sequence';

  // Track if we've already initialized styles for this document to prevent re-triggering
  // after version saves which could cause the editor to reset
  const stylesInitializedRef = useRef<string | null>(null);
  const documentId = diagramDocument?.info?.title || (diagramDocument?.type === 'sequence' && (diagramDocument?.data as SequenceDiagramData)?.lifelines?.map((l) => l.id).join(',')) || 'doc';

  // Ensure styles are initialized - only once per document identity
  React.useEffect(() => {
    // Skip if already initialized for this document or if styles already exist
    if (!diagramDocument || !onSchemaChange) return;
    if (diagramDocument.styles) {
      // Mark as initialized since styles exist
      console.log(`[SchemaDiagram ${diagramInstanceId}] styles init: already has styles`, { documentId });
      stylesInitializedRef.current = documentId;
      return;
    }
    if (stylesInitializedRef.current === documentId) {
      // Already initialized for this document, skip
      console.log(`[SchemaDiagram ${diagramInstanceId}] styles init: already initialized for doc`, { documentId });
      return;
    }
    
    // Initialize styles
    console.log(`[SchemaDiagram ${diagramInstanceId}] styles init: APPLY default styles`, { documentId });
    stylesInitializedRef.current = documentId;
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
  }, [diagramDocument, onSchemaChange, documentId, diagramInstanceId]);

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
          theme={selectedTheme}
          workspaceId={workspaceId}
          isStylesDialogOpen={isStylesDialogOpen}
          onStylesDialogClose={onStylesDialogClose}
          isOpenApiImportOpen={isOpenApiImportOpen}
          onOpenApiImportClose={onOpenApiImportClose}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          onDataChange={(newData) => {
            console.log(`[SchemaDiagram ${diagramInstanceId}] onDataChange from renderer`, {
              docId: documentId,
              lifelines: (newData as any)?.lifelines?.length,
              nodes: (newData as any)?.nodes?.length,
              processes: (newData as any)?.processes?.length,
            });
            if (onSchemaChange) {
              const updatedDocument = {
                ...diagramDocument,
                data: newData,
                info: {
                  ...diagramDocument.info,
                  modified: new Date().toISOString()
                }
              };
              onSchemaChange(updatedDocument);
            } else {
              console.warn(`[SchemaDiagram ${diagramInstanceId}] onDataChange ignored (no onSchemaChange)`);
            }
          }}
          onStylesChange={(newStyles: DiagramStyles) => {
            console.log(`[SchemaDiagram ${diagramInstanceId}] onStylesChange from renderer`, {
              docId: documentId,
              themeKeys: Object.keys(newStyles?.themes || {}),
            });
            if (onSchemaChange) {
              const updatedDocument = {
                ...diagramDocument,
                styles: newStyles,
                info: {
                  ...diagramDocument.info,
                  modified: new Date().toISOString()
                }
              };
              onSchemaChange(updatedDocument);
            } else {
              console.warn(`[SchemaDiagram ${diagramInstanceId}] onStylesChange ignored (no onSchemaChange)`);
            }
          }}
          onThemeChange={handleThemeChange}
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
        onToggleCollapse={onToggleCollapse}
        onNodeSelect={onNodeSelect}
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
      prevProps.isFullscreen === nextProps.isFullscreen &&
      prevProps.onNodeSelect === nextProps.onNodeSelect
    );
    
    return result;
  } catch (error) {
    console.error('Error in SchemaDiagram memo comparison:', error);
    // If there's an error in comparison, force a re-render to be safe
    return false;
  }
});

SchemaDiagram.displayName = 'SchemaDiagram';