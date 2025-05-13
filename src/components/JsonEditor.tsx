
import React, { useRef, useEffect } from 'react';
import { CollapsedState } from '@/lib/diagram/types';
import { useJsonEditor } from '@/hooks/useJsonEditor';

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
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    initializeEditor, 
    destroyEditor 
  } = useJsonEditor({
    value,
    onChange,
    collapsedPaths,
    onToggleCollapse
  });

  // Initialize the editor when the component mounts
  useEffect(() => {
    if (containerRef.current) {
      initializeEditor(containerRef.current);
    }
    
    // Clean up the editor when the component unmounts
    return () => {
      destroyEditor();
    };
  }, [initializeEditor, destroyEditor]);

  return (
    <div className="h-full">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 mb-2 rounded text-sm">
          {error}
        </div>
      )}
      <div 
        ref={containerRef} 
        className="jsoneditor-container h-full"
      />
    </div>
  );
};
