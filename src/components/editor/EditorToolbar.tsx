
import React from 'react';
import { toast } from 'sonner';

interface EditorToolbarProps {
  onFormatCode: () => void;
  onInspectEditor: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onFormatCode,
  onInspectEditor
}) => {
  return (
    <div className="p-2 border-b bg-slate-50 flex justify-between items-center">
      <h2 className="font-semibold text-slate-700">JSON Schema Editor</h2>
      <div className="flex gap-2">
        <button 
          onClick={onFormatCode}
          className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors flex items-center gap-1"
          title="Format JSON (Ctrl+F)"
        >
          <span>Format</span>
        </button>
        <button 
          onClick={onInspectEditor}
          className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded transition-colors flex items-center gap-1"
          title="Inspect Monaco Editor"
        >
          <span>Inspect Editor</span>
        </button>
      </div>
    </div>
  );
};
