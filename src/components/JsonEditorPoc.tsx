
import React, { useRef, useEffect, useState, useCallback } from 'react';
import 'jsoneditor/dist/jsoneditor.css';
import { CollapsedState } from '@/lib/diagram/types';
import { useJsonEditor } from '@/hooks/useJsonEditor';
import { toast } from '@/components/ui/use-toast';

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
  maxDepth = 1
}) => {
  // Create a ref to the editor container DOM element
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Debug state for component props
  const [lastToggleEvent, setLastToggleEvent] = useState<{path: string, isCollapsed: boolean} | null>(null);
  
  // Track if the component has been mounted
  const isMountedRef = useRef<boolean>(false);
  
  // Wrap onToggleCollapse to track the last event
  const handleToggleCollapse = useCallback((path: string, isCollapsed: boolean) => {
    console.log(`JsonEditorPoc: Toggle collapse for path=${path}, isCollapsed=${isCollapsed}`);
    setLastToggleEvent({path, isCollapsed});
    
    // Only call the callback after initial mount to prevent initial setup events
    if (isMountedRef.current && onToggleCollapse) {
      onToggleCollapse(path, isCollapsed);
      
      // Show toast notification
      toast({
        title: isCollapsed ? "Collapsed" : "Expanded",
        description: path
      });
    }
  }, [onToggleCollapse]);
  
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
    
    // Initialize the editor
    initializeEditor(containerRef.current);
    
    // Mark as mounted after a small delay to let initial setup complete
    setTimeout(() => {
      isMountedRef.current = true;
    }, 500);
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      destroyEditor();
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-slate-50 flex justify-between items-center">
        <h2 className="font-semibold text-slate-700">JSON Editor</h2>
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
