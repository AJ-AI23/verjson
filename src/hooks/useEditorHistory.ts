import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { getDocumentVersionInfo, compareVersionInfo, DocumentVersionInfo } from '@/lib/documentVersionUtils';

interface HistoryEntry {
  content: string;
  timestamp: number;
  documentId?: string;
}

interface CachedHistoryData {
  history: HistoryEntry[];
  currentIndex: number;
  lastUpdated: number;
  versionInfo?: DocumentVersionInfo;
}

interface UseEditorHistoryProps {
  documentId?: string;
  onContentChange?: (content: string) => void;
  maxHistorySize?: number;
  debounceMs?: number;
  initialContent?: string;
  baseContent?: any;
  onVersionMismatch?: (hasConflict: boolean) => void;
}

export const useEditorHistory = ({
  documentId,
  onContentChange,
  maxHistorySize = 50,
  debounceMs = 1000,
  initialContent,
  baseContent,
  onVersionMismatch
}: UseEditorHistoryProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const currentVersionInfoRef = useRef<DocumentVersionInfo | null>(null);
  
  // Generate storage key for the current document
  const getStorageKey = useCallback((docId?: string) => {
    return `editor-history-${docId || 'default'}`;
  }, []);

  // Load history from localStorage and check version conflicts
  useEffect(() => {
    const initializeHistory = async () => {
      const storageKey = getStorageKey(documentId);
      const savedHistory = localStorage.getItem(storageKey);
      
      // Get current document version info if we have the necessary data
      let currentVersionInfo: DocumentVersionInfo | null = null;
      if (documentId && baseContent) {
        try {
          currentVersionInfo = await getDocumentVersionInfo(documentId, baseContent);
          currentVersionInfoRef.current = currentVersionInfo;
        } catch (error) {
          console.error('Error getting document version info:', error);
        }
      }
      
      if (savedHistory) {
        try {
          const parsed: CachedHistoryData = JSON.parse(savedHistory);
          const cachedVersionInfo = parsed.versionInfo;
          
          // Check for version mismatch
          const hasVersionMismatch = currentVersionInfo && cachedVersionInfo ? 
            compareVersionInfo(cachedVersionInfo, currentVersionInfo) : false;
          
          if (hasVersionMismatch && onVersionMismatch) {
            onVersionMismatch(true);
          }
          
          // Load cached history regardless of version mismatch (user can choose what to do)
          setHistory(parsed.history || []);
          setCurrentIndex(parsed.currentIndex ?? -1);
          
        } catch (error) {
          console.error('Failed to load editor history:', error);
          initializeWithInitialContent();
        }
      } else {
        initializeWithInitialContent();
      }
      
      setIsInitialized(true);
    };
    
    const initializeWithInitialContent = () => {
      if (initialContent) {
        const initialEntry: HistoryEntry = {
          content: initialContent,
          timestamp: Date.now(),
          documentId
        };
        setHistory([initialEntry]);
        setCurrentIndex(0);
        lastSavedContentRef.current = initialContent;
      } else {
        setHistory([]);
        setCurrentIndex(-1);
      }
    };
    
    initializeHistory();
  }, [documentId, getStorageKey, initialContent, baseContent, onVersionMismatch]);

  // Save history to localStorage with version info
  const saveHistoryToStorage = useCallback((historyEntries: HistoryEntry[], index: number) => {
    const storageKey = getStorageKey(documentId);
    try {
      const cacheData: CachedHistoryData = {
        history: historyEntries,
        currentIndex: index,
        lastUpdated: Date.now(),
        versionInfo: currentVersionInfoRef.current || undefined
      };
      localStorage.setItem(storageKey, JSON.stringify(cacheData));
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

  // Save to localStorage when history changes (only after initialization)
  useEffect(() => {
    if (isInitialized && history.length > 0) {
      saveHistoryToStorage(history, currentIndex);
    }
  }, [history, currentIndex, saveHistoryToStorage, isInitialized]);

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

  // Clear history and start fresh with current content
  const startFresh = useCallback(async () => {
    if (documentId && baseContent) {
      try {
        // Get fresh version info
        const freshVersionInfo = await getDocumentVersionInfo(documentId, baseContent);
        currentVersionInfoRef.current = freshVersionInfo;
        
        // Clear localStorage
        const storageKey = getStorageKey(documentId);
        localStorage.removeItem(storageKey);
        
        // Reset history
        if (initialContent) {
          const initialEntry: HistoryEntry = {
            content: initialContent,
            timestamp: Date.now(),
            documentId
          };
          setHistory([initialEntry]);
          setCurrentIndex(0);
          lastSavedContentRef.current = initialContent;
        } else {
          setHistory([]);
          setCurrentIndex(-1);
        }
        
        toast.success('Started fresh with latest document version');
      } catch (error) {
        console.error('Error starting fresh:', error);
        toast.error('Failed to refresh document state');
      }
    }
  }, [documentId, baseContent, initialContent, getStorageKey]);

  return {
    addToHistory,
    undo,
    redo,
    clearHistory,
    startFresh,
    canUndo,
    canRedo,
    historySize,
    currentIndex: currentIndex + 1, // Display as 1-based
    totalEntries: historySize,
    isInitialized
  };
};