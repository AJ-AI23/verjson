import { useRef, useState } from 'react';
import JSONEditor from 'jsoneditor';
import { toast } from 'sonner';
import { UseJsonEditorProps, FoldingDebugInfo, JsonEditorResult } from './types';
import { useJsonEditorSync } from './useJsonEditorSync';
import { useJsonEditorFolding } from './useJsonEditorFolding';
import { useJsonEditorEvents } from './useJsonEditorEvents';

export const useJsonEditor = ({
  value,
  onChange,
  collapsedPaths = {},
  onToggleCollapse
}: UseJsonEditorProps): JsonEditorResult => {
  // Create a ref to store the JSONEditor instance
  const editorRef = useRef<JSONEditor | null>(null);
  
  // Keep track of whether we're programmatically changing the editor
  // to avoid infinite loops when syncing state
  const isInternalChange = useRef<boolean>(false);
  
  // Previous value for comparison
  const previousValueRef = useRef<string>(value);
  
  // Initial setup done flag
  const initialSetupDone = useRef<boolean>(false);

  // Debug state to track folding operations
  const [foldingDebug, setFoldingDebug] = useState<FoldingDebugInfo | null>(null);

  // Use our separate hook modules
  const { syncEditorWithProps } = useJsonEditorSync({ 
    editorRef, isInternalChange, previousValueRef, value, onChange 
  });
  
  const { expandAll, collapseAll, expandFirstLevel } = useJsonEditorFolding({ 
    editorRef, onToggleCollapse 
  });
  
  const { createEditorEventHandlers } = useJsonEditorEvents({
    onToggleCollapse,
    setFoldingDebug
  });

  // Initialize the editor
  const initializeEditor = (container: HTMLDivElement) => {
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
        ...eventHandlers,
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
      
      // Set up initial folding state after a small delay
      setTimeout(() => {
        if (editorRef.current && !initialSetupDone.current) {
          // First, collapse all nodes
          collapseAll();
          
          // Then, expand only the first level (root node)
          setTimeout(() => {
            expandFirstLevel();
            
            // Mark initial setup as done
            initialSetupDone.current = true;
            
            console.log('Initial folding state setup completed');
          }, 100);
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
  };

  // Sync editor with props
  syncEditorWithProps();

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
    destroyEditor,
    expandAll,
    collapseAll,
    expandFirstLevel,
    foldingDebug
  };
};
