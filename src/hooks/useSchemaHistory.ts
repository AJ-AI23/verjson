import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSchemaHistoryOptions {
  maxHistorySize?: number;
}

interface UseSchemaHistoryResult<T> {
  currentSchema: T;
  setSchema: (schema: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useSchemaHistory<T>(
  initialSchema: T,
  onSchemaChange: (schema: T) => void,
  options: UseSchemaHistoryOptions = {}
): UseSchemaHistoryResult<T> {
  const { maxHistorySize = 50 } = options;
  
  const [history, setHistory] = useState<T[]>([initialSchema]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isInternalChange = useRef(false);
  
  // Sync with external schema changes
  useEffect(() => {
    if (!isInternalChange.current) {
      // External change, reset history with new schema
      setHistory([initialSchema]);
      setCurrentIndex(0);
    }
    isInternalChange.current = false;
  }, [initialSchema]);

  const setSchema = useCallback((newSchema: T) => {
    isInternalChange.current = true;
    
    setHistory(prev => {
      // Remove any redo history when making a new change
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(newSchema);
      
      // Limit history size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        return newHistory;
      }
      
      return newHistory;
    });
    
    setCurrentIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
    onSchemaChange(newSchema);
  }, [currentIndex, maxHistorySize, onSchemaChange]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      isInternalChange.current = true;
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      onSchemaChange(history[newIndex]);
    }
  }, [currentIndex, history, onSchemaChange]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      isInternalChange.current = true;
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      onSchemaChange(history[newIndex]);
    }
  }, [currentIndex, history, onSchemaChange]);

  return {
    currentSchema: history[currentIndex],
    setSchema,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
  };
}
