import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { getDocumentVersionInfo, compareVersionInfo, DocumentVersionInfo } from '@/lib/documentVersionUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface HistoryEntry {
  id?: string;
  content: string;
  timestamp: number;
  documentId?: string;
  sequenceNumber?: number;
  synced?: boolean;
}

interface CachedHistoryData {
  history: HistoryEntry[];
  currentIndex: number;
  lastUpdated: number;
  versionInfo?: DocumentVersionInfo;
  lastServerSync?: number;
  maxSequenceNumber?: number;
}

interface UseEditorHistoryProps {
  documentId?: string;
  onContentChange?: (content: string) => void;
  maxHistorySize?: number;
  debounceMs?: number;
  initialContent?: string;
  baseContent?: any;
  onVersionMismatch?: (hasConflict: boolean) => void;
  enableServerSync?: boolean;
  syncIntervalMs?: number;
}

export const useEditorHistory = ({
  documentId,
  onContentChange,
  maxHistorySize = 50,
  debounceMs = 1000,
  initialContent,
  baseContent,
  onVersionMismatch,
  enableServerSync = true,
  syncIntervalMs = 30000 // 30 seconds
}: UseEditorHistoryProps) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const currentVersionInfoRef = useRef<DocumentVersionInfo | null>(null);
  const maxSequenceNumberRef = useRef<number>(0);
  const pendingSyncRef = useRef<HistoryEntry[]>([]);
  
  // Generate storage key for the current document
  const getStorageKey = useCallback((docId?: string) => {
    return `editor-history-${docId || 'default'}`;
  }, []);

  // Generate content hash client-side
  const generateContentHash = useCallback(async (content: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }, []);

  // Fetch history from server
  const fetchServerHistory = useCallback(async (): Promise<HistoryEntry[]> => {
    if (!user || !documentId || !enableServerSync) return [];
    
    try {
      const { data, error } = await supabase
        .from('editor_history')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .order('sequence_number', { ascending: true })
        .limit(maxHistorySize);

      if (error) throw error;

      return data.map(entry => ({
        id: entry.id,
        content: entry.content,
        timestamp: new Date(entry.created_at).getTime(),
        documentId: entry.document_id,
        sequenceNumber: entry.sequence_number,
        synced: true
      }));
    } catch (error) {
      console.error('Failed to fetch server history:', error);
      return [];
    }
  }, [user, documentId, enableServerSync, maxHistorySize]);

  // Merge server and local histories intelligently
  const mergeHistories = useCallback((serverHistory: HistoryEntry[], localHistory: HistoryEntry[]): HistoryEntry[] => {
    const merged = new Map<string, HistoryEntry>();
    
    // Add server history first (these are authoritative)
    serverHistory.forEach(entry => {
      const key = `${entry.content}-${entry.timestamp}`;
      merged.set(key, entry);
    });
    
    // Add local history that's not already in server
    localHistory.forEach(entry => {
      const key = `${entry.content}-${entry.timestamp}`;
      if (!merged.has(key)) {
        merged.set(key, { ...entry, synced: false });
      }
    });
    
    // Sort merged history by timestamp
    return Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, []);

  // Sync entries to server
  const syncToServer = useCallback(async (entries: HistoryEntry[]) => {
    if (!user || !documentId || !enableServerSync || entries.length === 0) return;

    try {
      setIsSyncing(true);
      
      for (const entry of entries) {
        if (entry.synced) continue; // Skip already synced entries
        
        const sequenceNumber = ++maxSequenceNumberRef.current;
        
        const { data, error } = await supabase
          .from('editor_history')
          .insert({
            document_id: documentId,
            user_id: user.id,
            content: entry.content,
            content_hash: await generateContentHash(entry.content),
            sequence_number: sequenceNumber
          })
          .select()
          .single();

        if (error) throw error;

        // Mark entry as synced
        entry.id = data.id;
        entry.sequenceNumber = sequenceNumber;
        entry.synced = true;
      }

      // Update local storage with synced entries
      setHistory(prevHistory => [...prevHistory]);
      
    } catch (error) {
      console.error('Failed to sync to server:', error);
      toast.error('Failed to sync history to server');
    } finally {
      setIsSyncing(false);
    }
  }, [user, documentId, enableServerSync, generateContentHash]);

  // Reset state when documentId changes
  useEffect(() => {
    // Clear any pending debounced operations when switching documents
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    // Reset initialization state to allow re-initialization with new document
    setIsInitialized(false);
    setHistory([]);
    setCurrentIndex(-1);
    lastSavedContentRef.current = '';
    currentVersionInfoRef.current = null;
  }, [documentId]);

  // Load history from localStorage and check version conflicts
  useEffect(() => {
    // Skip initialization if we don't have the necessary data yet
    if (documentId && !baseContent) {
      return;
    }

      const initializeHistory = async () => {
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

        // Try server sync first if enabled
        if (enableServerSync && user) {
          try {
            const serverHistory = await fetchServerHistory();
            
            // Update max sequence number
            if (serverHistory.length > 0) {
              const maxSeq = Math.max(...serverHistory.map(entry => entry.sequenceNumber || 0));
              maxSequenceNumberRef.current = maxSeq;
            }
            
            const storageKey = getStorageKey(documentId);
            const savedHistory = localStorage.getItem(storageKey);
            
            if (savedHistory) {
              try {
                const parsed: CachedHistoryData = JSON.parse(savedHistory);
                const localHistory = parsed.history || [];
                
                // Merge server and local histories
                const mergedHistory = mergeHistories(serverHistory, localHistory);
                setHistory(mergedHistory);
                
                // Find appropriate current index
                const currentContentIndex = mergedHistory.findIndex(entry => 
                  entry.content === lastSavedContentRef.current
                );
                setCurrentIndex(currentContentIndex >= 0 ? currentContentIndex : mergedHistory.length - 1);
                
                // Sync any unsynced local entries
                const unsyncedEntries = localHistory.filter(entry => !entry.synced);
                if (unsyncedEntries.length > 0) {
                  pendingSyncRef.current = unsyncedEntries;
                }
                
              } catch (error) {
                console.error('Failed to parse local history:', error);
                setHistory(serverHistory);
                setCurrentIndex(serverHistory.length - 1);
              }
            } else {
              setHistory(serverHistory);
              setCurrentIndex(serverHistory.length - 1);
            }
            
            setIsInitialized(true);
            return;
          } catch (error) {
            console.error('Failed to initialize with server sync:', error);
            // Fall back to local-only initialization
          }
        }
        
        // Fall back to local-only initialization
        const storageKey = getStorageKey(documentId);
        const savedHistory = localStorage.getItem(storageKey);
        
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

    // Only initialize once when we have all necessary data
    if (!isInitialized) {
      initializeHistory();
    }
  }, [documentId, getStorageKey, initialContent, baseContent, onVersionMismatch, isInitialized, enableServerSync, user, fetchServerHistory, mergeHistories]);

  // Save history to localStorage with version info
  const saveHistoryToStorage = useCallback((historyEntries: HistoryEntry[], index: number) => {
    const storageKey = getStorageKey(documentId);
    try {
      const cacheData: CachedHistoryData = {
        history: historyEntries,
        currentIndex: index,
        lastUpdated: Date.now(),
        versionInfo: currentVersionInfoRef.current || undefined,
        lastServerSync: Date.now(),
        maxSequenceNumber: maxSequenceNumberRef.current
      };
      localStorage.setItem(storageKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to save editor history:', error);
    }
  }, [documentId, getStorageKey]);



  // Periodic sync to server
  useEffect(() => {
    if (!enableServerSync || !user || !documentId) return;
    
    const setupPeriodicSync = () => {
      syncTimeoutRef.current = setTimeout(async () => {
        // Sync pending entries
        if (pendingSyncRef.current.length > 0) {
          await syncToServer([...pendingSyncRef.current]);
          pendingSyncRef.current = [];
        }
        
        // Sync any unsynced entries in current history
        const unsyncedEntries = history.filter(entry => !entry.synced);
        if (unsyncedEntries.length > 0) {
          await syncToServer(unsyncedEntries);
        }
        
        // Schedule next sync
        setupPeriodicSync();
      }, syncIntervalMs);
    };
    
    if (isInitialized) {
      setupPeriodicSync();
    }
    
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [enableServerSync, user, documentId, isInitialized, history, syncToServer, syncIntervalMs]);

  // Add content to history (with debouncing) - only after initialization
  const addToHistory = useCallback((content: string) => {
    // Don't add to history if not initialized yet
    if (!isInitialized) {
      return;
    }

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
          documentId,
          synced: false
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
      
      // Add to pending sync if server sync is enabled
      if (enableServerSync && user) {
        const newEntry: HistoryEntry = {
          content,
          timestamp: Date.now(),
          documentId,
          synced: false
        };
        pendingSyncRef.current.push(newEntry);
      }
    }, debounceMs);
  }, [currentIndex, debounceMs, documentId, maxHistorySize, isInitialized, enableServerSync, user]);

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
      
      // Validate that the entry belongs to the current document
      if (entry.documentId && entry.documentId !== documentId) {
        console.warn('Undo entry belongs to different document, skipping');
        toast.error('Cannot undo: history mismatch');
        return null;
      }
      
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
  }, [currentIndex, history, onContentChange, documentId]);

  // Redo functionality
  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      const entry = history[newIndex];
      
      // Validate that the entry belongs to the current document
      if (entry.documentId && entry.documentId !== documentId) {
        console.warn('Redo entry belongs to different document, skipping');
        toast.error('Cannot redo: history mismatch');
        return null;
      }
      
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
  }, [currentIndex, history, onContentChange, documentId]);

  // Clear history for current document
  const clearHistory = useCallback(() => {
    // Clear any pending debounced operations
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    setHistory([]);
    setCurrentIndex(-1);
    const storageKey = getStorageKey(documentId);
    localStorage.removeItem(storageKey);
    lastSavedContentRef.current = '';
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
    isInitialized,
    isSyncing,
    enableServerSync
  };
};