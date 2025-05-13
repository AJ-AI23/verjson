
import React, { useRef, useEffect } from 'react';
import 'jsoneditor/dist/jsoneditor.css';
import { CollapsedState } from '@/lib/diagram/types';
import { useJsonEditor } from '@/hooks/useJsonEditor';

interface JsonEditorPocProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const JsonEditorPoc: React.FC<JsonEditorPocProps> = ({
  value,
  onChange,
  error,
  collapsedPaths = {},
  onToggleCollapse
}) => {
  // Create a ref to the editor container DOM element
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use the custom hook for editor functionality
  const {
    initializeEditor,
    destroyEditor,
    expandAll,
    collapseAll,
    expandFirstLevel,
    foldingDebug
  } = useJsonEditor({
    value,
    onChange,
    collapsedPaths,
    onToggleCollapse
  });

  // Initialize the editor once the component mounts
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initialize the editor
    initializeEditor(containerRef.current);
    
    // Cleanup on unmount
    return destroyEditor;
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-slate-50 flex justify-between items-center">
        <h2 className="font-semibold text-slate-700">JSONEditor Proof of Concept</h2>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors"
          >
            Collapse All
          </button>
          <button
            onClick={expandFirstLevel}
            className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors"
          >
            Expand First Level
          </button>
        </div>
      </div>
      
      {/* The container for the JSONEditor instance */}
      <div className="flex-1 editor-container" ref={containerRef}></div>
      
      {/* Error display */}
      {error && (
        <div className="p-2 bg-red-50 border-t border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}
      
      {/* Debug info - can be removed in production */}
      {foldingDebug && (
        <div className="p-1 bg-blue-50 border-t border-blue-200 text-blue-700 text-xs">
          <div>Last {foldingDebug.lastOperation}: {foldingDebug.path} at {new Date(foldingDebug.timestamp).toLocaleTimeString()}</div>
          <div className="mt-1 text-xs">
            <span>Collapsed paths: </span>
            {Object.keys(collapsedPaths).length > 0 ? 
              Object.entries(collapsedPaths)
                .filter(([_, isCollapsed]) => isCollapsed)
                .map(([path]) => path)
                .join(', ') 
              : 'None'}
          </div>
        </div>
      )}
    </div>
  );
};
