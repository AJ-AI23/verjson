import { useState, useCallback } from 'react';

export interface ClipboardItem {
  name: string;
  schema: any;
  isCut: boolean;
  sourcePath: string[];
  timestamp: number;
}

const MAX_HISTORY_SIZE = 50;

interface UsePropertyClipboardResult {
  clipboard: ClipboardItem | null;
  history: ClipboardItem[];
  copy: (name: string, schema: any, path: string[]) => void;
  cut: (name: string, schema: any, path: string[]) => void;
  paste: (selectedItem?: ClipboardItem) => ClipboardItem | null;
  selectFromHistory: (item: ClipboardItem) => void;
  hasClipboard: boolean;
  clearHistory: () => void;
  clearClipboard: () => void;
}

export function usePropertyClipboard(): UsePropertyClipboardResult {
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [history, setHistory] = useState<ClipboardItem[]>([]);

  const addToHistory = useCallback((item: ClipboardItem) => {
    setHistory(prev => {
      // Add to the beginning, keep only MAX_HISTORY_SIZE items
      const newHistory = [item, ...prev].slice(0, MAX_HISTORY_SIZE);
      return newHistory;
    });
  }, []);

  const removeFromHistory = useCallback((item: ClipboardItem) => {
    setHistory(prev => prev.filter(h => h.timestamp !== item.timestamp));
  }, []);

  const copy = useCallback((name: string, schema: any, path: string[]) => {
    const item: ClipboardItem = {
      name,
      schema: JSON.parse(JSON.stringify(schema)), // Deep clone
      isCut: false,
      sourcePath: path,
      timestamp: Date.now(),
    };
    setClipboard(item);
    addToHistory(item);
  }, [addToHistory]);

  const cut = useCallback((name: string, schema: any, path: string[]) => {
    const item: ClipboardItem = {
      name,
      schema: JSON.parse(JSON.stringify(schema)), // Deep clone
      isCut: true,
      sourcePath: path,
      timestamp: Date.now(),
    };
    setClipboard(item);
    addToHistory(item);
  }, [addToHistory]);

  const paste = useCallback((selectedItem?: ClipboardItem) => {
    const itemToPaste = selectedItem || clipboard;
    if (!itemToPaste) return null;
    
    // If it was a cut operation, remove from history and clear current clipboard
    if (itemToPaste.isCut) {
      removeFromHistory(itemToPaste);
      if (clipboard?.timestamp === itemToPaste.timestamp) {
        setClipboard(null);
      }
    }
    
    return itemToPaste;
  }, [clipboard, removeFromHistory]);

  const selectFromHistory = useCallback((item: ClipboardItem) => {
    setClipboard(item);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setClipboard(null);
  }, []);

  const clearClipboard = useCallback(() => {
    setClipboard(null);
  }, []);

  return {
    clipboard,
    history,
    copy,
    cut,
    paste,
    selectFromHistory,
    hasClipboard: clipboard !== null,
    clearHistory,
    clearClipboard,
  };
}
