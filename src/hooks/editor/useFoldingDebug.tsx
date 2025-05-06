
import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { analyzeFoldedRegions } from '@/lib/editor';

/**
 * Hook for debugging folding functionality in Monaco editor
 */
export const useFoldingDebug = () => {
  const [isDebugMode, setIsDebugMode] = useState(false);

  // Inspect folded regions in the editor for debugging
  const inspectFoldedRegions = useCallback((editor: any, pathMapRef: React.MutableRefObject<{[lineNumber: number]: string}>) => {
    const model = editor.getModel();
    if (!model) return;
    
    console.log("===== FOLDING DEBUG INFORMATION =====");
    console.log("Model info:", { 
      lineCount: model.getLineCount(),
      uri: model.uri.toString(),
      languageId: model.getLanguageId()
    });
    
    // Get all folding information using our utility function
    const foldingInfo = analyzeFoldedRegions(editor);
    console.log("Folding analysis:", foldingInfo);
    
    console.log("===== END FOLDING DEBUG INFO =====");
    
    return {
      pathMap: pathMapRef.current,
      foldingRanges: foldingInfo.foldedRanges,
      foldedDecorations: foldingInfo.decorations.foldedCount
    };
  }, []);

  // Create a debug button component for the toolbar
  const DebugFoldingButton = useCallback(({ onClick }: { onClick: () => void }) => {
    return (
      <button 
        className="px-2 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded text-xs"
        onClick={onClick}
      >
        Debug Folding
      </button>
    );
  }, []);

  return {
    isDebugMode,
    setIsDebugMode,
    inspectFoldedRegions,
    DebugFoldingButton
  };
};
