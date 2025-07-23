
import React from 'react';
import { defaultSchema } from '@/lib/defaultSchema';
import { EditorToolbar } from './schema/EditorToolbar';
import { EditorContent } from './schema/EditorContent';
import { useEditorState } from './editor/useEditorState';
import { EditorDebugControls } from './editor/EditorDebugControls';
import { EditorVersionDialog } from './editor/EditorVersionDialog';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';

export const Editor = () => {
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
    handleRevertToVersion
  } = useEditorState(defaultSchema);
  
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
      />
      
      {/* Debug controls */}
      <EditorDebugControls 
        collapsedPaths={collapsedPaths}
        setCollapsedPaths={setCollapsedPaths}
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
      />
      
      {/* Version History Dialog */}
      <EditorVersionDialog 
        isOpen={isVersionHistoryOpen}
        onOpenChange={toggleVersionHistory}
        patches={patches}
        onRevert={handleRevertToVersion}
      />
    </div>
  );
};
