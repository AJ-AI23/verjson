
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
  onClose?: () => void;
}

export const Editor = ({ initialSchema, onSave, documentName, selectedDocument, onClearRequest, onClose }: EditorProps) => {
  
  // Convert initialSchema to string if it's an object to prevent crashes in versioning hooks
  const schemaAsString = React.useMemo(() => {
    if (initialSchema && typeof initialSchema === 'object') {
      return JSON.stringify(initialSchema, null, 2);
    }
    return initialSchema || defaultSchema;
  }, [initialSchema]);
  
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
    handleImportVersion
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
      // Detect the schema type and update it
      const detectedType = detectSchemaType(initialSchema);
      if (detectedType !== schemaType) {
        handleSchemaTypeChange(detectedType);
      }
      
      const schemaString = JSON.stringify(initialSchema, null, 2);
      setSchema(schemaString);
      setSavedSchema(schemaString);
      // Start with root expanded to show child nodes by default
      setCollapsedPaths({ root: false });
      lastLoadedSchemaRef.current = initialSchema;
    }
  }, [initialSchema, setSchema, setSavedSchema, setCollapsedPaths, schemaType, handleSchemaTypeChange]);
  
  
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
        patches={patches}
        onImportVersion={handleImportVersion}
        currentFileType={selectedDocument?.file_type}
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
