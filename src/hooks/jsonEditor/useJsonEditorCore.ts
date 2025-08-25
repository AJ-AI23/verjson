
import { useState, useRef, useEffect, useMemo } from 'react';
import { UseJsonEditorProps, FoldingDebugInfo, JsonEditorResult } from './types';
import { useJsonEditorSync } from './useJsonEditorSync';
import { useJsonEditorFolding } from './useJsonEditorFolding';
import { useJsonEditorEvents } from './useJsonEditorEvents';
import { useJsonEditorInitialization } from './useJsonEditorInitialization';
import { useJsonEditorSetup } from './useJsonEditorSetup';
import { useJsonEditorCollapse } from './useJsonEditorCollapse';

export const useJsonEditor = ({
  value,
  onChange,
  collapsedPaths = {},
  onToggleCollapse,
  maxDepth
}: UseJsonEditorProps): JsonEditorResult => {
  // Parse the schema from the value for bulk expand operations
  const parsedSchema = useMemo(() => {
    try {
      return JSON.parse(value);
    } catch (e) {
      return null;
    }
  }, [value]);
  
  // Keep track of whether we're programmatically changing the editor
  // to avoid infinite loops when syncing state
  const isInternalChange = useRef<boolean>(false);
  
  // Previous value for comparison
  const previousValueRef = useRef<string>(value);
  
  // Debug state to track folding operations
  const [foldingDebug, setFoldingDebug] = useState<FoldingDebugInfo | null>(null);

  // Create a master ref for the collapsed paths
  const masterCollapsedPathsRef = useRef<Record<string, boolean>>(collapsedPaths);
  
  // Create a ref for the editor
  const editorRef = useRef<any>(null);
  
  // Update master ref whenever collapsedPaths props changes
  useEffect(() => {
    masterCollapsedPathsRef.current = { ...collapsedPaths };
  }, [collapsedPaths]);

  const {
    createEditorEventHandlers,
    collapsedPathsRef
  } = useJsonEditorEvents({
    onToggleCollapse,
    collapsedPaths,
    maxDepth,
    rootSchema: parsedSchema,
    editorRef
  });

  // Use our initialization hook
  const { initializeEditor, destroyEditor } = useJsonEditorInitialization({
    value,
    createEditorEventHandlers,
    editorRef
  });

  // Use our folding hook
  const { 
    expandAll, 
    collapseAll, 
    expandFirstLevel, 
    forceUpdateEditorFoldState,
    collapsedPathsRef: foldingRef 
  } = useJsonEditorFolding({ 
    editorRef, 
    onToggleCollapse,
    collapsedPaths
  });

  // Use our setup hook
  const { initialSetupDone, collapsedPathsRef: setupRef, pathExceedsMaxDepth } = useJsonEditorSetup({
    editorRef,
    onToggleCollapse,
    collapsedPaths,
    expandFirstLevel,
    maxDepth
  });

  // Use our collapsedPaths update hook
  useJsonEditorCollapse({
    editorRef,
    initialSetupDone,
    collapsedPaths,
    masterCollapsedPathsRef
  });

  // Use our sync hook
  const { syncEditorWithProps } = useJsonEditorSync({ 
    editorRef, isInternalChange, previousValueRef, value, onChange 
  });

  // Force update of editor fold state when collapsedPaths changes
  useEffect(() => {
    if (editorRef.current && initialSetupDone.current) {
      forceUpdateEditorFoldState();
    }
  }, [collapsedPaths, forceUpdateEditorFoldState]);

  // Sync editor with props
  syncEditorWithProps();

  // Bind editor -> props changes
  useEffect(() => {
    const editor = editorRef.current as any;
    if (!editor) return;

    const handleChange = () => {
      try {
        if (isInternalChange.current) return;
        // Prefer text to preserve formatting; fall back to JSON stringify
        let nextValue: string;
        try {
          nextValue = editor.getText();
        } catch {
          const json = editor.get();
          nextValue = JSON.stringify(json, null, 2);
        }
        // Avoid redundant updates
        if (nextValue !== previousValueRef.current) {
          previousValueRef.current = nextValue;
          onChange(nextValue);
        }
      } catch (err) {
        // Silently handle errors
      }
    };

    // Attach listener
    try {
      if (typeof editor.on === 'function') {
        editor.on('change', handleChange);
      } else {
        // Fallback: poll very lightly if events API not present
        const interval = setInterval(handleChange, 500);
        return () => clearInterval(interval);
      }
    } catch (e) {
      // Fallback: poll very lightly if events API not present
      const interval = setInterval(handleChange, 500);
      return () => clearInterval(interval);
    }

    // Cleanup
    return () => {
      try {
        if (typeof editor.off === 'function') {
          editor.off('change', handleChange);
        }
      } catch {}
    };
  }, [editorRef.current, onChange]);

  return {
    editorRef,
    initializeEditor,
    destroyEditor,
    expandAll,
    collapseAll,
    expandFirstLevel,
    foldingDebug,
    collapsedPaths: masterCollapsedPathsRef.current,
    pathExceedsMaxDepth
  };
};
