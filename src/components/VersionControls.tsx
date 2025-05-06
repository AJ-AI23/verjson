
import React, { useState } from 'react';
import { formatVersion, Version, VersionTier, bumpVersion } from '@/lib/versionUtils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface VersionControlsProps {
  version: Version;
  onVersionBump: (newVersion: Version, tier: VersionTier, description: string) => void;
  isModified: boolean;
}

export const VersionControls: React.FC<VersionControlsProps> = ({ 
  version, 
  onVersionBump,
  isModified
}) => {
  const [description, setDescription] = useState('');
  const [selectedTier, setSelectedTier] = useState<VersionTier>('patch');
  
  const handleBumpVersion = () => {
    if (!isModified) {
      toast.warning('No changes to commit');
      return;
    }
    
    if (!description.trim()) {
      toast.warning('Please provide a description for your changes');
      return;
    }
    
    const newVersion = bumpVersion(version, selectedTier);
    onVersionBump(newVersion, selectedTier, description);
    setDescription('');
    toast.success(`Version bumped to ${formatVersion(newVersion)}`);
  };
  
  return (
    <div className="border-t border-slate-200 p-3 bg-slate-50 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Current Version: <span className="font-mono">{formatVersion(version)}</span></h3>
        {isModified && <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full">Modified</span>}
      </div>
      
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-500 w-20">Change Type:</span>
          <div className="flex gap-1">
            {(['patch', 'minor', 'major'] as VersionTier[]).map(tier => (
              <button
                key={tier}
                className={`text-xs px-2 py-1 rounded ${
                  selectedTier === tier 
                    ? 'bg-blue-100 border border-blue-300 text-blue-700' 
                    : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
                onClick={() => setSelectedTier(tier)}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-500 w-20">Description:</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your changes"
            className="flex-1 text-xs p-1 border border-slate-300 rounded"
          />
        </div>
        
        <Button 
          size="sm" 
          variant="outline" 
          disabled={!isModified || !description.trim()}
          onClick={handleBumpVersion}
          className="ml-auto text-xs"
        >
          Commit Changes
        </Button>
      </div>
    </div>
  );
};
