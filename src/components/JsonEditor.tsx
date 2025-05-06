
import React, { useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { parseJsonSchema } from '@/lib/schemaUtils';
import { CollapsedState } from '@/lib/diagram/types';
import { useMonacoEditor } from '@/hooks/useMonacoEditor';
import { EditorToolbar } from './editor/EditorToolbar';
import { EditorError } from './editor/EditorError';
import { monacoEditorOptions } from '@/lib/editorConfig';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const JsonEditor = ({ 
  value, 
  onChange, 
  error, 
  collapsedPaths = {},
  onToggleCollapse 
}: JsonEditorProps) => {
  const { 
    editorRef,
    handleEditorDidMount,
    handleFormatCode,
    updateCollapsedPathsRef,
    forceFoldingRefresh,
    DebugFoldingButton
  } = useMonacoEditor({ 
    onToggleCollapse, 
    collapsedPaths 
  });

  // Update reference when collapsedPaths prop changes
  useEffect(() => {
    updateCollapsedPathsRef(collapsedPaths);
  }, [collapsedPaths, updateCollapsedPathsRef]);

  const validateOnChange = (value: string | undefined) => {
    const newValue = value || '';
    onChange(newValue);
    
    // Quick validation feedback without blocking
    try {
      parseJsonSchema(newValue);
    } catch (err) {
      // Don't show toast for every keystroke - this is just for the editor's internal state
      // The proper validation is handled by the parent component
    }
  };

  const handleInspectEditor = () => {
    if (window.inspectMonacoEditor) {
      window.inspectMonacoEditor();
    }
  };

  // Additional toolbar action to refresh folding analysis
  const handleRefreshFolding = () => {
    const result = forceFoldingRefresh();
    console.log('Folding refresh result:', result);
  };

  return (
    <div className="h-full flex flex-col">
      <EditorToolbar 
        onFormatCode={handleFormatCode}
        onInspectEditor={handleInspectEditor}
        extraButtons={<DebugFoldingButton />}
      />
      <div className="flex-1 editor-container">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={value}
          onChange={validateOnChange}
          onMount={handleEditorDidMount}
          options={monacoEditorOptions}
        />
      </div>
      <EditorError error={error} />
    </div>
  );
};

// Add inspectMonacoEditor to window type
declare global {
  interface Window {
    inspectMonacoEditor?: () => void;
  }
}
