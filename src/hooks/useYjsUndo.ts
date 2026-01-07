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
  const isUndoRedoOperation = useRef(false);

  const updateState = useCallback(() => {
    if (undoManagerRef.current) {
      const undoStackLength = undoManagerRef.current.undoStack.length;
      const redoStackLength = undoManagerRef.current.redoStack.length;
      
      setCanUndo(undoStackLength > 0);
      setCanRedo(redoStackLength > 0);
      setHistorySize(undoStackLength + redoStackLength);
      
      // Current index is the position in the history where we are
      // If we have undo stack of 3 and redo stack of 2, we're at position 3 out of 5 total
      setCurrentIndex(undoStackLength);
    } else {
      setCanUndo(false);
      setCanRedo(false);
      setHistorySize(0);
      setCurrentIndex(0);
    }
  }, []);

  const undo = useCallback(() => {
    if (undoManagerRef.current && undoManagerRef.current.undoStack.length > 0) {
      isUndoRedoOperation.current = true;
      undoManagerRef.current.undo();
      updateState();
      // Reset flag after operation completes
      setTimeout(() => {
        isUndoRedoOperation.current = false;
      }, 0);
    }
  }, [updateState]);

  const redo = useCallback(() => {
    if (undoManagerRef.current && undoManagerRef.current.redoStack.length > 0) {
      isUndoRedoOperation.current = true;
      undoManagerRef.current.redo();
      updateState();
      // Reset flag after operation completes
      setTimeout(() => {
        isUndoRedoOperation.current = false;
      }, 0);
    }
  }, [updateState]);

  const clearHistory = useCallback(() => {
    if (undoManagerRef.current) {
      undoManagerRef.current.clear();
      updateState();
    }
  }, [updateState]);

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

    // Listen to undo manager changes (avoid duplicate listeners by always cleaning up)
    const handleStackItemAdded = () => updateState();
    const handleStackItemPopped = () => updateState();

    undoManager.on('stack-item-added', handleStackItemAdded);
    undoManager.on('stack-item-popped', handleStackItemPopped);

    undoManagerRef.current = undoManager;
    updateState();

    return () => {
      undoManager.off('stack-item-added', handleStackItemAdded);
      undoManager.off('stack-item-popped', handleStackItemPopped);

      // IMPORTANT: do not destroy the UndoManager here.
      // We keep it alive so local history persists across document close/reopen
      // within the same browser session.
      undoManagerRef.current = null;
    };
  }, [yjsDoc, textKey, updateState]);


  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
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
    isUndoRedoOperation: () => isUndoRedoOperation.current
  };
};