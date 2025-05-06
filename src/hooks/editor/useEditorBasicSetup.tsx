
import { useCallback } from 'react';
import { Monaco, OnMount } from '@monaco-editor/react';
import { toast } from 'sonner';

/**
 * Hook for basic Monaco editor setup
 */
export const useEditorBasicSetup = () => {
  // Configure JSON language features
  const configureJsonLanguage = useCallback((monaco: Monaco) => {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: false,
      schemaValidation: 'error',
      schemaRequest: 'warning',
      trailingCommas: 'error',
    });
  }, []);

  // Format JSON code
  const handleFormatCode = useCallback((editorRef: React.MutableRefObject<any>) => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
      toast.success('Schema formatted');
    }
  }, []);

  return {
    configureJsonLanguage,
    handleFormatCode
  };
};
