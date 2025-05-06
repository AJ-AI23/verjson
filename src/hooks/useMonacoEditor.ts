
import { useRef, useCallback, useState, useEffect } from 'react';
import { Monaco, OnMount } from '@monaco-editor/react';
import { toast } from 'sonner';
import { CollapsedState } from '@/lib/diagram/types';
import { 
  extractJsonPathFromLine, 
  analyzeFoldedRegions,
  generateLineToPathMap,
  getCurrentFoldingRanges,
  detectFoldingChanges,
  findPathForFoldingRange
} from '@/lib/editorUtils';

interface UseMonacoEditorProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths?: CollapsedState;
}

export const useMonacoEditor = ({ onToggleCollapse, collapsedPaths = {} }: UseMonacoEditorProps) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const prevCollapsedPathsRef = useRef<CollapsedState>(collapsedPaths);
  const previousFoldingRangesRef = useRef<Array<{startLineNumber: number, endLineNumber: number}>>([]);
  const pathMapRef = useRef<{[lineNumber: number]: string}>({});
  const [isDebugMode, setIsDebugMode] = useState(false);
  
  // Update path map whenever the editor content changes significantly
  const refreshPathMap = useCallback(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        console.log("Refreshing line-to-path mapping");
        pathMapRef.current = generateLineToPathMap(model);
      }
    }
  }, []);
  
  const handleFormatCode = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
      toast.success('Schema formatted');
      
      // After formatting, refresh the path map
      setTimeout(() => refreshPathMap(), 100);
    }
  }, [refreshPathMap]);
  
  const inspectFoldedRegions = useCallback((editor: any) => {
    const model = editor.getModel();
    if (!model) return;
    
    console.log("===== FOLDING DEBUG INFORMATION =====");
    console.log("Model info:", { 
      lineCount: model.getLineCount(),
      uri: model.uri.toString(),
      languageId: model.getLanguageId()
    });
    
    // Refresh path map
    pathMapRef.current = generateLineToPathMap(model);
    console.log("Line to Path mapping:", pathMapRef.current);
    
    // Get current folding ranges
    const currentFoldingRanges = getCurrentFoldingRanges(editor);
    console.log("Current folding ranges:", currentFoldingRanges);
    
    // Get all decorations and filter for folded regions
    const allDecorations = model.getAllDecorations();
    console.log(`All decorations count: ${allDecorations.length}`);
    
    const foldedDecorations = allDecorations.filter(
      d => d.options.isWholeLine && d.options.inlineClassName === 'folded'
    );
    
    console.log(`Folded decorations count: ${foldedDecorations.length}`);
    
    // Log detailed information about each folded region
    if (foldedDecorations.length > 0) {
      console.log("FOLDED REGIONS DETAILS:");
      foldedDecorations.forEach((decoration, index) => {
        const startLine = decoration.range.startLineNumber;
        const endLine = decoration.range.endLineNumber;
        const content = model.getLineContent(startLine);
        const range = { startLineNumber: startLine, endLineNumber: endLine };
        const path = findPathForFoldingRange(range, pathMapRef.current);
        
        console.log(`[${index + 1}] Line range: ${startLine}-${endLine} | Content: "${content.trim()}" | Path: ${path || 'unknown'}`);
        
        // Show a few lines of the folded content
        console.log("  Folded content preview:");
        for (let i = startLine; i <= Math.min(startLine + 2, endLine); i++) {
          console.log(`  Line ${i}: ${model.getLineContent(i).trim()}`);
        }
        if (endLine > startLine + 2) {
          console.log(`  ... and ${endLine - startLine - 2} more lines`);
        }
      });
    } else {
      console.log("No folded regions found");
    }
    
    // Get hidden range information
    const hiddenRanges = editor.getHiddenAreas ? editor.getHiddenAreas() : [];
    console.log("Hidden ranges:", hiddenRanges);
    
    // Get current foldingModel if available
    if (editor._privateApiMethod && editor._privateApiMethod.foldingController) {
      const foldingController = editor._privateApiMethod.foldingController;
      console.log("Folding controller:", foldingController);
    }
    
    console.log("===== END FOLDING DEBUG INFO =====");
    
    return {
      pathMap: pathMapRef.current,
      foldingRanges: currentFoldingRanges,
      foldedDecorations
    };
  }, []);
  
  const configureJsonLanguage = useCallback((monaco: Monaco) => {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: false,
      schemaValidation: 'error',
      schemaRequest: 'warning',
      trailingCommas: 'error',
    });
  }, []);
  
  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Configure JSON language features
    configureJsonLanguage(monaco);
    
    // Add command to format JSON
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      handleFormatCode();
    });
    
    // Turn on bracket pair colorization
    editor.updateOptions({
      bracketPairColorization: { enabled: true },
    });
    
    // Generate initial path map
    setTimeout(() => {
      const model = editor.getModel();
      if (model) {
        pathMapRef.current = generateLineToPathMap(model);
        console.log("Initial path map generated:", pathMapRef.current);
      }
    }, 500);

    // Add specific listeners for fold/unfold events
    if (onToggleCollapse) {
      // Listen for decoration changes (which include folding/unfolding)
      const decorationsDisposable = editor.onDidChangeModelDecorations(() => {
        const model = editor.getModel();
        if (!model) return;
        
        // Get current folding ranges
        const currentFoldingRanges = getCurrentFoldingRanges(editor);
        
        // Only continue if we have both current and previous ranges
        if (currentFoldingRanges.length === 0 && previousFoldingRangesRef.current.length === 0) {
          return;
        }
        
        console.log('===== FOLD/UNFOLD EVENT DETECTED =====');
        console.log('Event timestamp:', new Date().toISOString());
        console.log('Previous folding ranges count:', previousFoldingRangesRef.current.length);
        console.log('Current folding ranges count:', currentFoldingRanges.length);
        
        // Filter to just the ranges that represent collapsed sections
        const prevCollapsedRanges = previousFoldingRangesRef.current;
        const currCollapsedRanges = currentFoldingRanges
          .filter(r => r.isCollapsed)
          .map(({ startLineNumber, endLineNumber }) => ({ 
            startLineNumber, 
            endLineNumber 
          }));
        
        // Ensure we have the latest path map
        if (Object.keys(pathMapRef.current).length === 0) {
          pathMapRef.current = generateLineToPathMap(model);
        }
        
        // Detect changes between previous and current ranges
        const changes = detectFoldingChanges(
          prevCollapsedRanges,
          currCollapsedRanges,
          pathMapRef.current
        );
        
        console.log('Detected changes:');
        console.log('- Newly folded:', changes.folded);
        console.log('- Newly unfolded:', changes.unfolded);
        
        // Process newly folded ranges
        if (changes.folded.length > 0) {
          changes.folded.forEach(({ path, range }) => {
            if (path) {
              console.log(`Folding detected at line ${range.startLineNumber}, path: ${path}`);
              onToggleCollapse(path, true);
              
              // Show folding details for debugging
              if (isDebugMode) {
                const content = model.getLineContent(range.startLineNumber).trim();
                toast.info(`Folded: ${path}`, {
                  description: `Line ${range.startLineNumber}: ${content}`
                });
              }
            }
          });
        }
        
        // Process newly unfolded ranges
        if (changes.unfolded.length > 0) {
          changes.unfolded.forEach(({ path, range }) => {
            if (path) {
              console.log(`Unfolding detected at line ${range.startLineNumber}, path: ${path}`);
              onToggleCollapse(path, false);
              
              // Show unfolding details for debugging
              if (isDebugMode) {
                const content = model.getLineContent(range.startLineNumber).trim();
                toast.info(`Expanded: ${path}`, {
                  description: `Line ${range.startLineNumber}: ${content}`
                });
              }
            }
          });
        }
        
        // Update reference to current ranges for next comparison
        previousFoldingRangesRef.current = currCollapsedRanges;
        console.log('===== END FOLD/UNFOLD EVENT =====');
      });
      
      // Listen for content changes to update path map
      const contentChangeDisposable = editor.onDidChangeModelContent(() => {
        // Don't regenerate on every keystroke - use a debounce approach
        if (window.pathMapUpdateTimeout) {
          clearTimeout(window.pathMapUpdateTimeout);
        }
        
        window.pathMapUpdateTimeout = setTimeout(() => {
          refreshPathMap();
        }, 1000); // Regenerate path map 1 second after typing stops
      });
      
      // Setup keyboard command listeners for fold/unfold actions
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.BracketLeft, () => {
        console.log("Fold command triggered via keyboard");
        // Log current folded state after a delay to allow folding to complete
        setTimeout(() => inspectFoldedRegions(editor), 100);
      });
      
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.BracketRight, () => {
        console.log("Unfold command triggered via keyboard");
        // Log current folded state after a delay to allow unfolding to complete
        setTimeout(() => inspectFoldedRegions(editor), 100);
      });
      
      // Add global function for manual inspection
      window.inspectMonacoEditor = () => {
        console.log("=== MANUAL EDITOR INSPECTION ===");
        console.log("Editor reference:", editor);
        console.log("Monaco reference:", monaco);
        const result = inspectFoldedRegions(editor);
        console.log("Path map:", result.pathMap);
        console.log("=== END MANUAL INSPECTION ===");
        return result;
      };
      
      // Command to toggle debug mode
      editor.addAction({
        id: 'toggle-fold-debug-mode',
        label: 'Toggle Folding Debug Mode',
        run: () => {
          setIsDebugMode(prev => !prev);
          toast.success(`Folding debug mode ${!isDebugMode ? 'enabled' : 'disabled'}`);
        }
      });
      
      // Return a cleanup function to dispose of the event listeners
      return () => {
        decorationsDisposable.dispose();
        contentChangeDisposable.dispose();
        // @ts-ignore - Cleanup global function
        window.inspectMonacoEditor = undefined;
        if (window.pathMapUpdateTimeout) {
          clearTimeout(window.pathMapUpdateTimeout);
        }
      };
    }
  }, [configureJsonLanguage, handleFormatCode, inspectFoldedRegions, onToggleCollapse, refreshPathMap, isDebugMode]);
  
  // Update collapsedPaths reference
  const updateCollapsedPathsRef = useCallback((newPaths: CollapsedState) => {
    prevCollapsedPathsRef.current = { ...newPaths };
  }, []);
  
  // Force a refresh of the folding path mapping
  const forceFoldingRefresh = useCallback(() => {
    if (editorRef.current) {
      const info = inspectFoldedRegions(editorRef.current);
      return info;
    }
    return null;
  }, [inspectFoldedRegions]);
  
  // Create a debug button component for the toolbar
  const DebugFoldingButton = useCallback(() => {
    return (
      <button 
        className="px-2 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded text-xs"
        onClick={() => {
          const result = forceFoldingRefresh();
          toast.info("Folding inspection completed", {
            description: `Found ${result?.foldingRanges?.length || 0} folding ranges and ${Object.keys(result?.pathMap || {}).length} path mappings`
          });
        }}
      >
        Debug Folding
      </button>
    );
  }, [forceFoldingRefresh]);
  
  // Expose debug mode state
  useEffect(() => {
    console.log(`Folding debug mode: ${isDebugMode ? 'enabled' : 'disabled'}`);
  }, [isDebugMode]);
  
  // Add window type declaration for debounce timeout
  useEffect(() => {
    return () => {
      if (window.pathMapUpdateTimeout) {
        clearTimeout(window.pathMapUpdateTimeout);
      }
    };
  }, []);
  
  return {
    editorRef,
    monacoRef,
    prevCollapsedPathsRef,
    handleEditorDidMount,
    handleFormatCode,
    inspectFoldedRegions,
    updateCollapsedPathsRef,
    isDebugMode,
    forceFoldingRefresh,
    DebugFoldingButton
  };
};

// Add pathMapUpdateTimeout to window type
declare global {
  interface Window {
    inspectMonacoEditor?: () => any;
    pathMapUpdateTimeout?: ReturnType<typeof setTimeout>;
  }
}
