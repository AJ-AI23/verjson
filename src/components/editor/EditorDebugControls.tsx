
import React from 'react';
import { toast } from 'sonner';
import { CollapsedState } from '@/lib/diagram/types';

interface EditorDebugControlsProps {
  collapsedPaths: CollapsedState;
  setCollapsedPaths: (updater: (prev: CollapsedState) => CollapsedState) => void;
}

export const EditorDebugControls: React.FC<EditorDebugControlsProps> = ({ 
  collapsedPaths,
  setCollapsedPaths
}) => {
  // Debug button for force expanding root
  const forceExpandRoot = () => {
    console.log('Force expanding root');
    setCollapsedPaths(prev => ({
      ...prev,
      root: false
    }));
    toast.info('Root expanded (forced)');
  };
  
  // Debug button for force collapsing root
  const forceCollapseRoot = () => {
    console.log('Force collapsing root');
    setCollapsedPaths(prev => ({
      ...prev,
      root: true
    }));
    toast.info('Root collapsed (forced)');
  };

  return (
    <div className="px-2 py-1 bg-yellow-50 border-b border-yellow-200 flex gap-2 items-center">
      <span className="text-xs text-yellow-700 font-semibold">Debug Controls:</span>
      <button 
        onClick={forceExpandRoot}
        className="text-xs px-2 py-0.5 bg-green-100 hover:bg-green-200 text-green-800 rounded"
      >
        Force Expand Root
      </button>
      <button 
        onClick={forceCollapseRoot}
        className="text-xs px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded"
      >
        Force Collapse Root
      </button>
      <span className="text-xs text-yellow-600 ml-4">
        Root state: {collapsedPaths.root === true ? 'Collapsed' : 'Expanded'}
      </span>
    </div>
  );
};
