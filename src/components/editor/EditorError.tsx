
import React from 'react';

interface EditorErrorProps {
  error: string | null;
}

export const EditorError: React.FC<EditorErrorProps> = ({ error }) => {
  if (!error) return null;
  
  return (
    <div className="p-2 bg-red-50 border-t border-red-200 text-red-600 text-sm">
      <p className="font-medium">Error:</p>
      <p className="text-xs whitespace-pre-wrap">{error}</p>
    </div>
  );
};
