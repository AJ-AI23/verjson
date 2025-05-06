
import { useRef, useCallback } from 'react';
import { Monaco, OnMount } from '@monaco-editor/react';
import { toast } from 'sonner';
import { CollapsedState } from '@/lib/diagram/types';
import { 
  extractJsonPathFromLine, 
  analyzeFoldedRegions 
} from '@/lib/editorUtils';

interface UseMonacoEditorProps {
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  collapsedPaths?: CollapsedState;
}

export const useMonacoEditor = ({ onToggleCollapse, collapsedPaths = {} }: UseMonacoEditorProps) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const prevCollapsedPathsRef = useRef<CollapsedState>(collapsedPaths);
  
  const handleFormatCode = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
      toast.success('Schema formatted');
    }
  }, []);
  
  const inspectFoldedRegions = useCallback((editor: any) => {
    const model = editor.getModel();
    if (!model) return;
    
    console.log("===== FOLDING DEBUG INFORMATION =====");
    console.log("Model info:", { 
      lineCount: model.getLineCount(),
      uri: model.uri.toString(),
      languageId: model.getLanguageId()
    });
    
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
        const path = extractJsonPathFromLine(model, startLine);
        
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

    // Add specific listeners for fold/unfold events
    if (onToggleCollapse) {
      // Listen for hidden areas changes (folding/unfolding)
      const hiddenAreasDisposable = editor.onDidChangeHiddenAreas(() => {
        console.log('===== FOLD/UNFOLD EVENT DETECTED =====');
        console.log('Event timestamp:', new Date().toISOString());
        
        const model = editor.getModel();
        if (!model) return;
        
        // Create a temporary map to track collapsed state changes
        const newCollapsedPaths: CollapsedState = {};
        
        // Use getAllDecorations to find folded regions
        const decorations = model.getAllDecorations().filter(
          d => d.options.isWholeLine && d.options.inlineClassName === 'folded'
        );
        
        console.log(`Found ${decorations.length} folded regions in editor`);
        
        // Log each folded region in detail
        if (decorations.length > 0) {
          console.log("EXACT LINES THAT ARE FOLDED:");
          decorations.forEach((decoration, index) => {
            // Get the line number of each folded region
            const lineNumber = decoration.range.startLineNumber;
            const endLineNumber = decoration.range.endLineNumber;
            const lineContent = model.getLineContent(lineNumber);
            const path = extractJsonPathFromLine(model, lineNumber);
            
            console.log(`[${index + 1}] Lines ${lineNumber}-${endLineNumber}: "${lineContent.trim()}" => JSON path: ${path || 'unknown'}`);
            
            if (path) {
              console.log(`Area folded at line ${lineNumber}, path: ${path}`);
              newCollapsedPaths[path] = true;
            }
          });
        } else {
          console.log("No folded regions detected");
        }
        
        // Log the full set of collapsed paths for debugging
        console.log('COLLAPSED STATE COMPARISON:');
        console.log('Previous collapsed paths:', Object.keys(prevCollapsedPathsRef.current));
        console.log('New collapsed paths:', Object.keys(newCollapsedPaths));
        
        // Detect what was added vs removed
        const added = Object.keys(newCollapsedPaths).filter(
          path => !prevCollapsedPathsRef.current[path]
        );
        const removed = Object.keys(prevCollapsedPathsRef.current).filter(
          path => !newCollapsedPaths[path]
        );
        
        console.log('Newly collapsed paths:', added);
        console.log('Newly expanded paths:', removed);
        
        // Analyze the folded regions in detail
        const analysis = analyzeFoldedRegions(editor);
        console.log('DECORATION AND RANGE DETAILS:');
        console.log(analysis);
        
        // Compare with current collapsed paths to detect changes
        Object.keys(prevCollapsedPathsRef.current).forEach(path => {
          if (prevCollapsedPathsRef.current[path] && !newCollapsedPaths[path]) {
            // This path was collapsed but is no longer collapsed
            console.log(`Detected unfolding of path: ${path}`);
            onToggleCollapse(path, false);
          }
        });
        
        Object.keys(newCollapsedPaths).forEach(path => {
          if (!prevCollapsedPathsRef.current[path]) {
            // This path is newly collapsed
            console.log(`Detected folding of path: ${path}`);
            onToggleCollapse(path, true);
          }
        });
        
        // Update reference to current collapsed paths
        prevCollapsedPathsRef.current = { ...newCollapsedPaths };
        console.log('===== END FOLD/UNFOLD EVENT =====');
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
        inspectFoldedRegions(editor);
        console.log("=== END MANUAL INSPECTION ===");
      };
      
      // Return a cleanup function to dispose of the event listeners
      return () => {
        hiddenAreasDisposable.dispose();
        // @ts-ignore - Cleanup global function
        window.inspectMonacoEditor = undefined;
      };
    }
  }, [configureJsonLanguage, handleFormatCode, inspectFoldedRegions, onToggleCollapse]);
  
  // Update collapsedPaths reference
  const updateCollapsedPathsRef = useCallback((newPaths: CollapsedState) => {
    prevCollapsedPathsRef.current = { ...newPaths };
  }, []);
  
  return {
    editorRef,
    monacoRef,
    prevCollapsedPathsRef,
    handleEditorDidMount,
    handleFormatCode,
    inspectFoldedRegions,
    updateCollapsedPathsRef
  };
};
