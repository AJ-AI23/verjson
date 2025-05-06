
import React, { ReactNode } from 'react';

interface DiagramHeaderProps {
  children?: ReactNode;
}

export const DiagramHeader: React.FC<DiagramHeaderProps> = ({ children }) => {
  return (
    <div className="p-2 border-b bg-slate-50 flex items-center">
      <h2 className="font-semibold text-slate-700">Schema Diagram</h2>
      {children}
    </div>
  );
};
