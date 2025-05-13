
import { useState, useRef, useEffect } from 'react';
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
  maxDepth = 3
}: UseJsonEditorProps): JsonEditorResult => {
  // Keep track of whether we're programmatically changing the editor
  // to avoid infinite loops when syncing state
  const isInternalChange = useRef<boolean>(false);
  
  // Previous value for comparison
  const previousValueRef = useRef<string>(value);
  
  // Debug state to track folding operations
  const [foldingDebug, setFoldingDebug] = useState<FoldingDebugInfo | null>(null);

  console.log('useJsonEditor hook running with:');
  console.log('- collapsedPaths:', collapsedPaths);
  console.log('- maxDepth:', maxDepth);
  console.log('- onToggleCollapse handler present:', !!onToggleCollapse);

  // Use our event handlers hook
  const { createEditorEventHandlers, getPathState } = useJsonEditorEvents({
    onToggleCollapse,
    setFoldingDebug,
    collapsedPaths
  });

  // Use our initialization hook
  const { editorRef, initializeEditor, destroyEditor } = useJsonEditorInitialization({
    value,
    createEditorEventHandlers
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
  const { initialSetupDone, collapsedPathsRef, pathExceedsMaxDepth } = useJsonEditorSetup({
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
    collapsedPaths
  });

  // Use our sync hook
  const { syncEditorWithProps } = useJsonEditorSync({ 
    editorRef, isInternalChange, previousValueRef, value, onChange 
  });

  // Force update of editor fold state when collapsedPaths changes
  useEffect(() => {
    if (editorRef.current && initialSetupDone.current) {
      console.log('Forcing update of editor fold state due to collapsedPaths change');
      forceUpdateEditorFoldState();
    }
  }, [collapsedPaths, forceUpdateEditorFoldState]);

  // Sync editor with props
  syncEditorWithProps();

  return {
    editorRef,
    initializeEditor,
    destroyEditor,
    expandAll,
    collapseAll,
    expandFirstLevel,
    foldingDebug,
    collapsedPaths: collapsedPathsRef.current,
    pathExceedsMaxDepth
  };
};
