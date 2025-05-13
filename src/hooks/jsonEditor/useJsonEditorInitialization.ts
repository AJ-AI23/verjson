
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
      
      console.log('Initializing JSONEditor with event handlers:', eventHandlers);
      
      // JSONEditor options
      const options = {
        mode: 'tree',
        mainMenuBar: false,
        navigationBar: true,
        statusBar: true,
        onEditable: function() { return true; },
        // Use the onExpand/onCollapse handlers
        onEvent: function(node, event) {
          console.log('JSONEditor event:', event.type, node);
          
          // Only process expand/collapse events
          if (event.type === 'expand' || event.type === 'collapse') {
            try {
              const path = node.path.length > 0 ? node.path.join('.') : 'root';
              const isCollapsed = event.type === 'collapse';
              
              console.log(`Node ${isCollapsed ? 'collapsed' : 'expanded'} at path:`, path);
              
              if (eventHandlers.onFoldChange) {
                console.log('Calling onFoldChange with path:', path, 'isCollapsed:', isCollapsed);
                eventHandlers.onFoldChange(path, isCollapsed);
              }
            } catch (err) {
              console.error(`Error in ${event.type} handler:`, err);
            }
          }
        }
      };

      // Create the editor
      const editor = new JSONEditor(container, options);
      console.log('JSONEditor instance created');
      
      // Set initial content
      try {
        editor.set(JSON.parse(value));
        console.log('Initial JSON content set in editor');
      } catch (e) {
        // If parsing fails, just show the raw text
        editor.setText(value);
        console.error('Failed to parse initial JSON:', e);
      }

      // Store the editor instance in the ref
      editorRef.current = editor;
      console.log('JSONEditor initialized successfully, instance stored in ref');
      
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
      console.log('Destroying JSONEditor instance');
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
