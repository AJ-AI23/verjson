
import React, { useRef, useEffect, useCallback } from 'react';
import 'jsoneditor/dist/jsoneditor.css';
import { CollapsedState } from '@/lib/diagram/types';
import { useJsonEditor } from '@/hooks/useJsonEditor';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import { EditorHistoryControls } from '@/components/editor/EditorHistoryControls';

interface JsonEditorPocProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth: number;
  documentId?: string;
}

export const JsonEditorPoc: React.FC<JsonEditorPocProps> = ({
  value,
  onChange,
  error,
  collapsedPaths = {},
  onToggleCollapse,
  maxDepth,
  documentId
}) => {
  // Create a ref to the editor container DOM element
  const containerRef = useRef<HTMLDivElement>(null);
  
  
  // Track if the component has been mounted
  const isMountedRef = useRef<boolean>(false);
  
  // Initialize editor history
  const {
    addToHistory,
    undo,
    redo,
    clearHistory,
    canUndo,
    canRedo,
    currentIndex,
    totalEntries
  } = useEditorHistory({
    documentId,
    onContentChange: onChange,
    maxHistorySize: 50,
    debounceMs: 1000
  });
  
  // Wrap onChange to add to history
  const handleChange = useCallback((newValue: string) => {
    onChange(newValue);
    addToHistory(newValue);
  }, [onChange, addToHistory]);
  
  // Wrap onToggleCollapse to prevent initial setup events but allow bulk operations
  const handleToggleCollapse = useCallback((path: string, isCollapsed: boolean) => {
    console.log(`JsonEditorPoc: handleToggleCollapse called with path=${path}, isCollapsed=${isCollapsed}, isMounted=${isMountedRef.current}`);
    
    // Always allow the callback for better bulk operation support
    if (onToggleCollapse) {
      onToggleCollapse(path, isCollapsed);
    }
  }, [onToggleCollapse]);
  
  // Use the custom hook for editor functionality
  const {
    initializeEditor,
    destroyEditor,
    expandAll,
    collapseAll,
    pathExceedsMaxDepth
  } = useJsonEditor({
    value,
    onChange: handleChange,
    collapsedPaths,
    onToggleCollapse: handleToggleCollapse,
    maxDepth
  });

  // Initialize the editor once the component mounts
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initialize the editor
    initializeEditor(containerRef.current);
    
    // Mark as mounted after a small delay to let initial setup complete
    setTimeout(() => {
      isMountedRef.current = true;
    }, 500);
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      destroyEditor();
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-slate-50 flex justify-between items-center">
        <h2 className="font-semibold text-slate-700">JSON Editor</h2>
        <div className="flex items-center gap-3">
          <EditorHistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onClearHistory={clearHistory}
            currentIndex={currentIndex}
            totalEntries={totalEntries}
          />
          <div className="w-px h-4 bg-slate-300" />
          <div className="flex gap-2">
            <button
              onClick={() => {
                console.log('Expand All button clicked!');
                expandAll();
              }}
              className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={() => {
                console.log('Collapse All button clicked!');
                collapseAll();
              }}
              className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors"
            >
              Collapse All
            </button>
          </div>
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
      
    </div>
  );
};
