import React from 'react';
import { Button } from '@/components/ui/button';
import { Bug, BugOff } from 'lucide-react';
import { useDebug } from '@/contexts/DebugContext';

export const DebugToggle: React.FC = () => {
  const { isDebugMode, toggleDebugMode } = useDebug();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleDebugMode}
      className={`p-2 ${isDebugMode ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'text-gray-500 hover:text-gray-700'}`}
      title={`Debug mode ${isDebugMode ? 'ON' : 'OFF'} - Click to toggle debug toasts`}
    >
      {isDebugMode ? (
        <Bug size={16} className="text-red-600" />
      ) : (
        <BugOff size={16} />
      )}
    </Button>
  );
};