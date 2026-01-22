
import React, { useCallback, useRef } from 'react';
import { SplitPane } from '@/components/SplitPane';
import { JsonEditorWrapper } from '@/components/JsonEditorWrapper';
import { SchemaDiagram } from '@/components/diagram/SchemaDiagram';
import { MarkdownEditor } from '@/components/markdown/MarkdownEditor';
import { MarkdownStylesDialog } from '@/components/markdown/MarkdownStylesDialog';
import { VersionControls } from '@/components/VersionControls';
import { CollapsedState } from '@/lib/diagram/types';
import { DocumentVersionComparison } from '@/lib/importVersionUtils';
import { Version, VersionTier } from '@/lib/versionUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { MarkdownDocument } from '@/types/markdown';
import { MarkdownStyles, defaultMarkdownStyles } from '@/types/markdownStyles';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { detectExtendedMarkdownFeatures } from '@/lib/markdown/detectExtendedMarkdown';

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
  const [showDiagram, setShowDiagram] = React.useState(true);
  const editorContentInstanceId = useRef(Math.random().toString(36).slice(2, 8)).current;
  
  // Track the last schema we received from the editor to prevent echo updates from diagram
  const lastEditorSchemaRef = useRef<string>(schema);

  const [pendingSchemaString, setPendingSchemaString] = React.useState<string | null>(null);
  const [showMarkdownDowngradeWarning, setShowMarkdownDowngradeWarning] = React.useState(false);
  
  // Update ref when schema prop changes (from editor)
  React.useEffect(() => {
    lastEditorSchemaRef.current = schema;
  }, [schema]);

  const guardedOnEditorChange = useCallback(
    (nextSchemaString: string) => {
      // Only guard markdown downgrade when we have a valid parsed schema object.
      if (currentFileType === 'markdown' && parsedSchema?.type === 'extended-markdown') {
        try {
          const next = JSON.parse(nextSchemaString);
          if (next?.type === 'markdown') {
            const detected = detectExtendedMarkdownFeatures(parsedSchema as any);
            if (detected.hasAny) {
              setPendingSchemaString(nextSchemaString);
              setShowMarkdownDowngradeWarning(true);
              return;
            }
          }
        } catch {
          // Ignore JSON parse issues here; existing editor error UI handles invalid JSON.
        }
      }

      onEditorChange(nextSchemaString);
    },
    [currentFileType, onEditorChange, parsedSchema]
  );
  
  // Stable callback that prevents diagram from overwriting editor with stale/same content
  const handleDiagramSchemaChange = useCallback((updatedSchema: any) => {
    const newSchemaString = JSON.stringify(updatedSchema, null, 2);
    
    // Compare normalized JSON to avoid spurious updates from formatting differences
    const normalize = (s: string) => {
      try {
        return JSON.stringify(JSON.parse(s));
      } catch {
        return s;
      }
    };
    
    const currentNormalized = normalize(lastEditorSchemaRef.current);
    const newNormalized = normalize(newSchemaString);
    
    // Only propagate if content actually changed
    if (currentNormalized !== newNormalized) {
      console.log(`[EditorContent ${editorContentInstanceId}] diagram->editor APPLY`, {
        documentId,
        currentFileType,
        prevLen: lastEditorSchemaRef.current.length,
        nextLen: newSchemaString.length,
      });
      lastEditorSchemaRef.current = newSchemaString;
      guardedOnEditorChange(newSchemaString);
    } else {
      console.log(`[EditorContent ${editorContentInstanceId}] diagram->editor SKIP (no actual change)`, {
        documentId,
        currentFileType,
      });
    }
  }, [guardedOnEditorChange]);
  const editorPane = (
    <div className="flex flex-col h-full">
      <JsonEditorWrapper
        value={schema} 
        onChange={guardedOnEditorChange} 
        error={error}
        collapsedPaths={collapsedPaths}
        onToggleCollapse={onToggleCollapse}
        maxDepth={maxDepth}
        documentId={documentId}
        showDiagram={showDiagram}
        onToggleDiagram={() => setShowDiagram(!showDiagram)}
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
      onToggleCollapse={onToggleCollapse}
      onSchemaChange={handleDiagramSchemaChange}
    />
  );

  // Handle markdown styles change
  const handleMarkdownStylesChange = useCallback((newStyles: MarkdownStyles) => {
    if (parsedSchema && currentFileType === 'markdown') {
      const updatedDoc = {
        ...parsedSchema,
        styles: newStyles,
      };
      handleDiagramSchemaChange(updatedDoc);
    }
  }, [parsedSchema, currentFileType, handleDiagramSchemaChange]);

  // Markdown editor pane for markdown documents
  const markdownPane = parsedSchema && currentFileType === 'markdown' ? (
    <>
      <MarkdownEditor
        document={parsedSchema as MarkdownDocument}
        onDocumentChange={handleDiagramSchemaChange}
        readOnly={userRole === 'viewer'}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
      <MarkdownStylesDialog
        isOpen={isStylesDialogOpen || false}
        onClose={onStylesDialogClose || (() => {})}
        styles={(parsedSchema as MarkdownDocument).styles || defaultMarkdownStyles}
        onStylesChange={handleMarkdownStylesChange}
      />
    </>
  ) : null;

  const downgradeWarningDialog = (
    <AlertDialog open={showMarkdownDowngradeWarning} onOpenChange={setShowMarkdownDowngradeWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Switch to Basic Markdown?</AlertDialogTitle>
          <AlertDialogDescription>
            This document appears to use extended markdown features. Switching to basic markdown may render it incorrectly.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              setPendingSchemaString(null);
            }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const pending = pendingSchemaString;
              setPendingSchemaString(null);
              setShowMarkdownDowngradeWarning(false);
              if (pending) onEditorChange(pending);
            }}
          >
            Switch anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Determine which right pane to show
  const isMarkdown = currentFileType === 'markdown';
  const rightPane = isMarkdown ? markdownPane : diagramPane;
  const rightPaneLabel = isMarkdown ? 'Preview' : 'Diagram';

  if (isMobile) {
    return (
      <>
      <Tabs defaultValue="editor" className="h-full flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b">
          <TabsTrigger value="editor" className="flex-1">Editor</TabsTrigger>
          {showDiagram && <TabsTrigger value="diagram" className="flex-1">{rightPaneLabel}</TabsTrigger>}
        </TabsList>
        <TabsContent value="editor" className="flex-1 mt-0">
          {editorPane}
        </TabsContent>
        {showDiagram && (
          <TabsContent value="diagram" className="flex-1 mt-0">
            {rightPane}
          </TabsContent>
        )}
      </Tabs>
      {downgradeWarningDialog}
      </>
    );
  }

  // Desktop view - if diagram is hidden, show only editor
  if (!showDiagram) {
    return (
      <>
        <div className="h-full">{editorPane}</div>
        {downgradeWarningDialog}
      </>
    );
  }

  return (
    <>
      <SplitPane>
        {editorPane}
        {rightPane}
      </SplitPane>
      {downgradeWarningDialog}
    </>
  );
};
