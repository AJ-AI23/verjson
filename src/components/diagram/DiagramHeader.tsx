
import React from 'react';

interface DiagramHeaderProps {
  highlightEnabled?: boolean;
}

export const DiagramHeader: React.FC<DiagramHeaderProps> = ({ highlightEnabled }) => {
  return (
    <div className="p-2 border-b bg-slate-50 flex justify-between items-center">
      <h2 className="font-semibold text-slate-700">Schema Diagram</h2>
      {highlightEnabled && (
        <div className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
          Interactive Highlighting On
        </div>
      )}
    </div>
  );
};
