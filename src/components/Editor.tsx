
import React from 'react';
import { defaultSchema } from '@/lib/defaultSchema';
import { EditorToolbar } from './schema/EditorToolbar';
import { EditorContent } from './schema/EditorContent';
import { useEditorState } from './editor/useEditorState';
import { EditorVersionDialog } from './editor/EditorVersionDialog';
import { VersionMismatchRibbon } from './editor/VersionMismatchRibbon';
import { detectSchemaType } from '@/lib/schemaUtils';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';
import { useDocumentPermissions } from '@/hooks/useDocumentPermissions';
import { useDocumentVersions } from '@/hooks/useDocumentVersions';
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
  const [showVersionMismatch, setShowVersionMismatch] = React.useState(false);
  const [loadedVersionId, setLoadedVersionId] = React.useState<string | null>(null);
  const diagramRef = React.useRef<HTMLDivElement>(null);
  const editorInstanceId = React.useRef(Math.random().toString(36).slice(2, 8)).current;

  // Debug tracing for reset issues
  React.useEffect(() => {
    console.log(`[Editor ${editorInstanceId}] MOUNT`, {
      selectedDocumentId: selectedDocument?.id,
      fileType: selectedDocument?.file_type,
      hasInitialSchema: !!initialSchema,
      initialSchemaType: typeof initialSchema,
    });
    return () => {
      console.log(`[Editor ${editorInstanceId}] UNMOUNT`, {
        selectedDocumentId: selectedDocument?.id,
        fileType: selectedDocument?.file_type,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    console.log(`[Editor ${editorInstanceId}] props update`, {
      selectedDocumentId: selectedDocument?.id,
      fileType: selectedDocument?.file_type,
      initialSchemaType: typeof initialSchema,
      initialSchemaSignals: initialSchema && typeof initialSchema === 'object'
        ? {
            hasVerjson: !!(initialSchema as any).verjson,
            hasOpenapi: !!(initialSchema as any).openapi,
            type: (initialSchema as any).type,
            verjson: (initialSchema as any).verjson,
          }
        : null,
    });
  }, [selectedDocument?.id, selectedDocument?.file_type, initialSchema]);

  React.useEffect(() => {
    console.log(`[Editor ${editorInstanceId}] loadedVersionId`, {
      loadedVersionId,
    });
  }, [loadedVersionId]);
  
  // Fetch versions to detect mismatches
  const { versions, getSchemaPatches } = useDocumentVersions(selectedDocument?.id);
  
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

  // Ensure schema type is correctly set based on document's file_type
  React.useEffect(() => {
    if (!selectedDocument?.file_type) return;
    
    const documentFileType = selectedDocument.file_type;
    if (documentFileType === 'openapi' && schemaType !== 'openapi') {
      console.log('📝 Correcting schema type to match document file_type:', documentFileType);
      handleSchemaTypeChange('openapi');
    } else if (documentFileType !== 'openapi' && documentFileType !== 'diagram' && schemaType !== 'json-schema') {
      console.log('📝 Correcting schema type to match document file_type:', documentFileType);
      handleSchemaTypeChange('json-schema');
    }
  }, [selectedDocument?.file_type, schemaType, handleSchemaTypeChange]);

  // Clear editor state when onClearRequest is triggered
  React.useEffect(() => {
    if (onClearRequest) {
      clearEditorState();
    }
  }, [onClearRequest, clearEditorState]);

  // Handle reloading editor with latest version
  const handleReloadWithLatestVersion = React.useCallback(() => {
    // Prefer the newest version that has full_document (released snapshots)
    const latestWithFullDocument = versions
      .filter(v => !!v.full_document)
      .reduce((latest, current) => {
        const latestNum = latest.version_major * 1000000 + latest.version_minor * 1000 + latest.version_patch;
        const currentNum = current.version_major * 1000000 + current.version_minor * 1000 + current.version_patch;
        return currentNum > latestNum ? current : latest;
      }, versions.find(v => !!v.full_document)!);

    if (!latestWithFullDocument?.full_document) {
      console.warn('🔄 Cannot reload - no version with full_document available');
      return;
    }
    
    console.log('📝 EDITOR CHANGE from handleReloadWithLatestVersion - version:', latestWithFullDocument.id);
    
    // Use the full_document from the selected version, NOT initialSchema
    const versionContent = latestWithFullDocument.full_document;
    const detectedType = detectSchemaType(versionContent);
    if (detectedType !== schemaType) {
      handleSchemaTypeChange(detectedType);
    }
    
    const schemaString = JSON.stringify(versionContent, null, 2);
    console.log('📝 Setting schema from version.full_document, length:', schemaString.length);
    setSchema(schemaString);
    setSavedSchema(schemaString);
    setCollapsedPaths({ root: true });
    setLoadedVersionId(latestWithFullDocument.id);
    setShowVersionMismatch(false);
  }, [versions, schemaType, handleSchemaTypeChange, setSchema, setSavedSchema, setCollapsedPaths]);

  // Check for version mismatches
  React.useEffect(() => {
    if (!selectedDocument?.id || !versions.length) return;
    
    // Find the latest version by version number (not just selected)
    const latestVersion = versions.reduce((latest, current) => {
      const latestNum = latest.version_major * 1000000 + latest.version_minor * 1000 + latest.version_patch;
      const currentNum = current.version_major * 1000000 + current.version_minor * 1000 + current.version_patch;
      return currentNum > latestNum ? current : latest;
    });
    
    console.log('🔔 Version comparison:', {
      trackedVersionId: loadedVersionId,
      latestVersionId: latestVersion.id,
      versionsCount: versions.length,
      isModified,
      match: latestVersion.id === loadedVersionId
    });
    
    // On first load, track the latest version
    if (!loadedVersionId) {
      console.log('📌 Tracking loaded version:', latestVersion.id);
      setLoadedVersionId(latestVersion.id);
      return;
    }
    
    const loadedVersionExists = versions.some(v => v.id === loadedVersionId);

    // If the tracked version isn't in the list yet, do nothing.
    // This happens briefly right after committing (the Editor-level versions list lags behind).
    if (!loadedVersionExists) {
      console.log('⏳ Skipping mismatch check - tracked version not in version list yet', {
        trackedVersionId: loadedVersionId,
        latestVersionId: latestVersion.id,
        versionsCount: versions.length,
      });
      return;
    }

    // External change detected (a newer version exists than the one we loaded)
    if (latestVersion.id !== loadedVersionId) {
      console.log('⚠️ External version change detected:', {
        trackedVersionId: loadedVersionId,
        latestVersionId: latestVersion.id,
        hasChanges: isModified
      });

      // Never auto-reload here (would discard user context); only warn when user has edits.
      if (isModified) {
        setShowVersionMismatch(true);
      }
    }
  }, [versions, loadedVersionId, isModified, selectedDocument?.id, handleReloadWithLatestVersion]);

  // Update editor state when initialSchema changes (document selection)
  const lastLoadedSchemaRef = React.useRef<any>(null);
  const lastLoadedDocumentIdRef = React.useRef<string | null>(null);
  
  React.useEffect(() => {
    // Only load initialSchema when:
    // 1. Document ID actually changes (switching documents)
    // 2. OR it's the first load of this component
    const currentDocId = selectedDocument?.id || null;
    const isDocumentSwitch = currentDocId !== lastLoadedDocumentIdRef.current;
    const isSameDocument = initialSchema === lastLoadedSchemaRef.current;

    console.log(`[Editor ${editorInstanceId}] initialSchema sync check`, {
      currentDocId,
      lastLoadedDocumentId: lastLoadedDocumentIdRef.current,
      isDocumentSwitch,
      isSameDocument,
      isModified,
      schemaEqualsSaved: schema === savedSchema,
      schemaType,
      initialSchemaType: typeof initialSchema,
      hasInitialSchema: !!initialSchema,
    });
    
    // If it's the same document and we're not modified, ignore prop changes
    // This prevents reloads from tab switching or parent re-renders
    if (!isDocumentSwitch && isSameDocument) {
      console.log(`[Editor ${editorInstanceId}] initialSchema sync: skip (same ref, not a doc switch)`);
      return;
    }
    
    // If we have uncommitted changes, NEVER reload
    if (isModified) {
      console.log('🛡️ Preventing schema reload - isModified=true');
      console.log(`[Editor ${editorInstanceId}] initialSchema sync: skip (isModified=true)`);
      lastLoadedSchemaRef.current = initialSchema;
      return;
    }
    
    // Additional check: if current schema differs from saved schema, don't reload
    if (schema !== savedSchema) {
      console.log('🛡️ Preventing schema reload - uncommitted changes detected');
      console.log(`[Editor ${editorInstanceId}] initialSchema sync: skip (schema!=savedSchema)`);
      lastLoadedSchemaRef.current = initialSchema;
      return;
    }
    
    // Safe to load only on document switch
    if (isDocumentSwitch && initialSchema && typeof initialSchema === 'object') {
      console.log('📝 EDITOR CHANGE from document switch - loading:', currentDocId);
      console.log(`[Editor ${editorInstanceId}] initialSchema sync: APPLY`, {
        currentDocId,
        prevDocId: lastLoadedDocumentIdRef.current,
      });
      
      const detectedType = detectSchemaType(initialSchema);
      if (detectedType !== schemaType) {
        handleSchemaTypeChange(detectedType);
      }
      
      const schemaString = JSON.stringify(initialSchema, null, 2);
      console.log('📝 Setting schema from initialSchema prop, length:', schemaString.length);
      setSchema(schemaString);
      setSavedSchema(schemaString);
      setCollapsedPaths({ root: true });
      lastLoadedSchemaRef.current = initialSchema;
      lastLoadedDocumentIdRef.current = currentDocId;
      
      // Track the loaded version
      setLoadedVersionId(null); // Reset on document switch
    }
  }, [initialSchema, selectedDocument?.id, isModified, schema, savedSchema, schemaType, handleSchemaTypeChange, setSchema, setSavedSchema, setCollapsedPaths, editorInstanceId]);
  
  
  return (
    <div className="json-schema-editor">
      <VersionMismatchRibbon
        isVisible={showVersionMismatch}
        onDismiss={() => setShowVersionMismatch(false)}
        onStartFresh={handleReloadWithLatestVersion}
        onKeepEdits={() => setShowVersionMismatch(false)}
        documentId={selectedDocument?.id}
      />
      
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
        onVersionBump={async (newVersion, tier, description) => {
          const newVersionId = await handleVersionBump(newVersion, tier, description);
          // Track the newly created version to prevent mismatch detection
          if (newVersionId) {
            console.log('📌 Tracking newly committed version:', newVersionId);
            setLoadedVersionId(newVersionId);
          }
        }}
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
