import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

interface HistoryEntry {
  content: string;
  timestamp: number;
  documentId?: string;
}

interface HistoryState {
  entries: HistoryEntry[];
  currentIndex: number;
}

interface UseEditorHistoryProps {
  documentId?: string;
  onContentChange?: (content: string) => void;
  maxHistorySize?: number;
  debounceMs?: number;
}

export const useEditorHistory = ({
  documentId,
  onContentChange,
  maxHistorySize = 50,
  debounceMs = 1000
}: UseEditorHistoryProps) => {
  const [historyState, setHistoryState] = useState<HistoryState>({
    entries: [],
    currentIndex: -1
  });
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');
  
  // Extract values for convenience
  const { entries: history, currentIndex } = historyState;
  
  // Generate storage key for the current document
  const getStorageKey = useCallback((docId?: string) => {
    return `editor-history-${docId || 'default'}`;
  }, []);

  // Load history from localStorage on mount or document change
  useEffect(() => {
    const storageKey = getStorageKey(documentId);
    const savedHistory = localStorage.getItem(storageKey);
    
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistoryState({
          entries: parsed.history || [],
          currentIndex: parsed.currentIndex ?? -1
        });
        console.log(`Loaded editor history for document ${documentId}:`, parsed.history.length, 'entries');
      } catch (error) {
        console.error('Failed to load editor history:', error);
        setHistoryState({
          entries: [],
          currentIndex: -1
        });
      }
    } else {
      setHistoryState({
        entries: [],
        currentIndex: -1
      });
    }
  }, [documentId, getStorageKey]);

  // Save history to localStorage
  const saveHistoryToStorage = useCallback((historyEntries: HistoryEntry[], index: number) => {
    const storageKey = getStorageKey(documentId);
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        history: historyEntries,
        currentIndex: index,
        lastUpdated: Date.now()
      }));
    } catch (error) {
      console.error('Failed to save editor history:', error);
    }
  }, [documentId, getStorageKey]);

  // Add content to history (with debouncing)
  const addToHistory = useCallback((content: string) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Don't add if content hasn't changed
    if (content === lastSavedContentRef.current) {
      return;
    }

    // Debounce the history addition
    debounceTimeoutRef.current = setTimeout(() => {
      setHistoryState(prevState => {
        // Remove any entries after current index (when undoing then making new changes)
        const newHistory = prevState.entries.slice(0, prevState.currentIndex + 1);
        
        // Don't add duplicate entries
        const lastEntry = newHistory[newHistory.length - 1];
        if (lastEntry && lastEntry.content === content) {
          return prevState;
        }

        // Add new entry
        const newEntry: HistoryEntry = {
          content,
          timestamp: Date.now(),
          documentId
        };
        
        newHistory.push(newEntry);
        
        // Limit history size
        let newIndex = newHistory.length - 1;
        if (newHistory.length > maxHistorySize) {
          newHistory.shift(); // Remove oldest entry
          newIndex = newHistory.length - 1;
        }
        
        return {
          entries: newHistory,
          currentIndex: newIndex
        };
      });
      
      lastSavedContentRef.current = content;
    }, debounceMs);
  }, [currentIndex, debounceMs, documentId, maxHistorySize]);

  // Save to localStorage when history changes
  useEffect(() => {
    if (history.length > 0) {
      saveHistoryToStorage(history, currentIndex);
    }
  }, [history, currentIndex, saveHistoryToStorage]);

  // Undo functionality
  const undo = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const entry = history[newIndex];
      
      setHistoryState(prev => ({
        ...prev,
        currentIndex: newIndex
      }));
      lastSavedContentRef.current = entry.content;
      
      if (onContentChange) {
        onContentChange(entry.content);
      }
      
      toast.success('Undone', {
        description: `Reverted to previous state`,
        duration: 1500
      });
      
      return entry.content;
    } else {
      toast.info('Nothing to undo');
      return null;
    }
  }, [currentIndex, history, onContentChange]);

  // Redo functionality
  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      const entry = history[newIndex];
      
      setHistoryState(prev => ({
        ...prev,
        currentIndex: newIndex
      }));
      lastSavedContentRef.current = entry.content;
      
      if (onContentChange) {
        onContentChange(entry.content);
      }
      
      toast.success('Redone', {
        description: `Restored to next state`,
        duration: 1500
      });
      
      return entry.content;
    } else {
      toast.info('Nothing to redo');
      return null;
    }
  }, [currentIndex, history, onContentChange]);

  // Clear history for current document
  const clearHistory = useCallback(() => {
    setHistoryState({
      entries: [],
      currentIndex: -1
    });
    const storageKey = getStorageKey(documentId);
    localStorage.removeItem(storageKey);
    toast.success('History cleared');
  }, [documentId, getStorageKey]);

  // Get current state info
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  const historySize = history.length;

  return {
    addToHistory,
    undo,
    redo,
    clearHistory,
    canUndo,
    canRedo,
    historySize,
    currentIndex: currentIndex + 1, // Display as 1-based
    totalEntries: historySize
  };
};