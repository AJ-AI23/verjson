
import { useState, useRef } from 'react';
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
  maxDepth = 3 // Add maxDepth parameter with default value
}: UseJsonEditorProps): JsonEditorResult => {
  // Keep track of whether we're programmatically changing the editor
  // to avoid infinite loops when syncing state
  const isInternalChange = useRef<boolean>(false);
  
  // Previous value for comparison
  const previousValueRef = useRef<string>(value);
  
  // Debug state to track folding operations
  const [foldingDebug, setFoldingDebug] = useState<FoldingDebugInfo | null>(null);

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
  const { expandAll, collapseAll, expandFirstLevel, collapsedPathsRef: foldingRef } = useJsonEditorFolding({ 
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
    maxDepth // Pass the maxDepth parameter
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
    pathExceedsMaxDepth // Return the utility function for consumers to use
  };
};
