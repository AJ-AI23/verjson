
import React, { useRef, useEffect, useState, useCallback } from 'react';
import 'jsoneditor/dist/jsoneditor.css';
import { CollapsedState } from '@/lib/diagram/types';
import { useJsonEditor } from '@/hooks/useJsonEditor';

interface JsonEditorPocProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
  maxDepth: number;
}

export const JsonEditorPoc: React.FC<JsonEditorPocProps> = ({
  value,
  onChange,
  error,
  collapsedPaths = {},
  onToggleCollapse,
  maxDepth
}) => {
  // Create a ref to the editor container DOM element
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Debug state for component props
  const [lastToggleEvent, setLastToggleEvent] = useState<{path: string, isCollapsed: boolean} | null>(null);
  
  // Track if the component has been mounted
  const isMountedRef = useRef<boolean>(false);
  
  // Wrap onToggleCollapse to track the last event
  const handleToggleCollapse = useCallback((path: string, isCollapsed: boolean) => {
    setLastToggleEvent({path, isCollapsed});
    
    // Only call the callback after initial mount to prevent initial setup events
    if (isMountedRef.current && onToggleCollapse) {
      onToggleCollapse(path, isCollapsed);
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
    <div className="h-full flex flex-col bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 rounded-lg border border-border">      
      {/* The container for the JSONEditor instance */}
      <div className="flex-1 editor-container" ref={containerRef}></div>
      
      {/* Error display */}
      {error && (
        <div className="p-3 bg-destructive/10 border-t border-destructive/20 text-destructive text-sm rounded-b-lg">
          <div className="font-medium">Validation Error</div>
          <div className="text-xs mt-1 opacity-90">{error}</div>
        </div>
      )}
    </div>
  );
};
