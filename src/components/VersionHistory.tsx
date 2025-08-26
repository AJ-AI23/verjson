
import React from 'react';
import { SchemaPatch, formatVersion } from '@/lib/versionUtils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Package, Tag } from 'lucide-react';

interface VersionHistoryProps {
  patches: SchemaPatch[];
  onToggleSelection?: (patchId: string) => void;
  onMarkAsReleased?: (patchId: string) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({ patches, onToggleSelection, onMarkAsReleased }) => {
  if (patches.length === 0) {
    return (
      <div className="text-sm text-slate-500 p-4 text-center">
        No version history yet
      </div>
    );
  }

  // Sort patches by timestamp, newest first
  const sortedPatches = [...patches].sort((a, b) => b.timestamp - a.timestamp);
  
  // Check if a patch is before a released version
  const isBeforeReleased = (patch: SchemaPatch) => {
    const patchIndex = sortedPatches.findIndex(p => p.id === patch.id);
    return sortedPatches.slice(0, patchIndex).some(p => p.isReleased);
  };
  
  return (
    <div className="version-history overflow-auto max-h-[400px]">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Select</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Version</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
            {onMarkAsReleased && <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {sortedPatches.map((patch) => {
            const beforeReleased = isBeforeReleased(patch);
            return (
              <tr key={patch.id} className={`hover:bg-slate-50 ${patch.isSelected ? 'bg-blue-50' : ''}`}>
                <td className="px-3 py-2">
                  <Checkbox
                    checked={patch.isSelected}
                    disabled={beforeReleased && patch.isSelected}
                    onCheckedChange={() => onToggleSelection?.(patch.id)}
                    title={beforeReleased && patch.isSelected ? 'Cannot deselect versions before a released version' : ''}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    {formatVersion(patch.version)}
                    {patch.isReleased && (
                      <Badge variant="secondary" className="text-xs">
                        <Package size={10} className="mr-1" />
                        Released
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span title={patch.description}>
                    {patch.description.length > 25 
                      ? `${patch.description.slice(0, 25)}...` 
                      : patch.description}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500 text-xs">
                  {new Date(patch.timestamp).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={
                    patch.tier === 'major' ? 'destructive' : 
                    patch.tier === 'minor' ? 'default' : 
                    'secondary'
                  } className="text-xs">
                    {patch.tier}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {patch.isSelected ? (
                    <Badge variant="default" className="text-xs">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                      Applied
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <span className="w-2 h-2 bg-slate-400 rounded-full mr-1"></span>
                      Skipped
                    </Badge>
                  )}
                </td>
                {onMarkAsReleased && (
                  <td className="px-3 py-2">
                    {!patch.isReleased && patch.isSelected && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1"
                        onClick={() => onMarkAsReleased(patch.id)}
                        title="Mark this version as released"
                      >
                        <Tag size={10} />
                        Release
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
