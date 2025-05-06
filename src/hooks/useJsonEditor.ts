
import { useRef, useEffect, useState } from 'react';
import JSONEditor from 'jsoneditor';
import { CollapsedState } from '@/lib/diagram/types';
import { toast } from 'sonner';

interface UseJsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

interface FoldingDebugInfo {
  lastOperation: string;
  path: string;
  timestamp: number;
}

export const useJsonEditor = ({
  value,
  onChange,
  collapsedPaths = {},
  onToggleCollapse
}: UseJsonEditorProps) => {
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

  // Initialize the editor
  const initializeEditor = (container: HTMLDivElement) => {
    if (!container) return;

    try {
      // JSONEditor options
      const options = {
        mode: 'tree',
        mainMenuBar: false,
        navigationBar: true,
        statusBar: true,
        
        // Add direct collapse/expand event handlers in the options
        onExpand: function(node: any) {
          if (onToggleCollapse && node.path) {
            console.log('Expanded path via onExpand:', node.path);
            const path = 'root.' + node.path.join('.');
            setFoldingDebug({
              lastOperation: 'expand',
              path,
              timestamp: Date.now()
            });
            onToggleCollapse(path, false);
          }
        },
        
        onCollapse: function(node: any) {
          if (onToggleCollapse && node.path) {
            console.log('Collapsed path via onCollapse:', node.path);
            const path = 'root.' + node.path.join('.');
            setFoldingDebug({
              lastOperation: 'collapse',
              path,
              timestamp: Date.now()
            });
            onToggleCollapse(path, true);
          }
        },
        
        onChange: function () {
          if (isInternalChange.current) return;
          
          try {
            // Get the current editor content
            const json = editorRef.current?.get();
            // Convert to string
            const jsonStr = JSON.stringify(json, null, 2);
            // Update the parent component
            onChange(jsonStr);
            previousValueRef.current = jsonStr;
          } catch (err) {
            console.error('Error getting JSON from editor:', err);
          }
        }
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

      return editor;
    } catch (err) {
      console.error('Error initializing JSONEditor:', err);
      toast.error('Failed to initialize JSON editor', {
        description: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  };

  // Initialize the folding state after the editor is created
  const initializeFoldingState = () => {
    if (!editorRef.current || initialSetupDone.current) return;
    
    try {
      console.log('Initializing folding state...');
      
      // First, collapse all nodes
      collapseAll();
      
      // Then, expand only the first level (root node)
      setTimeout(() => {
        expandFirstLevel();
        
        // Mark initial setup as done
        initialSetupDone.current = true;
        
        console.log('Initial folding state setup completed');
      }, 100);
    } catch (err) {
      console.error('Error initializing folding state:', err);
    }
  };

  // Expand only the first level nodes
  const expandFirstLevel = () => {
    if (!editorRef.current) return;
    
    try {
      // First get the root node paths
      const rootNode = editorRef.current.get();
      
      // Check if it's an object
      if (rootNode && typeof rootNode === 'object') {
        // Expand the root node
        editorRef.current.expand(['']);
        
        // For each top-level property, expand it
        if (onToggleCollapse) {
          onToggleCollapse('root.', false);
        }
        
        console.log('Expanded first level nodes');
      }
    } catch (e) {
      console.error('Error expanding first level:', e);
    }
  };

  // Update editor content when the value prop changes
  useEffect(() => {
    if (!editorRef.current || value === previousValueRef.current) return;

    try {
      // Set flag to prevent onChange from triggering
      isInternalChange.current = true;
      
      // Update editor content
      try {
        editorRef.current.update(JSON.parse(value));
      } catch (e) {
        // If parsing fails, just show the raw text
        editorRef.current.setText(value);
      }
      
      // Update previous value
      previousValueRef.current = value;
    } catch (err) {
      console.error('Error updating JSONEditor:', err);
    } finally {
      // Clear flag after a short delay
      setTimeout(() => {
        isInternalChange.current = false;
      }, 0);
    }
  }, [value]);

  // Set up initial folding state after editor is initialized
  useEffect(() => {
    if (editorRef.current && !initialSetupDone.current) {
      initializeFoldingState();
    }
  }, [editorRef.current]);

  // Apply folding based on collapsedPaths prop
  useEffect(() => {
    if (!editorRef.current || !collapsedPaths) return;
    
    console.log('Applying folding state from props:', collapsedPaths);
    
    Object.entries(collapsedPaths).forEach(([path, isCollapsed]) => {
      if (!isCollapsed) return;
      
      try {
        // Remove the "root." prefix if present
        const processedPath = path.startsWith('root.') ? path.substring(5) : path;
        // Convert path string to array of keys
        const pathArray = processedPath.split('.');
        
        // Use the editor's collapse method
        if (editorRef.current) {
          const node = editorRef.current.getNodeByPath?.(pathArray);
          if (node) {
            console.log(`Collapsing node at path: ${path}`);
            editorRef.current.collapse?.(pathArray);
          }
        }
      } catch (err) {
        console.warn(`Failed to collapse path ${path}:`, err);
      }
    });
  }, [collapsedPaths]);

  // Utility functions for the editor
  const expandAll = () => {
    try {
      editorRef.current?.expandAll();
      toast.success('All nodes expanded');
    } catch (e) {
      console.error('Error expanding all:', e);
    }
  };

  const collapseAll = () => {
    try {
      editorRef.current?.collapseAll();
      toast.success('All nodes collapsed');
    } catch (e) {
      console.error('Error collapsing all:', e);
    }
  };

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
