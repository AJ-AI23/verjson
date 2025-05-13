
import { useRef, useCallback } from 'react';
import JSONEditor from 'jsoneditor';
import { toast } from 'sonner';

interface UseJsonEditorInitializationProps {
  value: string;
  createEditorEventHandlers: () => any;
}

export const useJsonEditorInitialization = ({
  value,
  createEditorEventHandlers
}: UseJsonEditorInitializationProps) => {
  // Create a ref to store the JSONEditor instance
  const editorRef = useRef<JSONEditor | null>(null);
  
  // Initialize the editor
  const initializeEditor = useCallback((container: HTMLDivElement) => {
    if (!container) return null;

    try {
      // Get event handlers from our events hook
      const eventHandlers = createEditorEventHandlers();
      
      // JSONEditor options
      const options = {
        mode: 'tree',
        mainMenuBar: false,
        navigationBar: true,
        statusBar: true,
        schema: null, // No schema validation by default
        schemaRefs: null, // No schema references by default
        enableSort: false, // Disable sorting to avoid validation issues
        enableTransform: false, // Disable transform to avoid validation issues
        ...eventHandlers,
      };

      // Create the editor
      const editor = new JSONEditor(container, options);
      
      // Disable built-in validation features
      if (editor.validate) {
        // Override validate method if it exists to avoid undefined issues
        editor.validate = () => [];
      }
      
      // Store the editor instance in the ref
      editorRef.current = editor;
      
      // Set initial content - Use a timeout to avoid DOM manipulation issues
      setTimeout(() => {
        if (editorRef.current) {
          try {
            if (value && value.trim() !== '') {
              const parsedValue = JSON.parse(value);
              editorRef.current.set(parsedValue);
            } else {
              // Set empty object if no value provided
              editorRef.current.set({});
            }
          } catch (e) {
            // If parsing fails, just show the raw text
            if (editorRef.current) {
              editorRef.current.setText(value || '{}');
            }
            console.error('Failed to parse initial JSON:', e);
          }
        }
      }, 100);
      
      return editor;
    } catch (err) {
      console.error('Error initializing JSONEditor:', err);
      toast.error('Failed to initialize JSON editor', {
        description: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  }, [value, createEditorEventHandlers]);

  // Cleanup function
  const destroyEditor = useCallback(() => {
    if (editorRef.current) {
      try {
        editorRef.current.destroy();
      } catch (e) {
        console.error('Error destroying editor:', e);
      }
      editorRef.current = null;
    }
  }, []);

  return {
    editorRef,
    initializeEditor,
    destroyEditor
  };
};
