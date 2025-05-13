
import React, { useRef, useEffect, useState } from 'react';
import 'jsoneditor/dist/jsoneditor.css';
import { CollapsedState } from '@/lib/diagram/types';
import { useJsonEditor } from '@/hooks/useJsonEditor';

interface JsonEditorPocProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth?: number;
}

export const JsonEditorPoc: React.FC<JsonEditorPocProps> = ({
  value,
  onChange,
  error,
  collapsedPaths = {},
  onToggleCollapse,
  maxDepth = 3
}) => {
  // Create a ref to the editor container DOM element
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Debug state for component props
  const [lastToggleEvent, setLastToggleEvent] = useState<{path: string, isCollapsed: boolean} | null>(null);
  
  // Wrap onToggleCollapse to track the last event
  const handleToggleCollapse = (path: string, isCollapsed: boolean) => {
    console.log(`JsonEditorPoc: Toggle collapse for path=${path}, isCollapsed=${isCollapsed}`);
    setLastToggleEvent({path, isCollapsed});
    
    if (onToggleCollapse) {
      onToggleCollapse(path, isCollapsed);
    } else {
      console.warn('JsonEditorPoc: No onToggleCollapse handler provided');
    }
  };
  
  // Use the custom hook for editor functionality
  const {
    initializeEditor,
    destroyEditor,
    expandAll,
    collapseAll,
    expandFirstLevel,
    foldingDebug,
    pathExceedsMaxDepth
  } = useJsonEditor({
    value,
    onChange,
    collapsedPaths,
    onToggleCollapse: handleToggleCollapse,
    maxDepth
  });

  // Initialize the editor once the component mounts
  useEffect(() => {
    if (!containerRef.current) return;
    
    console.log('JsonEditorPoc: Initializing editor with:');
    console.log('- Collapsed paths:', collapsedPaths);
    console.log('- Max depth:', maxDepth);
    console.log('- onToggleCollapse handler present:', !!onToggleCollapse);
    
    // Initialize the editor
    initializeEditor(containerRef.current);
    
    // Cleanup on unmount
    return destroyEditor;
  }, []);
  
  // Debug log for collapsedPaths changes
  useEffect(() => {
    console.log('JsonEditorPoc: collapsedPaths changed:', collapsedPaths);
    console.log('Paths count:', Object.keys(collapsedPaths).length);
    console.log('Root collapsed?', collapsedPaths.root === true);
  }, [collapsedPaths]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-slate-50 flex justify-between items-center">
        <h2 className="font-semibold text-slate-700">JSON Editor</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              console.log('Expand All button clicked');
              expandAll();
            }}
            className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={() => {
              console.log('Collapse All button clicked');
              collapseAll();
            }}
            className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors"
          >
            Collapse All
          </button>
          <button
            onClick={() => {
              console.log('Expand First Level button clicked');
              expandFirstLevel();
            }}
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
      
      {/* Debug info */}
      <div className="p-1 bg-blue-50 border-t border-blue-200 text-blue-700 text-xs flex flex-col gap-1">
        <div>Last toggle event: {lastToggleEvent ? 
          `${lastToggleEvent.path} - ${lastToggleEvent.isCollapsed ? 'collapsed' : 'expanded'}` : 
          'none'}</div>
        {foldingDebug && (
          <div>Last {foldingDebug.lastOperation}: {foldingDebug.path} at {new Date(foldingDebug.timestamp).toLocaleTimeString()}</div>
        )}
        <div>
          <span>Collapsed paths: </span>
          {Object.keys(collapsedPaths).length > 0 ? 
            Object.entries(collapsedPaths)
              .filter(([_, isCollapsed]) => isCollapsed)
              .map(([path]) => path)
              .join(', ') 
            : 'None'}
        </div>
      </div>
    </div>
  );
};
