
import React from 'react';
import { defaultSchema } from '@/lib/defaultSchema';
import { EditorToolbar } from './schema/EditorToolbar';
import { EditorContent } from './schema/EditorContent';
import { useEditorState } from './editor/useEditorState';
import { EditorVersionDialog } from './editor/EditorVersionDialog';
import { detectSchemaType } from '@/lib/schemaUtils';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';
import { useDocumentPermissions } from '@/hooks/useDocumentPermissions';
import { useAuth } from '@/contexts/AuthContext';

interface EditorProps {
  initialSchema?: any;
  onSave?: (content: any) => void;
  documentName?: string;
  selectedDocument?: any;
  onClearRequest?: boolean;
  onClose?: () => void;
  onDocumentUpdate?: (updates: { name?: string; is_public?: boolean }) => void;
}

export const Editor = ({ initialSchema, onSave, documentName, selectedDocument, onClearRequest, onClose, onDocumentUpdate }: EditorProps) => {
  const { user } = useAuth();
  const [isStylesDialogOpen, setIsStylesDialogOpen] = React.useState(false);
  const [isOpenApiImportOpen, setIsOpenApiImportOpen] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const diagramRef = React.useRef<HTMLDivElement>(null);
  
  // Convert initialSchema to string if it's an object to prevent crashes in versioning hooks
  const schemaAsString = React.useMemo(() => {
    if (initialSchema && typeof initialSchema === 'object') {
      return JSON.stringify(initialSchema, null, 2);
    }
    return initialSchema || defaultSchema;
  }, [initialSchema]);
  
  const { settings, updateGroupProperties } = useEditorSettings();
  const { permissions } = useDocumentPermissions(selectedDocument?.id, selectedDocument);
  
  // Calculate user permissions for version history access
  const userPermissions = React.useMemo(() => {
    if (!user || !selectedDocument) {
      return { role: 'viewer' as const, isOwner: false };
    }
    
    // Check if user is the document owner
    const isOwner = selectedDocument.created_by === user.id;
    if (isOwner) {
      return { role: 'owner' as const, isOwner: true };
    }
    
    // Check document permissions for invited users
    const userPermission = permissions.find(p => p.user_id === user.id);
    if (userPermission) {
      return { 
        role: userPermission.role, 
        isOwner: false 
      };
    }
    
    // Default to viewer if no explicit permissions found
    return { role: 'viewer' as const, isOwner: false };
  }, [user, selectedDocument, permissions]);
  const {
    schema,
    setSchema,
    savedSchema,
    setSavedSchema,
    parsedSchema,
    error,
    schemaType,
    collapsedPaths,
    setCollapsedPaths,
    handleToggleCollapse,
    handleEditorChange,
    handleSchemaTypeChange,
    isModified,
    currentVersion,
    handleVersionBump,
    patches,
    isVersionHistoryOpen,
    toggleVersionHistory,
    handleToggleSelection,
    handleMarkAsReleased,
    handleDeleteVersion,
    handleAddNotation,
    expandedNotationPaths,
    clearEditorState,
    handleImportVersion,
    suggestedVersion
  } = useEditorState(schemaAsString, selectedDocument?.id);

  // Clear editor state when onClearRequest is triggered
  React.useEffect(() => {
    if (onClearRequest) {
      clearEditorState();
    }
  }, [onClearRequest, clearEditorState]);

  // Update editor state when initialSchema changes (document selection)
  const lastLoadedSchemaRef = React.useRef<any>(null);
  
  React.useEffect(() => {
    if (initialSchema && typeof initialSchema === 'object' && initialSchema !== lastLoadedSchemaRef.current) {
      // Don't overwrite unsaved changes when tab regains focus or component re-renders
      if (isModified) {
        // Update the ref so we don't keep triggering this
        lastLoadedSchemaRef.current = initialSchema;
        return;
      }
      
      // Detect the schema type and update it
      const detectedType = detectSchemaType(initialSchema);
      if (detectedType !== schemaType) {
        handleSchemaTypeChange(detectedType);
      }
      
      const schemaString = JSON.stringify(initialSchema, null, 2);
      setSchema(schemaString);
      setSavedSchema(schemaString);
      setCollapsedPaths({ root: true });
      lastLoadedSchemaRef.current = initialSchema;
    }
  }, [initialSchema, setSchema, setSavedSchema, setCollapsedPaths, schemaType, handleSchemaTypeChange, isModified]);
  
  
  return (
    <div className="json-schema-editor">
      <EditorToolbar
        schema={schema}
        schemaType={schemaType}
        groupProperties={settings.groupProperties}
        maxDepth={settings.maxDepth}
        onSchemaTypeChange={handleSchemaTypeChange}
        onGroupPropertiesChange={updateGroupProperties}
        
        toggleVersionHistory={toggleVersionHistory}
        setSchema={setSchema}
        setSavedSchema={setSavedSchema}
        onAddNotation={handleAddNotation}
        documentName={documentName}
        selectedDocument={selectedDocument}
        onClose={onClose}
        onDocumentUpdate={onDocumentUpdate}
        onSave={onSave}
        onOpenStyles={() => setIsStylesDialogOpen(true)}
        onImportOpenApi={() => setIsOpenApiImportOpen(true)}
        diagramRef={diagramRef}
      />
      
      <EditorContent
        schema={schema}
        parsedSchema={parsedSchema}
        error={error}
        isModified={isModified}
        currentVersion={currentVersion}
        collapsedPaths={collapsedPaths}
        groupProperties={settings.groupProperties}
        maxDepth={settings.maxDepth}
        userRole={userPermissions.role}
        onEditorChange={handleEditorChange}
        onVersionBump={handleVersionBump}
        onToggleCollapse={handleToggleCollapse}
        onAddNotation={handleAddNotation}
        expandedNotationPaths={expandedNotationPaths}
        documentId={selectedDocument?.id}
        patches={patches}
        onImportVersion={handleImportVersion}
        currentFileType={selectedDocument?.file_type}
        suggestedVersion={suggestedVersion}
        workspaceId={selectedDocument?.workspace_id}
        isStylesDialogOpen={isStylesDialogOpen}
        onStylesDialogClose={() => setIsStylesDialogOpen(false)}
        isOpenApiImportOpen={isOpenApiImportOpen}
        onOpenApiImportClose={() => setIsOpenApiImportOpen(false)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        diagramRef={diagramRef}
      />
      
      {/* Version History Dialog */}
      <EditorVersionDialog 
        isOpen={isVersionHistoryOpen}
        onOpenChange={toggleVersionHistory}
        documentId={selectedDocument?.id || ''}
        onToggleSelection={handleToggleSelection}
        onMarkAsReleased={handleMarkAsReleased}
        onDeleteVersion={handleDeleteVersion}
        userRole={userPermissions.role}
        isOwner={userPermissions.isOwner}
      />
    </div>
  );
};
