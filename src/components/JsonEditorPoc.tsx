import React, { useRef, useEffect, useState } from 'react';
import JSONEditor from 'jsoneditor';
import 'jsoneditor/dist/jsoneditor.css';
import { CollapsedState } from '@/lib/diagram/types';
import { toast } from 'sonner';

interface JsonEditorPocProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const JsonEditorPoc: React.FC<JsonEditorPocProps> = ({
  value,
  onChange,
  error,
  collapsedPaths = {},
  onToggleCollapse
}) => {
  // Create a ref to the editor container DOM element
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Create a ref to store the JSONEditor instance
  const editorRef = useRef<JSONEditor | null>(null);
  
  // Keep track of whether we're programmatically changing the editor
  // to avoid infinite loops when syncing state
  const isInternalChange = useRef(false);
  
  // Previous value for comparison
  const previousValueRef = useRef<string>(value);

  // Debug state to track folding operations
  const [foldingDebug, setFoldingDebug] = useState<{
    lastOperation: string;
    path: string;
    timestamp: number;
  } | null>(null);

  // Initialize the editor once the component mounts
  useEffect(() => {
    if (!containerRef.current) return;

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
      const editor = new JSONEditor(containerRef.current, options);
      
      // Set initial content
      try {
        editor.set(JSON.parse(value));
      } catch (e) {
        // If parsing fails, just show the raw text
        editor.setText(value);
        console.error('Failed to parse initial JSON:', e);
      }

      // Register event listeners for expand and collapse events
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

      // Store the editor instance in the ref
      editorRef.current = editor;

      // Cleanup function to destroy the editor when the component unmounts
      return () => {
        if (editorRef.current) {
          editorRef.current.destroy();
          editorRef.current = null;
        }
      };
    } catch (err) {
      console.error('Error initializing JSONEditor:', err);
      toast.error('Failed to initialize JSON editor', {
        description: err instanceof Error ? err.message : String(err)
      });
    }
  }, []);

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
    
    // Example implementation - this would need to be adapted to JSONEditor's API
    // This is a placeholder for the concept
    Object.entries(collapsedPaths).forEach(([path, isCollapsed]) => {
      if (!isCollapsed) return;
      
      try {
        // Remove the "root." prefix if present
        const processedPath = path.startsWith('root.') ? path.substring(5) : path;
        // Convert path string to array of keys
        const pathArray = processedPath.split('.');
        
        // JSONEditor has collapse/expand methods that takes a path array
        if (editorRef.current) {
          // Use the editor's collapse method - API may vary
          // This is conceptual and may need adjustment based on actual JSONEditor API
          const node = editorRef.current.getNodeByPath(pathArray);
          if (node) {
            console.log(`Collapsing node at path: ${path}`);
            editorRef.current.collapse(pathArray);
          }
        }
      } catch (err) {
        console.warn(`Failed to collapse path ${path}:`, err);
      }
    });
  }, [collapsedPaths]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-slate-50 flex justify-between items-center">
        <h2 className="font-semibold text-slate-700">JSONEditor Proof of Concept</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              try {
                editorRef.current?.expandAll();
                toast.success('All nodes expanded');
              } catch (e) {
                console.error('Error expanding all:', e);
              }
            }}
            className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={() => {
              try {
                editorRef.current?.collapseAll();
                toast.success('All nodes collapsed');
              } catch (e) {
                console.error('Error collapsing all:', e);
              }
            }}
            className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>
      
      {/* The container for the JSONEditor instance */}
      <div className="flex-1 editor-container" ref={containerRef}></div>
      
      {/* Error display */}
      {error && (
        <div className="p-2 bg-red-50 border-t border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}
      
      {/* Debug info - can be removed in production */}
      {foldingDebug && (
        <div className="p-1 bg-blue-50 border-t border-blue-200 text-blue-700 text-xs">
          Last {foldingDebug.lastOperation}: {foldingDebug.path} at {new Date(foldingDebug.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};
