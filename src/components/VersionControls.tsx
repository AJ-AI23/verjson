
import React, { useState, useEffect } from 'react';
import { formatVersion, Version, VersionTier, bumpVersion } from '@/lib/versionUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface VersionControlsProps {
  version: Version;
  onVersionBump: (newVersion: Version, tier: VersionTier, description: string, isReleased?: boolean) => void;
  isModified: boolean;
}

export const VersionControls: React.FC<VersionControlsProps> = ({ 
  version, 
  onVersionBump,
  isModified
}) => {
  const [description, setDescription] = useState('');
  const [selectedTier, setSelectedTier] = useState<VersionTier>('patch');
  const [editableVersion, setEditableVersion] = useState<Version>({ ...version });
  const [isReleased, setIsReleased] = useState(false);
  
  // Update editable version only when the prop version actually changes
  useEffect(() => {
    // Only update if the version has actually changed, not just re-rendered
    if (version.major !== editableVersion.major || 
        version.minor !== editableVersion.minor || 
        version.patch !== editableVersion.patch) {
      setEditableVersion({ ...version });
    }
  }, [version, editableVersion.major, editableVersion.minor, editableVersion.patch]);

  const handleBumpVersion = () => {
    if (!isModified) {
      toast.warning('No changes to commit');
      return;
    }
    
    if (!description.trim()) {
      toast.warning('Please provide a description for your changes');
      return;
    }
    
    onVersionBump(editableVersion, selectedTier, description, isReleased);
    setDescription('');
    setIsReleased(false);
    toast.success(`Version ${isReleased ? 'released' : 'created'}: ${formatVersion(editableVersion)}`);
  };

  const handleVersionChange = (part: keyof Version, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditableVersion(prev => ({
        ...prev,
        [part]: numValue
      }));
      setSelectedTier(part);
    }
  };
  
  return (
    <div className="border-t border-slate-200 p-3 bg-slate-50 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Current Version</h3>
        {isModified && <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full">Modified</span>}
      </div>
      
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-500 w-20">Version:</span>
          <div className="flex gap-2">
            {/* Major Version */}
            <div className="flex items-center">
              <Input
                type="number"
                value={editableVersion.major}
                onChange={(e) => handleVersionChange('major', e.target.value)}
                className={`w-16 h-8 text-center text-xs ${selectedTier === 'major' ? 'border-blue-400 ring-1 ring-blue-400' : ''}`}
                min="0"
              />
              <span className="text-xs font-bold mx-1">.</span>
            </div>
            
            {/* Minor Version */}
            <div className="flex items-center">
              <Input
                type="number"
                value={editableVersion.minor}
                onChange={(e) => handleVersionChange('minor', e.target.value)}
                className={`w-16 h-8 text-center text-xs ${selectedTier === 'minor' ? 'border-blue-400 ring-1 ring-blue-400' : ''}`}
                min="0"
              />
              <span className="text-xs font-bold mx-1">.</span>
            </div>
            
            {/* Patch Version */}
            <div className="flex items-center">
              <Input
                type="number"
                value={editableVersion.patch}
                onChange={(e) => handleVersionChange('patch', e.target.value)}
                className={`w-16 h-8 text-center text-xs ${selectedTier === 'patch' ? 'border-blue-400 ring-1 ring-blue-400' : ''}`}
                min="0"
              />
            </div>
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
        
        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-500 w-20"></span>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isReleased}
              onChange={(e) => setIsReleased(e.target.checked)}
              className="w-4 h-4"
            />
            Mark as Released (stores full document)
          </label>
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
