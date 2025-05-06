
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
    
    console.log("Inspect folded regions - Model ranges:", model.getOptions());
    
    const decorations = model.getAllDecorations();
    console.log("All decorations:", decorations);
    
    const foldedDecorations = decorations.filter(
      d => d.options.isWholeLine && d.options.inlineClassName === 'folded'
    );
    
    console.log("Folded decorations:", foldedDecorations);
    console.log("Folded ranges:", foldedDecorations.map(d => ({
      startLine: d.range.startLineNumber,
      endLine: d.range.endLineNumber,
      content: model.getLineContent(d.range.startLineNumber)
    })));
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
        console.log('Hidden areas changed - folding/unfolding detected');
        
        const model = editor.getModel();
        if (!model) return;
        
        // Create a temporary map to track collapsed state changes
        const newCollapsedPaths: CollapsedState = {};
        
        // Use getAllDecorations to find folded regions
        const decorations = model.getAllDecorations().filter(
          d => d.options.isWholeLine && d.options.inlineClassName === 'folded'
        );
        
        console.log(`Found ${decorations.length} folded regions in editor`);
        
        // Process each folded region
        decorations.forEach(decoration => {
          // Get the line number of each folded region
          const lineNumber = decoration.range.startLineNumber;
          const lineContent = model.getLineContent(lineNumber);
          const path = extractJsonPathFromLine(model, lineNumber);
          
          console.log(`Checking folded region at line ${lineNumber}: "${lineContent.trim()}" => path: ${path}`);
          
          if (path) {
            console.log(`Area folded at line ${lineNumber}, path: ${path}`);
            newCollapsedPaths[path] = true;
          }
        });
        
        // Log the full set of collapsed paths for debugging
        console.log('Current collapsed paths:', prevCollapsedPathsRef.current);
        console.log('New collapsed paths:', newCollapsedPaths);
        
        // Analyze the folded regions in detail
        const analysis = analyzeFoldedRegions(editor);
        console.log('Folded regions analysis:', analysis);
        
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
        console.log("Editor reference:", editor);
        console.log("Monaco reference:", monaco);
        inspectFoldedRegions(editor);
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
