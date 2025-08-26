
import React from 'react';
import { defaultSchema } from '@/lib/defaultSchema';
import { EditorToolbar } from './schema/EditorToolbar';
import { EditorContent } from './schema/EditorContent';
import { useEditorState } from './editor/useEditorState';
import { EditorVersionDialog } from './editor/EditorVersionDialog';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';

interface EditorProps {
  initialSchema?: any;
  onSave?: (content: any) => void;
  documentName?: string;
}

export const Editor = ({ initialSchema, onSave, documentName }: EditorProps) => {
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
    expandedNotationPaths
  } = useEditorState(initialSchema || defaultSchema);

  // Update editor state when initialSchema changes (document selection)
  const lastLoadedSchemaRef = React.useRef<any>(null);
  
  React.useEffect(() => {
    if (initialSchema && typeof initialSchema === 'object' && initialSchema !== lastLoadedSchemaRef.current) {
      const schemaString = JSON.stringify(initialSchema, null, 2);
      console.log('Loading new document content into editor:', schemaString.substring(0, 100));
      setSchema(schemaString);
      setSavedSchema(schemaString);
      setCollapsedPaths({ root: true });
      lastLoadedSchemaRef.current = initialSchema;
    }
  }, [initialSchema, setSchema, setSavedSchema, setCollapsedPaths]);

  // Track if this is the initial load to prevent auto-save on document load
  const [hasUserMadeChanges, setHasUserMadeChanges] = React.useState(false);
  const initialSchemaRef = React.useRef(initialSchema);
  
  // Reset tracking when a new document is loaded
  React.useEffect(() => {
    if (initialSchema !== initialSchemaRef.current) {
      setHasUserMadeChanges(false);
      initialSchemaRef.current = initialSchema;
    }
  }, [initialSchema]);
  
  // Track when user makes changes (not initial load)
  React.useEffect(() => {
    if (parsedSchema && initialSchema && JSON.stringify(parsedSchema) !== JSON.stringify(initialSchema)) {
      setHasUserMadeChanges(true);
    }
  }, [parsedSchema, initialSchema]);

  // Save document when schema changes (only after user makes changes)
  React.useEffect(() => {
    if (onSave && parsedSchema && initialSchema && hasUserMadeChanges) {
      const timeoutId = setTimeout(() => {
        onSave(parsedSchema);
      }, 1000); // Auto-save after 1 second of no changes
      
      return () => clearTimeout(timeoutId);
    }
  }, [parsedSchema, onSave, initialSchema, hasUserMadeChanges]);
  
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
      />
      
      {/* Version History Dialog */}
      <EditorVersionDialog 
        isOpen={isVersionHistoryOpen}
        onOpenChange={toggleVersionHistory}
        patches={patches}
        onToggleSelection={handleToggleSelection}
        onMarkAsReleased={handleMarkAsReleased}
        onDeleteVersion={handleDeleteVersion}
      />
    </div>
  );
};
