import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

interface HistoryEntry {
  content: string;
  timestamp: number;
  documentId?: string;
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');
  
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
        setHistory(parsed.history || []);
        setCurrentIndex(parsed.currentIndex ?? -1);
        
      } catch (error) {
        console.error('Failed to load editor history:', error);
        setHistory([]);
        setCurrentIndex(-1);
      }
    } else {
      setHistory([]);
      setCurrentIndex(-1);
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
      setHistory(prev => {
        // Remove any entries after current index (when undoing then making new changes)
        const newHistory = prev.slice(0, currentIndex + 1);
        
        // Don't add duplicate entries
        const lastEntry = newHistory[newHistory.length - 1];
        if (lastEntry && lastEntry.content === content) {
          return prev;
        }

        // Add new entry
        const newEntry: HistoryEntry = {
          content,
          timestamp: Date.now(),
          documentId
        };
        
        newHistory.push(newEntry);
        
        // Limit history size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift(); // Remove oldest entry
          // Adjust currentIndex if we removed an entry
          setCurrentIndex(prev => Math.max(0, prev - 1));
        } else {
          // Set current index to the last entry
          setCurrentIndex(newHistory.length - 1);
        }
        
        return newHistory;
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
      
      setCurrentIndex(newIndex);
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
      
      setCurrentIndex(newIndex);
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
    setHistory([]);
    setCurrentIndex(-1);
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