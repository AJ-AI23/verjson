
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
  
  // Store a local copy of collapsedPaths for debugging
  const collapsedPathsRef = useRef<Record<string, boolean>>(collapsedPaths);

  // Update the ref when collapsedPaths changes
  useEffect(() => {
    collapsedPathsRef.current = collapsedPaths;
    console.log('collapsedPathsRef updated:', collapsedPathsRef.current);
  }, [collapsedPaths]);

  // Use our separate hook modules
  const { syncEditorWithProps } = useJsonEditorSync({ 
    editorRef, isInternalChange, previousValueRef, value, onChange 
  });
  
  const { expandAll, collapseAll, expandFirstLevel } = useJsonEditorFolding({ 
    editorRef, 
    onToggleCollapse,
    collapsedPaths: collapsedPathsRef.current
  });
  
  const { createEditorEventHandlers } = useJsonEditorEvents({
    onToggleCollapse,
    setFoldingDebug,
    collapsedPaths: collapsedPathsRef.current
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
      
      console.log("Editor initialized with collapsedPaths:", collapsedPathsRef.current);
      
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
      console.log("Running initial folding setup...");
      console.log("Initial collapsedPaths:", collapsedPathsRef.current);
      
      // Make sure we have the root state set properly first
      if (onToggleCollapse && collapsedPathsRef.current['root'] === undefined) {
        console.log("Setting initial root state to collapsed");
        onToggleCollapse('root', true);
      }
      
      // Wait a moment for the editor to fully initialize
      const timer = setTimeout(() => {
        // First, perform expandFirstLevel which will:
        // 1. Collapse all nodes
        // 2. Then expand just the root node
        console.log("Performing initial expand first level");
        expandFirstLevel();
        
        // Mark initial setup as done
        initialSetupDone.current = true;
        
        console.log('Initial folding setup completed with state:', collapsedPathsRef.current);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [editorRef.current, onToggleCollapse, expandFirstLevel]);

  // Additional effect to apply collapsedPaths changes to the editor
  useEffect(() => {
    // Skip during initial setup
    if (!editorRef.current || !initialSetupDone.current) return;
    
    // This effect monitors collapsedPaths changes and applies them to the editor
    console.log('collapsedPaths changed, applying to editor:', collapsedPaths);
    
    // Implementation depends on JSONEditor's API capabilities
    // This is a simplified approach - may need adjustment based on actual API
    
    try {
      const editor = editorRef.current;
      
      // We can't directly set fold state for specific paths
      // But we can apply the current state
      if (editor && Object.keys(collapsedPaths).length > 0) {
        // First expand everything
        editor.expandAll();
        
        // Then collapse nodes that should be collapsed
        Object.entries(collapsedPaths).forEach(([path, isCollapsed]) => {
          if (isCollapsed) {
            console.log(`Should collapse ${path} but JSONEditor API doesn't support direct path folding`);
            // Unfortunately, JSONEditor doesn't provide API to collapse specific paths
            // This would require custom implementation using editor internals
          }
        });
      }
    } catch (e) {
      console.error('Error applying collapsed paths to editor:', e);
    }
  }, [collapsedPaths]);

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
