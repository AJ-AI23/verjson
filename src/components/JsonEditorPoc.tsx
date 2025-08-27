
import React, { useRef, useEffect, useCallback, useState } from 'react';
import 'jsoneditor/dist/jsoneditor.css';
import { CollapsedState } from '@/lib/diagram/types';
import { useJsonEditor } from '@/hooks/useJsonEditor';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import { EditorHistoryControls } from '@/components/editor/EditorHistoryControls';
import { VersionMismatchRibbon } from '@/components/editor/VersionMismatchRibbon';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';
import { getEffectiveDocumentContentForEditor } from '@/lib/documentUtils';

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
  
  // Track if we're currently restoring from history to avoid circular updates
  const isRestoringFromHistory = useRef<boolean>(false);
  
  // Editor settings and version mismatch state
  const { settings } = useEditorSettings();
  const [showVersionMismatch, setShowVersionMismatch] = useState(false);
  const [baseContentForVersion, setBaseContentForVersion] = useState<any>(null);
  
  // Get base content for version comparison
  useEffect(() => {
    const getBaseContent = async () => {
      if (documentId) {
        try {
          // Parse the current value to get base content structure
          const parsedValue = JSON.parse(value);
          setBaseContentForVersion(parsedValue);
        } catch (error) {
          console.error('Error parsing current value for version comparison:', error);
          setBaseContentForVersion(null);
        }
      }
    };
    
    getBaseContent();
  }, [documentId, value]);

  // Initialize editor history
  const {
    addToHistory,
    undo,
    redo,
    clearHistory,
    startFresh,
    canUndo,
    canRedo,
    currentIndex,
    totalEntries,
    isInitialized
  } = useEditorHistory({
    documentId,
    initialContent: value,
    baseContent: baseContentForVersion,
    onContentChange: (content) => {
      // When restoring from history, don't trigger addToHistory again
      isRestoringFromHistory.current = true;
      onChange(content);
      // Reset flag after a small delay to allow the editor to update
      setTimeout(() => {
        isRestoringFromHistory.current = false;
      }, 100);
    },
    onVersionMismatch: (hasConflict) => {
      if (hasConflict && settings.showVersionMismatchWarning) {
        setShowVersionMismatch(true);
      }
    },
    maxHistorySize: 50,
    debounceMs: 1000
  });
  
  // Wrap onChange to add to history
  const handleChange = useCallback((newValue: string) => {
    onChange(newValue);
    // Only add to history if we're not restoring from history and history is initialized
    if (!isRestoringFromHistory.current && isInitialized) {
      addToHistory(newValue);
    }
  }, [onChange, addToHistory, isInitialized]);
  
  // Wrap onToggleCollapse to prevent initial setup events but allow bulk operations
  const handleToggleCollapse = useCallback((path: string, isCollapsed: boolean) => {
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

  // Handle version mismatch ribbon actions
  const handleDismissVersionMismatch = useCallback(() => {
    setShowVersionMismatch(false);
  }, []);

  const handleStartFresh = useCallback(async () => {
    setShowVersionMismatch(false);
    await startFresh();
  }, [startFresh]);

  const handleKeepEdits = useCallback(() => {
    setShowVersionMismatch(false);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <VersionMismatchRibbon
        isVisible={showVersionMismatch}
        onDismiss={handleDismissVersionMismatch}
        onStartFresh={handleStartFresh}
        onKeepEdits={handleKeepEdits}
        documentId={documentId}
      />
      <div className="p-2 border-b bg-muted/30 flex justify-between items-center">
        <h2 className="font-semibold text-foreground">JSON Editor</h2>
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
          <div className="w-px h-4 bg-border" />
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs px-2 py-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-2 py-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors"
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
        <div className="p-2 bg-destructive/10 border-t border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}
      
    </div>
  );
};
