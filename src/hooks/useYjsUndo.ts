// @refresh reset
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';


const undoManagerCache = new WeakMap<Y.Doc, Map<string, Y.UndoManager>>();

interface UseYjsUndoProps {
  yjsDoc: Y.Doc | null;
  textKey?: string;
}

interface UseYjsUndoResult {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  historySize: number;
  currentIndex: number;
  isUndoRedoOperation: () => boolean;
}

export const useYjsUndo = ({
  yjsDoc,
  textKey = 'content'
}: UseYjsUndoProps): UseYjsUndoResult => {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historySize, setHistorySize] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const isUndoRedoOperationRef = useRef(false);
  const undoRedoResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const scheduleUndoRedoReset = useCallback(() => {
    if (undoRedoResetTimerRef.current) {
      clearTimeout(undoRedoResetTimerRef.current);
    }

    // Keep the flag true long enough for React + JSONEditor sync to settle,
    // otherwise an undo can be re-recorded as a new edit.
    undoRedoResetTimerRef.current = setTimeout(() => {
      isUndoRedoOperationRef.current = false;
    }, 250);
  }, []);

  // Safe state updater that checks if component is still mounted
  const updateState = useCallback(() => {
    if (!isMountedRef.current) return;

    const um = undoManagerRef.current;
    if (um) {
      const undoLen = um.undoStack.length;
      const redoLen = um.redoStack.length;
      
      setCanUndo(undoLen > 0);
      setCanRedo(redoLen > 0);
      setHistorySize(undoLen + redoLen);
      setCurrentIndex(undoLen);
    } else {
      setCanUndo(false);
      setCanRedo(false);
      setHistorySize(0);
      setCurrentIndex(0);
    }
  }, []);

  const undo = useCallback(() => {
    const um = undoManagerRef.current;
    if (um && um.undoStack.length > 0) {
      isUndoRedoOperationRef.current = true;
      um.undo();
      updateState();
      scheduleUndoRedoReset();
    }
  }, [scheduleUndoRedoReset, updateState]);

  const redo = useCallback(() => {
    const um = undoManagerRef.current;
    if (um && um.redoStack.length > 0) {
      isUndoRedoOperationRef.current = true;
      um.redo();
      updateState();
      scheduleUndoRedoReset();
    }
  }, [scheduleUndoRedoReset, updateState]);

  const clearHistory = useCallback(() => {
    if (undoManagerRef.current) {
      undoManagerRef.current.clear();
      updateState();
    }
  }, [updateState]);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize (or reuse) undo manager when yjsDoc changes
  useEffect(() => {
    if (!yjsDoc) {
      undoManagerRef.current = null;
      updateState();
      return;
    }

    const text = yjsDoc.getText(textKey);

    const docCache = undoManagerCache.get(yjsDoc) ?? new Map<string, Y.UndoManager>();
    if (!undoManagerCache.has(yjsDoc)) {
      undoManagerCache.set(yjsDoc, docCache);
    }

    let undoManager = docCache.get(textKey);
    if (!undoManager) {
      undoManager = new Y.UndoManager([text], {
        captureTimeout: 500,
        deleteFilter: () => true
      });
      docCache.set(textKey, undoManager);
    }

    // Wrap handlers to safely update state from external callbacks
    const handleStackChange = () => {
      // Use requestAnimationFrame to batch with React's render cycle
      requestAnimationFrame(() => {
        if (isMountedRef.current) {
          updateState();
        }
      });
    };

    undoManager.on('stack-item-added', handleStackChange);
    undoManager.on('stack-item-popped', handleStackChange);

    undoManagerRef.current = undoManager;
    updateState();

    return () => {
      undoManager.off('stack-item-added', handleStackChange);
      undoManager.off('stack-item-popped', handleStackChange);
      undoManagerRef.current = null;
    };
  }, [yjsDoc, textKey, updateState]);

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault();
        redo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    clearHistory,
    currentIndex,
    historySize,
    isUndoRedoOperation: () => isUndoRedoOperationRef.current
  };
};
