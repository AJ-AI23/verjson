
import React from 'react';

interface DiagramEmptyProps {
  error?: boolean;
  noSchema?: boolean;
}

export const DiagramEmpty: React.FC<DiagramEmptyProps> = ({ error, noSchema }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-slate-50">
        <h2 className="font-semibold text-slate-700">Schema Diagram</h2>
      </div>
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="p-4 text-center text-slate-500">
          {error ? (
            <p>Fix Schema errors to view diagram</p>
          ) : (
            <p>No schema components to display</p>
          )}
        </div>
      </div>
    </div>
  );
};
