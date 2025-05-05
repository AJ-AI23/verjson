
import React, { useRef, useEffect } from 'react';
import { toast } from 'sonner';
import Editor from '@monaco-editor/react';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  highlightPath?: string | null;
}

export const JsonEditor = ({ value, onChange, error, highlightPath }: JsonEditorProps) => {
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleFormatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
      toast.success('Schema formatted');
    }
  };

  // Highlight the specified path in the editor
  useEffect(() => {
    if (!editorRef.current || !highlightPath) {
      // Clear decorations if no path or editor not available
      if (editorRef.current && decorationsRef.current.length > 0) {
        decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
      }
      return;
    }

    try {
      const model = editorRef.current.getModel();
      const schemaObj = JSON.parse(model.getValue());
      
      // Find the location of the target path in the text
      const pathSegments = highlightPath.split('.');
      
      let targetObj: any = schemaObj;
      for (const segment of pathSegments) {
        if (segment === 'properties' && targetObj.properties) {
          targetObj = targetObj.properties;
        } else if (segment === 'items' && targetObj.items) {
          targetObj = targetObj.items;
        } else if (targetObj[segment] !== undefined) {
          targetObj = targetObj[segment];
        } else {
          // Path segment not found
          console.warn(`Path segment '${segment}' not found in schema`);
          return;
        }
      }
      
      // Convert the target object to text to find its position
      const targetText = JSON.stringify(targetObj, null, 2);
      
      // Find this snippet in the full text
      const fullText = model.getValue();
      const targetPosition = fullText.indexOf(targetText);
      
      if (targetPosition !== -1) {
        // Calculate start and end lines/columns for the highlighted section
        const beforeText = fullText.substring(0, targetPosition);
        const startLineNumber = (beforeText.match(/\n/g) || []).length + 1;
        
        const endText = beforeText + targetText;
        const endLineNumber = (endText.match(/\n/g) || []).length + 1;
        
        // Apply decoration
        const newDecorations = [{
          range: {
            startLineNumber,
            startColumn: 1,
            endLineNumber,
            endColumn: 1
          },
          options: {
            isWholeLine: true,
            className: 'highlighted-line',
            inlineClassName: 'highlighted-text',
            linesDecorationsClassName: 'highlighted-gutter'
          }
        }];
        
        // Update decorations
        decorationsRef.current = editorRef.current.deltaDecorations(
          decorationsRef.current,
          newDecorations
        );
      } else {
        // Clear decorations if target text not found
        decorationsRef.current = editorRef.current.deltaDecorations(
          decorationsRef.current, 
          []
        );
      }
    } catch (err) {
      console.error('Error highlighting path in editor:', err);
      // Clear decorations on error
      if (editorRef.current) {
        decorationsRef.current = editorRef.current.deltaDecorations(
          decorationsRef.current, 
          []
        );
      }
    }
  }, [highlightPath, value]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-slate-50 flex justify-between items-center">
        <h2 className="font-semibold text-slate-700">JSON Schema Editor</h2>
        <button 
          onClick={handleFormatCode}
          className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors"
        >
          Format
        </button>
      </div>
      <div className="flex-1 editor-container">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={value}
          onChange={(value) => onChange(value || '')}
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
          }}
          beforeMount={(monaco) => {
            // Add custom CSS for highlighting
            monaco.editor.defineTheme('schemaEditorTheme', {
              base: 'vs',
              inherit: true,
              rules: [],
              colors: {}
            });
            
            // Add CSS for highlighting
            const style = document.createElement('style');
            style.textContent = `
              .highlighted-line {
                background-color: rgba(173, 216, 230, 0.2);
              }
              .highlighted-text {
                background-color: rgba(173, 216, 230, 0.4);
              }
              .highlighted-gutter {
                background-color: rgba(100, 149, 237, 0.2);
                width: 5px !important;
                margin-left: 3px;
              }
            `;
            document.head.appendChild(style);
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
