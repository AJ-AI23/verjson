import { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';

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
  isUndoRedoOperation: () => boolean;
}

export const useYjsUndo = ({
  yjsDoc,
  textKey = 'content'
}: UseYjsUndoProps): UseYjsUndoResult => {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historySize, setHistorySize] = useState(0);
  
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const isUndoRedoOperation = useRef(false);

  const updateState = useCallback(() => {
    if (undoManagerRef.current) {
      setCanUndo(undoManagerRef.current.undoStack.length > 0);
      setCanRedo(undoManagerRef.current.redoStack.length > 0);
      setHistorySize(
        undoManagerRef.current.undoStack.length + 
        undoManagerRef.current.redoStack.length
      );
    } else {
      setCanUndo(false);
      setCanRedo(false);
      setHistorySize(0);
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

  // Initialize undo manager when yjsDoc changes
  useEffect(() => {
    if (!yjsDoc) {
      undoManagerRef.current = null;
      updateState();
      return;
    }

    const text = yjsDoc.getText(textKey);
    const undoManager = new Y.UndoManager([text], {
      captureTimeout: 500, // Group operations within 500ms
      deleteFilter: () => true // Allow deletion undo
    });

    // Listen to undo manager changes
    const handleStackItemAdded = () => updateState();
    const handleStackItemPopped = () => updateState();

    undoManager.on('stack-item-added', handleStackItemAdded);
    undoManager.on('stack-item-popped', handleStackItemPopped);

    undoManagerRef.current = undoManager;
    updateState();

    return () => {
      undoManager.off('stack-item-added', handleStackItemAdded);
      undoManager.off('stack-item-popped', handleStackItemPopped);
      undoManager.destroy();
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
    historySize,
    isUndoRedoOperation: () => isUndoRedoOperation.current
  };
};