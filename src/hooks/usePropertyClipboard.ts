import { useState, useCallback } from 'react';

interface ClipboardItem {
  name: string;
  schema: any;
  isCut: boolean;
  sourcePath: string[];
}

interface UsePropertyClipboardResult {
  clipboard: ClipboardItem | null;
  copy: (name: string, schema: any, path: string[]) => void;
  cut: (name: string, schema: any, path: string[]) => void;
  paste: () => ClipboardItem | null;
  hasClipboard: boolean;
  clearClipboard: () => void;
}

export function usePropertyClipboard(): UsePropertyClipboardResult {
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);

  const copy = useCallback((name: string, schema: any, path: string[]) => {
    setClipboard({
      name,
      schema: JSON.parse(JSON.stringify(schema)), // Deep clone
      isCut: false,
      sourcePath: path,
    });
  }, []);

  const cut = useCallback((name: string, schema: any, path: string[]) => {
    setClipboard({
      name,
      schema: JSON.parse(JSON.stringify(schema)), // Deep clone
      isCut: true,
      sourcePath: path,
    });
  }, []);

  const paste = useCallback(() => {
    if (!clipboard) return null;
    
    // If it was a cut operation, clear the clipboard after paste
    const item = clipboard;
    if (item.isCut) {
      setClipboard(null);
    }
    
    return item;
  }, [clipboard]);

  const clearClipboard = useCallback(() => {
    setClipboard(null);
  }, []);

  return {
    clipboard,
    copy,
    cut,
    paste,
    hasClipboard: clipboard !== null,
    clearClipboard,
  };
}
