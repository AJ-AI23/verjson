
import React from 'react';
import { SplitPane } from '@/components/SplitPane';
import { JsonEditorWrapper } from '@/components/JsonEditorWrapper';
import { SchemaDiagram } from '@/components/diagram/SchemaDiagram';
import { VersionControls } from '@/components/VersionControls';
import { CollapsedState } from '@/lib/diagram/types';
import { DocumentVersionComparison } from '@/lib/importVersionUtils';
import { Version, VersionTier } from '@/lib/versionUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';

interface EditorContentProps {
  schema: string;
  parsedSchema: any;
  error: string | null;
  isModified: boolean;
  currentVersion: Version;
  collapsedPaths: CollapsedState;
  groupProperties: boolean;
  maxDepth: number;
  userRole?: 'owner' | 'editor' | 'viewer';
  onEditorChange: (value: string) => void;
  onVersionBump: (newVersion: Version, tier: VersionTier, description: string) => void;
  onToggleCollapse: (path: string, isCollapsed: boolean) => void;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  expandedNotationPaths?: Set<string>;
  documentId?: string;
  patches?: any[];
  onImportVersion?: (importedSchema: any, comparison: DocumentVersionComparison, sourceDocumentName: string) => void;
  currentFileType?: string;
  suggestedVersion?: Version | null;
  workspaceId?: string;
  isStylesDialogOpen?: boolean;
  onStylesDialogClose?: () => void;
  isOpenApiImportOpen?: boolean;
  onOpenApiImportClose?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  diagramRef?: React.RefObject<HTMLDivElement>;
}

export const EditorContent: React.FC<EditorContentProps> = ({
  schema,
  parsedSchema,
  error,
  isModified,
  currentVersion,
  collapsedPaths,
  groupProperties,
  maxDepth,
  userRole,
  onEditorChange,
  onVersionBump,
  onToggleCollapse,
  onAddNotation,
  expandedNotationPaths,
  documentId,
  patches,
  onImportVersion,
  currentFileType,
  suggestedVersion,
  workspaceId,
  isStylesDialogOpen,
  onStylesDialogClose,
  isOpenApiImportOpen,
  onOpenApiImportClose,
  isFullscreen,
  onToggleFullscreen,
  diagramRef,
}) => {
  const isMobile = useIsMobile();

  const editorPane = (
    <div className="flex flex-col h-full">
      <JsonEditorWrapper
        value={schema} 
        onChange={onEditorChange} 
        error={error}
        collapsedPaths={collapsedPaths}
        onToggleCollapse={onToggleCollapse}
        maxDepth={maxDepth}
        documentId={documentId}
      />
      <VersionControls 
        version={currentVersion} 
        userRole={userRole}
        onVersionBump={onVersionBump}
        isModified={isModified}
        schema={schema}
        patches={patches}
        onImportVersion={onImportVersion}
        documentId={documentId}
        currentFileType={currentFileType}
        suggestedVersion={suggestedVersion}
      />
    </div>
  );

  const diagramPane = (
    <SchemaDiagram 
      schema={parsedSchema}
      error={error !== null}
      groupProperties={groupProperties}
      collapsedPaths={collapsedPaths}
      maxDepth={maxDepth}
      onAddNotation={onAddNotation}
      expandedNotationPaths={expandedNotationPaths}
      isDiagram={currentFileType === 'diagram'}
      workspaceId={workspaceId}
      isStylesDialogOpen={isStylesDialogOpen}
      onStylesDialogClose={onStylesDialogClose}
      isOpenApiImportOpen={isOpenApiImportOpen}
      onOpenApiImportClose={onOpenApiImportClose}
      isFullscreen={isFullscreen}
      onToggleFullscreen={onToggleFullscreen}
      diagramRef={diagramRef}
      onSchemaChange={(updatedSchema) => {
        // When diagram is edited, update the JSON editor
        console.log('[EditorContent] onSchemaChange called from diagram:', {
          hasUpdatedSchema: !!updatedSchema,
          nodeCount: updatedSchema?.data?.nodes?.length
        });
        onEditorChange(JSON.stringify(updatedSchema, null, 2));
      }}
    />
  );

  if (isMobile) {
    return (
      <Tabs defaultValue="editor" className="h-full flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b">
          <TabsTrigger value="editor" className="flex-1">Editor</TabsTrigger>
          <TabsTrigger value="diagram" className="flex-1">Diagram</TabsTrigger>
        </TabsList>
        <TabsContent value="editor" className="flex-1 mt-0">
          {editorPane}
        </TabsContent>
        <TabsContent value="diagram" className="flex-1 mt-0">
          {diagramPane}
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <SplitPane>
      {editorPane}
      {diagramPane}
    </SplitPane>
  );
};
