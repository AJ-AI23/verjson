
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
      // First, make sure we don't have an existing editor
      if (editorRef.current) {
        try {
          editorRef.current.destroy();
        } catch (e) {
          console.error('Error destroying previous editor:', e);
        }
        editorRef.current = null;
      }
      
      // Clear the container first to avoid DOM conflicts
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      // Get event handlers from our events hook
      const eventHandlers = createEditorEventHandlers();
      
      // JSONEditor options
      const options = {
        mode: 'tree',
        mainMenuBar: false,
        navigationBar: true,
        statusBar: true,
        enableSort: false, // Disable sorting to avoid validation issues
        enableTransform: false, // Disable transform to avoid validation issues
        ...eventHandlers,
      };

      // Create the editor with a timeout to ensure DOM is ready
      setTimeout(() => {
        try {
          // Create the editor
          const editor = new JSONEditor(container, options);
          
          // Disable built-in validation features
          if (editor.validate) {
            editor.validate = () => [];
          }
          
          // Store the editor instance in the ref
          editorRef.current = editor;
          
          // Set initial content with a longer timeout
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
                console.log('JSON Editor content set successfully');
              } catch (e) {
                console.error('Failed to parse initial JSON:', e);
                // If parsing fails, try setting a simple empty object
                if (editorRef.current) {
                  try {
                    editorRef.current.set({});
                    console.log('Set empty object as fallback');
                  } catch (setErr) {
                    console.error('Failed to set fallback content:', setErr);
                  }
                }
              }
            }
          }, 200); // Increased timeout for setting content
        } catch (createErr) {
          console.error('Error creating JSON editor instance:', createErr);
        }
      }, 100); // Initial timeout for editor creation
      
      return null; // Return null initially, editor is set async
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
