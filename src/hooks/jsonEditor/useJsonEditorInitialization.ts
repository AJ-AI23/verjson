
import { useCallback, useEffect } from 'react';
import JSONEditor from 'jsoneditor';

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
  
  // Update event handlers when they change (e.g., when maxDepth changes)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    
    
    // Update the event handlers on the existing editor
    const newEventHandlers = createEditorEventHandlers();
    if (editor.options) {
      editor.options.onExpand = newEventHandlers.onExpand;
    }
  }, [createEditorEventHandlers, editorRef]);
  
  // Initialize the editor
  const initializeEditor = useCallback((container: HTMLDivElement) => {
    if (!container) return null;

    try {
      // Get event handlers from our events hook
      const eventHandlers = createEditorEventHandlers();
      
      console.log('Initializing JSONEditor with event handlers', eventHandlers);
      
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

      // Create the editor
      const editor = new JSONEditor(container, options);
      
      // Set initial content
      try {
        editor.set(JSON.parse(value));
        
        // Start fully collapsed to match initial collapsedPaths state
        setTimeout(() => {
          try {
            editor.collapseAll();
          } catch (e) {
            console.warn('Could not collapse editor on init:', e);
          }
        }, 100); // Small delay to ensure content is set
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
