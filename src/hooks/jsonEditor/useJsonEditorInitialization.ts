import { useCallback, useEffect } from 'react';
import JSONEditor from 'jsoneditor';

interface UseJsonEditorInitializationProps {
  value: string;
  editorRef: React.MutableRefObject<any>;
  createEditorEventHandlers: () => any;
}

export const useJsonEditorInitialization = ({
  value,
  editorRef,
  createEditorEventHandlers
}: UseJsonEditorInitializationProps) => {
  
  const initializeEditor = useCallback((container: HTMLElement) => {
    try {
      // Parse the initial value
      let initialJson;
      try {
        initialJson = JSON.parse(value);
      } catch (parseError) {
        initialJson = {};
      }

      // Create event handlers
      const eventHandlers = createEditorEventHandlers();

      // Create editor options
      const options = {
        mode: 'tree' as const,
        modes: ['tree', 'view', 'form', 'code', 'text'] as const,
        indentation: 2,
        onChange: eventHandlers.onChange,
        onExpand: eventHandlers.onExpand,
        onError: (error: Error) => {
          // Silently handle editor errors
        },
        search: true,
        history: true,
        navigationBar: true,
        statusBar: true,
        sortObjectKeys: false,
        limitDragging: false,
      };

      // Initialize the JSONEditor
      const editor = new JSONEditor(container, options);
      editor.set(initialJson);

      // Store the editor instance in the ref
      editorRef.current = editor;
      
      return editor;
    } catch (err) {
      return null;
    }
  }, [value, createEditorEventHandlers, editorRef]);

  // Cleanup function
  const destroyEditor = useCallback(() => {
    if (editorRef.current) {
      try {
        editorRef.current.destroy();
      } catch (error) {
        // Silently handle cleanup errors
      }
      editorRef.current = null;
    }
  }, [editorRef]);

  return {
    initializeEditor,
    destroyEditor
  };
};