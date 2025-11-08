
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
  
  // Check sessionStorage FIRST before converting initialSchema
  const [effectiveSchema, setEffectiveSchema] = React.useState<any>(null);
  const hasCheckedCacheRef = React.useRef<string | null>(null);
  
  // Check cache on mount or document change
  React.useEffect(() => {
    const docId = selectedDocument?.id;
    if (!docId) {
      setEffectiveSchema(initialSchema);
      return;
    }
    
    // Only check cache once per document
    if (hasCheckedCacheRef.current === docId) {
      return;
    }
    
    hasCheckedCacheRef.current = docId;
    
    // Try to load from sessionStorage
    const cacheKey = `editor-cache-${docId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { schema, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        // Only use cache if less than 1 hour old
        if (age < 60 * 60 * 1000) {
          console.log('📦 Restoring from sessionStorage cache');
          setEffectiveSchema(JSON.parse(schema));
          return;
        } else {
          console.log('🗑️ Cache expired, clearing');
          sessionStorage.removeItem(cacheKey);
        }
      }
    } catch (err) {
      console.error('Failed to restore from cache:', err);
    }
    
    // No cache, use initialSchema
    setEffectiveSchema(initialSchema);
  }, [selectedDocument?.id, initialSchema]);
  
  // Convert effectiveSchema to string if it's an object
  const schemaAsString = React.useMemo(() => {
    if (effectiveSchema && typeof effectiveSchema === 'object') {
      return JSON.stringify(effectiveSchema, null, 2);
    }
    return effectiveSchema || defaultSchema;
  }, [effectiveSchema]);
  
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
  const { clearCache, hasCachedChanges } = useEditorSessionCache({
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
  
  // Track current schema value
  React.useEffect(() => {
    currentSchemaRef.current = schema;
  }, [schema]);
  
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
