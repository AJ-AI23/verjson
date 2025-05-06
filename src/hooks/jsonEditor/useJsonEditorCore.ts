
import { useRef, useState, useEffect } from 'react';
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
    editorRef, 
    onToggleCollapse,
    collapsedPaths
  });
  
  const { createEditorEventHandlers } = useJsonEditorEvents({
    onToggleCollapse,
    setFoldingDebug,
    collapsedPaths
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
      
      // Log the initial state of collapsedPaths
      console.log('Initial collapsed state:', collapsedPaths);
      
      // Notify that we've created the editor
      if (onToggleCollapse) {
        // Set initial state of root as collapsed
        console.log('Collapse event:', { 
          path: 'root', 
          collapsed: true, 
          previousState: undefined
        });
        onToggleCollapse('root', true);
      }
      
      return editor;
    } catch (err) {
      console.error('Error initializing JSONEditor:', err);
      toast.error('Failed to initialize JSON editor', {
        description: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  };

  // Effect to handle initial folding state after initialization
  useEffect(() => {
    if (editorRef.current && !initialSetupDone.current) {
      // Wait a moment for the editor to fully initialize
      const timer = setTimeout(() => {
        // First, collapse all nodes
        collapseAll();
        
        // Then, expand only the first level (root node)
        setTimeout(() => {
          expandFirstLevel();
          
          // Mark initial setup as done
          initialSetupDone.current = true;
          
          console.log('Initial folding setup completed with state:', collapsedPaths);
        }, 100);
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [collapseAll, expandFirstLevel]);

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
    foldingDebug,
    collapsedPaths
  };
};
