
import React, { useRef, useEffect } from 'react';
import { useJsonEditor } from '@/hooks/useJsonEditor';
import { CollapsedState } from '@/lib/diagram/types';
import 'jsoneditor/dist/jsoneditor.css';

interface JsonEditorWrapperProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  collapsedPaths?: CollapsedState;
  onToggleCollapse?: (path: string, isCollapsed: boolean) => void;
}

export const JsonEditorWrapper = ({ 
  value, 
  onChange, 
  error,
  collapsedPaths = {},
  onToggleCollapse 
}: JsonEditorWrapperProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    initializeEditor, 
    destroyEditor,
  } = useJsonEditor({
    value,
    onChange,
    collapsedPaths,
    onToggleCollapse
  });

  // Initialize editor when component mounts
  useEffect(() => {
    if (containerRef.current) {
      initializeEditor(containerRef.current);
    }
    
    // Clean up when component unmounts
    return destroyEditor;
  }, [initializeEditor, destroyEditor]);

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Error message display */}
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-50 text-red-600 p-2 border border-red-200 z-10 overflow-auto max-h-32">
          {error}
        </div>
      )}
      {/* JSON Editor container */}
      <div 
        ref={containerRef} 
        className="w-full flex-1 overflow-auto" 
        style={{ 
          height: error ? 'calc(100% - 40px)' : '100%',
          marginTop: error ? '40px' : '0'
        }}
      />
    </div>
  );
};
