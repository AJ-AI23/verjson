
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

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    
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
      // Use the built-in content change events to detect folding changes
      const disposable = editor.onDidChangeModelContent(() => {
        const model = editor.getModel();
        if (!model) return;
        
        // Get the current folding regions
        const foldingController = editor.getContribution('editor.contrib.folding') as any;
        if (!foldingController) return;
        
        // Check the folding regions and compare with previous state
        const decorations = model.getAllDecorations().filter(
          d => d.options.isWholeLine && (
            d.options.className?.includes('folded') || 
            d.options.inlineClassName?.includes('folded')
          )
        );
        
        // Process each folded or unfolded region
        decorations.forEach(decoration => {
          const lineNumber = decoration.range.startLineNumber;
          const path = extractJsonPathFromLine(model, lineNumber);
          
          if (path) {
            const isCurrentlyFolded = decoration.options.className?.includes('folded') || 
                                     decoration.options.inlineClassName?.includes('folded');
            
            // Only notify if the state is different from what we had before
            if (collapsedPaths[path] !== isCurrentlyFolded) {
              console.log(`${isCurrentlyFolded ? 'Folded' : 'Unfolded'}: ${path}`);
              onToggleCollapse(path, isCurrentlyFolded);
            }
          }
        });
        
        // Also check for regions that were previously folded but are now unfolded
        Object.keys(collapsedPaths).forEach(path => {
          if (collapsedPaths[path] && !decorations.some(d => {
            const lineNumber = d.range.startLineNumber;
            const currentPath = extractJsonPathFromLine(model, lineNumber);
            return currentPath === path;
          })) {
            console.log(`Unfolded (detected by absence): ${path}`);
            onToggleCollapse(path, false);
          }
        });
      });
      
      // Setup keyboard command listeners for fold/unfold actions
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.BracketLeft, () => {
        // This is typically the fold command
        console.log("Fold command triggered via keyboard");
      });
      
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.BracketRight, () => {
        // This is typically the unfold command
        console.log("Unfold command triggered via keyboard");
      });
      
      // Return a cleanup function to dispose of the event listeners
      return () => {
        disposable.dispose();
      };
    }
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
