
import { useCallback } from 'react';
import JSONEditor from 'jsoneditor';
import { toast } from '@/components/ui/use-toast';

interface UseJsonEditorInitializationProps {
  value: string;
  createEditorEventHandlers: () => any;
  editorRef: React.MutableRefObject<JSONEditor | null>;
}

export const useJsonEditorInitialization = ({
  value,
  createEditorEventHandlers,
  editorRef
}: UseJsonEditorInitializationProps) => {
  
  // Initialize the editor
  const initializeEditor = useCallback((container: HTMLDivElement) => {
    if (!container) return null;

    try {
      // Get event handlers from our events hook
      const eventHandlers = createEditorEventHandlers();
      
      console.log('Initializing JSONEditor with event handlers', eventHandlers);
      console.log('onExpand handler exists:', !!eventHandlers.onExpand);
      console.log('onExpand handler type:', typeof eventHandlers.onExpand);
      
      // JSONEditor options
      const options = {
        mode: 'tree',
        mainMenuBar: false,
        navigationBar: true,
        statusBar: true,
        limitDragging: false,
        maxVisibleChilds: 1000, // Increase the limit for visible children
        onEditable: function() { return true; },
        onExpand: eventHandlers.onExpand
        // Note: We don't use onCollapse anymore, as we rely on toggling with onExpand
      };

      console.log('JSONEditor options:', options);
      console.log('onExpand in options:', !!options.onExpand);

      // Create the editor
      const editor = new JSONEditor(container, options);
      
      console.log('JSONEditor created:', !!editor);
      console.log('Editor options after creation:', editor.options);
      console.log('Editor onExpand after creation:', !!editor.options?.onExpand);
      
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
      console.log('JSONEditor initialized with toggle event handler');
      
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
  }, [value, createEditorEventHandlers, editorRef]);

  // Cleanup function
  const destroyEditor = () => {
    if (editorRef.current) {
      editorRef.current.destroy();
      editorRef.current = null;
    }
  };

  return {
    initializeEditor,
    destroyEditor
  };
};
