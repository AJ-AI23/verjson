
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
import { useEditorSessionCache } from '@/hooks/useEditorSessionCache';

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

  // Session cache for uncommitted changes
  const { loadCachedSchema, clearCache, hasCachedChanges } = useEditorSessionCache({
    documentId: selectedDocument?.id,
    currentSchema: schema,
    isModified
  });

  // Clear editor state when onClearRequest is triggered
  React.useEffect(() => {
    if (onClearRequest) {
      clearEditorState();
    }
  }, [onClearRequest, clearEditorState]);

  // Update editor state when initialSchema changes (document selection)
  const lastLoadedSchemaRef = React.useRef<any>(null);
  const lastLoadedContentRef = React.useRef<string>('');
  const currentSchemaRef = React.useRef<string>(schema);
  const hasLoadedCacheRef = React.useRef<boolean>(false);
  
  // Track current schema value
  React.useEffect(() => {
    currentSchemaRef.current = schema;
  }, [schema]);
  
  // Check for cached changes on document load
  React.useEffect(() => {
    if (selectedDocument?.id && !hasLoadedCacheRef.current) {
      const cachedSchema = loadCachedSchema();
      if (cachedSchema && cachedSchema !== schemaAsString) {
        console.log('🔄 Restoring uncommitted changes from sessionStorage');
        setSchema(cachedSchema);
        hasLoadedCacheRef.current = true;
        return;
      }
      hasLoadedCacheRef.current = true;
    }
  }, [selectedDocument?.id, loadCachedSchema, schemaAsString, setSchema]);
  
  React.useEffect(() => {
    if (initialSchema && typeof initialSchema === 'object' && initialSchema !== lastLoadedSchemaRef.current) {
      const incomingSchemaString = JSON.stringify(initialSchema, null, 2);
      
      // Check if this is actually the same content we already loaded
      // This prevents unnecessary reloads when the same object reference changes
      if (incomingSchemaString === lastLoadedContentRef.current) {
        lastLoadedSchemaRef.current = initialSchema;
        return;
      }
      
      // CRITICAL: Check sessionStorage first - if we have cached changes, don't reload from initialSchema
      if (hasCachedChanges()) {
        console.log('🛡️ Preventing schema reload - sessionStorage has uncommitted changes');
        lastLoadedSchemaRef.current = initialSchema;
        return;
      }
      
      // Don't overwrite unsaved changes when tab regains focus or component re-renders
      if (isModified) {
        console.log('🛡️ Preventing schema reload - document is modified (isModified=true)');
        lastLoadedSchemaRef.current = initialSchema;
        return;
      }
      
      // Additional protection: check if current editor content differs from both saved and incoming
      // This catches cases where diagram changes haven't updated isModified flag yet
      if (currentSchemaRef.current !== savedSchema && currentSchemaRef.current !== incomingSchemaString) {
        console.log('🛡️ Preventing schema reload - editor has uncommitted changes that differ from incoming schema');
        lastLoadedSchemaRef.current = initialSchema;
        return;
      }
      
      // Final protection: if current content is different from saved content, don't reload
      // This is the most aggressive check to prevent any data loss
      if (currentSchemaRef.current.trim() !== '' && currentSchemaRef.current !== savedSchema) {
        console.log('🛡️ Preventing schema reload - current schema differs from saved schema');
        lastLoadedSchemaRef.current = initialSchema;
        return;
      }
      
      console.log('✅ Loading schema - all safety checks passed');
      
      // Detect the schema type and update it
      const detectedType = detectSchemaType(initialSchema);
      if (detectedType !== schemaType) {
        handleSchemaTypeChange(detectedType);
      }
      
      setSchema(incomingSchemaString);
      setSavedSchema(incomingSchemaString);
      setCollapsedPaths({ root: true });
      lastLoadedSchemaRef.current = initialSchema;
      lastLoadedContentRef.current = incomingSchemaString;
    }
  }, [initialSchema, setSchema, setSavedSchema, setCollapsedPaths, schemaType, handleSchemaTypeChange, isModified, savedSchema, hasCachedChanges]);
  
  
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
        onSave={(content) => {
          // Clear sessionStorage cache before saving
          clearCache();
          if (onSave) {
            onSave(content);
          }
        }}
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
