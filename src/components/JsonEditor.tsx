
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
      const fullText = model.getValue();
      
      // Try to parse the JSON
      const schemaObj = JSON.parse(fullText);
      
      // Find the location of the target path in the text
      const pathSegments = highlightPath.split('.');
      
      // Start with the root schema object
      let currentObj = schemaObj;
      let currentPath = '';
      let targetText = '';
      
      // Navigate through the path segments to find the target object
      for (let i = 0; i < pathSegments.length; i++) {
        const segment = pathSegments[i];
        
        // Special case for 'root'
        if (segment === 'root' && i === 0) {
          continue;
        }
        
        // Handle properties segment specially
        if (segment === 'properties') {
          if (currentObj.properties) {
            currentObj = currentObj.properties;
            currentPath = currentPath ? `${currentPath}.properties` : 'properties';
          } else {
            console.log(`Properties not found at path ${currentPath}`);
            return;
          }
        } 
        // Handle items segment specially
        else if (segment === 'items') {
          if (currentObj.items) {
            currentObj = currentObj.items;
            currentPath = currentPath ? `${currentPath}.items` : 'items';
          } else {
            console.log(`Items not found at path ${currentPath}`);
            return;
          }
        }
        // Handle normal property access
        else if (currentObj[segment] !== undefined) {
          currentObj = currentObj[segment];
          currentPath = currentPath ? `${currentPath}.${segment}` : segment;
        } 
        // Handle property object within properties
        else if (currentObj && Object.keys(currentObj).includes(segment)) {
          targetText = JSON.stringify(currentObj[segment], null, 2);
          // Find the property in the text
          const propertyPattern = new RegExp(`"${segment}"\\s*:\\s*\\{`);
          const match = fullText.match(propertyPattern);
          
          if (match) {
            const startPos = match.index;
            if (startPos !== undefined && startPos >= 0) {
              // Count lines to get to this position
              const textBeforeMatch = fullText.substring(0, startPos);
              const lineNumber = (textBeforeMatch.match(/\n/g) || []).length + 1;
              
              // Apply decoration to the whole property
              const newDecorations = [{
                range: {
                  startLineNumber: lineNumber,
                  startColumn: 1,
                  endLineNumber: lineNumber + (targetText.match(/\n/g) || []).length + 2,
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
              
              // Break out of the loop since we found and highlighted the target
              break;
            }
          }
        }
        else {
          console.log(`Path segment '${segment}' not found in schema`);
          return;
        }
      }
      
      // If we've navigated to the final object, highlight it
      if (!targetText) {
        targetText = JSON.stringify(currentObj, null, 2);
        const escapedPath = currentPath.replace(/\./g, '\\.');
        let pattern;
        
        // Different pattern depending on whether it's a root or nested object
        if (currentPath === '' || currentPath === 'root') {
          // For root object, highlight the entire content
          pattern = /^\{/;
        } else if (currentPath.endsWith('properties')) {
          pattern = /"properties"\s*:\s*\{/;
        } else {
          // For nested objects, look for the property pattern
          const lastSegment = currentPath.split('.').pop();
          pattern = new RegExp(`"${lastSegment}"\\s*:\\s*\\{`);
        }
        
        const match = fullText.match(pattern);
        if (match && match.index !== undefined) {
          const startPos = match.index;
          
          // Count lines to get to this position
          const textBeforeMatch = fullText.substring(0, startPos);
          const startLineNumber = (textBeforeMatch.match(/\n/g) || []).length + 1;
          
          // Find how many lines the target object spans
          const endLineNumber = startLineNumber + (targetText.match(/\n/g) || []).length + 2;
          
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
        }
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
