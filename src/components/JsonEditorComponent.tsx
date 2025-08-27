import React, { useRef, useEffect, useMemo } from 'react';
import { CollapsedState } from '@/lib/diagram/types';
import { useJsonEditor } from '@/hooks/jsonEditor';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import { EditorHistoryControls } from './editor/EditorHistoryControls';

interface JsonEditorComponentProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth: number;
  documentId?: string;
}

export const JsonEditorComponent: React.FC<JsonEditorComponentProps> = ({
  value,
  onChange,
  error,
  collapsedPaths,
  onToggleCollapse,
  maxDepth,
  documentId
}) => {
  // Create a ref to the editor container DOM element
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Keep track of whether the component has been mounted and editor initialized
  const isMountedRef = useRef<boolean>(false);
  
  // Keep track of restoration state
  const isRestoringFromHistory = useRef<boolean>(false);
  
  // Setup editor history management
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
    maxHistorySize: 50,
    documentId
  });

  // Handle changes with history
  const handleChange = useMemo(() => (newValue: string) => {
    if (!isRestoringFromHistory.current && isMountedRef.current) {
      addToHistory(newValue);
    }
    onChange(newValue);
  }, [onChange, addToHistory]);

  // Handle undo operations
  const handleUndo = () => {
    const prevValue = undo();
    if (prevValue !== null) {
      isRestoringFromHistory.current = true;
      onChange(prevValue);
      setTimeout(() => {
        isRestoringFromHistory.current = false;
      }, 100);
    }
  };

  // Handle redo operations
  const handleRedo = () => {
    const nextValue = redo();
    if (nextValue !== null) {
      isRestoringFromHistory.current = true;
      onChange(nextValue);
      setTimeout(() => {
        isRestoringFromHistory.current = false;
      }, 100);
    }
  };

  // Handle collapse/expand operations
  const handleToggleCollapse = useMemo(() => (path: string, isCollapsed: boolean) => {
    if (!isMountedRef.current) return;
    onToggleCollapse?.(path, isCollapsed);
  }, [onToggleCollapse]);

  // Initialize the JSON editor
  const {
    editorRef,
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
  }, [initializeEditor, destroyEditor]);

  return (
    <div className="h-full flex flex-col">
      {/* Header with title and controls */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card">
        <h2 className="text-sm font-medium text-foreground">JSON Schema Editor</h2>
        
        <div className="flex items-center gap-2">
          {/* History Controls */}
          <EditorHistoryControls
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClearHistory={clearHistory}
            canUndo={canUndo}
            canRedo={canRedo}
            currentIndex={currentIndex}
            totalEntries={totalEntries}
          />
          
          {/* Expand/Collapse Controls */}
          <div className="flex gap-1">
            <button 
              onClick={expandAll}
              className="px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded transition-colors"
            >
              Expand All
            </button>
            <button 
              onClick={collapseAll}
              className="px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>
      
      {/* Editor Container */}
      <div 
        ref={containerRef}
        className="flex-1 min-h-0 bg-background"
      />
      
      {/* Error Display */}
      {error && (
        <div className="p-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
};
