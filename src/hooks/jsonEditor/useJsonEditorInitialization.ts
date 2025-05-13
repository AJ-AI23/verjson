
import { useRef, useCallback } from 'react';
import JSONEditor from 'jsoneditor';
import { toast } from '@/components/ui/use-toast';

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
        onEditable: function() { return true; },
        onExpand: eventHandlers.onExpand,
        onCollapse: eventHandlers.onCollapse
      };

      // Create the editor
      const editor = new JSONEditor(container, options);
      
      // Set initial content
      try {
        editor.set(JSON.parse(value));
      } catch (e) {
        // If parsing fails, just show the raw text
        editor.setText(value);
        console.error('Failed to parse initial JSON:', e);
      }

      // Store the editor instance in the ref
      editorRef.current = editor;
      console.log('JSONEditor initialized with event handlers');
      
      return editor;
    } catch (err) {
      console.error('Error initializing JSONEditor:', err);
      toast({
        variant: "destructive",
        title: "Failed to initialize JSON editor",
        description: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  }, [value, createEditorEventHandlers]);

  // Cleanup function
  const destroyEditor = () => {
    if (editorRef.current) {
      editorRef.current.destroy();
      editorRef.current = null;
    }
  };

  return {
    editorRef,
    initializeEditor,
    destroyEditor
  };
};
