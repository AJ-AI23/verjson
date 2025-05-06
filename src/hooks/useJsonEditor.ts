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

      // Register event listeners for expand and collapse events
      if (typeof editor.on === 'function') {
        editor.on('expand', function (event) {
          console.log('Expanded path:', event.path);
          if (onToggleCollapse) {
            const path = 'root.' + event.path.join('.');
            setFoldingDebug({
              lastOperation: 'expand',
              path,
              timestamp: Date.now()
            });
            onToggleCollapse(path, false);
          }
        });
        
        editor.on('collapse', function (event) {
          console.log('Collapsed path:', event.path);
          if (onToggleCollapse) {
            const path = 'root.' + event.path.join('.');
            setFoldingDebug({
              lastOperation: 'collapse',
              path,
              timestamp: Date.now()
            });
            onToggleCollapse(path, true);
          }
        });
      } else {
        console.warn('JSONEditor instance does not support event listeners via .on()');
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
    foldingDebug
  };
};
