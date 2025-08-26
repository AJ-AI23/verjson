
import React from 'react';
import { defaultSchema } from '@/lib/defaultSchema';
import { EditorToolbar } from './schema/EditorToolbar';
import { EditorContent } from './schema/EditorContent';
import { useEditorState } from './editor/useEditorState';
import { EditorVersionDialog } from './editor/EditorVersionDialog';
import { detectSchemaType } from '@/lib/schemaUtils';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';

interface EditorProps {
  initialSchema?: any;
  onSave?: (content: any) => void;
  documentName?: string;
  selectedDocument?: any;
  onClearRequest?: boolean;
}

export const Editor = ({ initialSchema, onSave, documentName, selectedDocument, onClearRequest }: EditorProps) => {
  console.log('Editor: selectedDocument received:', selectedDocument);
  console.log('Editor: selectedDocument.id:', selectedDocument?.id);
  console.log('Editor: typeof selectedDocument.id:', typeof selectedDocument?.id);
  
  const { settings, updateGroupProperties } = useEditorSettings();
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
    handleImportSchema,
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
    clearEditorState
  } = useEditorState(initialSchema || defaultSchema, selectedDocument?.id);

  // Clear editor state when onClearRequest is triggered
  React.useEffect(() => {
    if (onClearRequest) {
      console.log('🧹 Editor: Clearing all editor state due to clear request');
      clearEditorState();
    }
  }, [onClearRequest, clearEditorState]);

  // Update editor state when initialSchema changes (document selection)
  const lastLoadedSchemaRef = React.useRef<any>(null);
  
  React.useEffect(() => {
    if (initialSchema && typeof initialSchema === 'object' && initialSchema !== lastLoadedSchemaRef.current) {
      const schemaString = JSON.stringify(initialSchema, null, 2);
      console.log('Loading new document content into editor:', schemaString.substring(0, 100));
      
      // Detect the schema type and update it
      const detectedType = detectSchemaType(initialSchema);
      console.log('Detected schema type:', detectedType);
      if (detectedType !== schemaType) {
        handleSchemaTypeChange(detectedType);
      }
      
      setSchema(schemaString);
      setSavedSchema(schemaString);
      setCollapsedPaths({ root: true });
      lastLoadedSchemaRef.current = initialSchema;
    }
  }, [initialSchema, setSchema, setSavedSchema, setCollapsedPaths, schemaType, handleSchemaTypeChange]);
  
  // Debug version history state
  React.useEffect(() => {
    console.log('🔍 Editor: Version history state check:', {
      isVersionHistoryOpen,
      patchesCount: patches?.length || 0,
      patchesDefined: !!patches,
      patches: patches?.map(p => ({ id: p.id, description: p.description, version: `${p.version.major}.${p.version.minor}.${p.version.patch}` })) || 'NO PATCHES'
    });
  }, [isVersionHistoryOpen, patches]);
  
  return (
    <div className="json-schema-editor">
      <EditorToolbar
        schema={schema}
        schemaType={schemaType}
        groupProperties={settings.groupProperties}
        maxDepth={settings.maxDepth}
        onSchemaTypeChange={handleSchemaTypeChange}
        onGroupPropertiesChange={updateGroupProperties}
        onImport={handleImportSchema}
        toggleVersionHistory={toggleVersionHistory}
        setSchema={setSchema}
        setSavedSchema={setSavedSchema}
        onAddNotation={handleAddNotation}
        documentName={documentName}
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
        onEditorChange={handleEditorChange}
        onVersionBump={handleVersionBump}
        onToggleCollapse={handleToggleCollapse}
        onAddNotation={handleAddNotation}
        expandedNotationPaths={expandedNotationPaths}
        documentId={selectedDocument?.id}
      />
      
      {/* Version History Dialog */}
      <EditorVersionDialog 
        isOpen={isVersionHistoryOpen}
        onOpenChange={toggleVersionHistory}
        documentId={selectedDocument?.id || ''}
        onToggleSelection={handleToggleSelection}
        onMarkAsReleased={handleMarkAsReleased}
        onDeleteVersion={handleDeleteVersion}
      />
    </div>
  );
};
