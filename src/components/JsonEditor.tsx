
import React, { useRef, useEffect } from 'react';
import { toast } from 'sonner';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { parseJsonSchema } from '@/lib/schemaUtils';
import { CollapsedState } from '@/lib/diagram/types';
import { extractJsonPathFromLine, updateCollapsedState } from '@/lib/editorUtils';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const JsonEditor = ({ 
  value, 
  onChange, 
  error, 
  collapsedPaths = {},
  onToggleCollapse 
}: JsonEditorProps) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Configure JSON language features
    configureJsonLanguage(monaco);
    
    // Add command to format JSON
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      handleFormatCode();
    });
    
    // Print out available editor properties for debugging
    console.log("Monaco editor instance available methods:", 
      Object.getOwnPropertyNames(Object.getPrototypeOf(editor))
        .filter(prop => typeof editor[prop as keyof typeof editor] === 'function')
    );
    
    console.log("Monaco editor instance available properties:", 
      Object.getOwnPropertyNames(editor)
        .filter(prop => typeof editor[prop as keyof typeof editor] !== 'function')
    );
    
    // Log folding controller if available
    const foldingController = editor.getContribution('editor.contrib.folding');
    if (foldingController) {
      console.log("Folding controller:", foldingController);
      console.log("Folding controller methods:", 
        Object.getOwnPropertyNames(Object.getPrototypeOf(foldingController))
          .filter(prop => typeof foldingController[prop as keyof typeof foldingController] === 'function')
      );
    }
    
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
        console.log('Current collapsed paths:', collapsedPaths);
        console.log('New collapsed paths:', newCollapsedPaths);
        
        // Get raw folding ranges for deeper inspection
        const foldingController = editor.getContribution('editor.contrib.folding');
        if (foldingController) {
          // Check if we can get regions from the controller
          if (typeof foldingController.getRegion === 'function') {
            // Log first 10 lines to see if they have folding regions
            for (let i = 1; i <= 10; i++) {
              const region = foldingController.getRegion(i);
              if (region) {
                console.log(`Line ${i} has folding region:`, region);
              }
            }
          }
        }
        
        // Create a temporary map to track collapsed state changes
        const newCollapsedPaths: CollapsedState = {};
        
        // Compare with current collapsed paths to detect changes
        Object.keys(collapsedPaths).forEach(path => {
          if (collapsedPaths[path] && !newCollapsedPaths[path]) {
            // This path was collapsed but is no longer collapsed
            console.log(`Detected unfolding of path: ${path}`);
            onToggleCollapse(path, false);
          }
        });
        
        Object.keys(newCollapsedPaths).forEach(path => {
          if (!collapsedPaths[path]) {
            // This path is newly collapsed
            console.log(`Detected folding of path: ${path}`);
            onToggleCollapse(path, true);
          }
        });
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
  };
  
  // Helper function to inspect folded regions
  const inspectFoldedRegions = (editor: any) => {
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
  };

  // Configure advanced JSON language features
  const configureJsonLanguage = (monaco: Monaco) => {
    // Set JSON validation options
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: false,
      schemaValidation: 'error',
      schemaRequest: 'warning',
      trailingCommas: 'error',
    });
  };

  const handleFormatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
      toast.success('Schema formatted');
    }
  };

  const validateOnChange = (value: string | undefined) => {
    const newValue = value || '';
    onChange(newValue);
    
    // Quick validation feedback without blocking
    try {
      parseJsonSchema(newValue);
    } catch (err) {
      // Don't show toast for every keystroke - this is just for the editor's internal state
      // The proper validation is handled by the parent component
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-slate-50 flex justify-between items-center">
        <h2 className="font-semibold text-slate-700">JSON Schema Editor</h2>
        <div className="flex gap-2">
          <button 
            onClick={handleFormatCode}
            className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors flex items-center gap-1"
            title="Format JSON (Ctrl+F)"
          >
            <span>Format</span>
          </button>
          <button 
            onClick={() => {
              if (window.inspectMonacoEditor) {
                (window as any).inspectMonacoEditor();
              }
            }}
            className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded transition-colors flex items-center gap-1"
            title="Inspect Monaco Editor"
          >
            <span>Inspect Editor</span>
          </button>
        </div>
      </div>
      <div className="flex-1 editor-container">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={value}
          onChange={validateOnChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            wrappingIndent: 'same',
            automaticLayout: true,
            tabSize: 2,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
            },
            formatOnPaste: true,
            formatOnType: true,
            rulers: [],
            bracketPairColorization: {
              enabled: true,
            },
            guides: {
              bracketPairs: true,
            },
            folding: true,
            showFoldingControls: 'always',
          }}
        />
      </div>
      {error && (
        <div className="p-2 bg-red-50 border-t border-red-200 text-red-600 text-sm">
          <p className="font-medium">Error:</p>
          <p className="text-xs whitespace-pre-wrap">{error}</p>
        </div>
      )}
    </div>
  );
};

