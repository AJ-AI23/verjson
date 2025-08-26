
import React from 'react';
import { SchemaPatch, formatVersion } from '@/lib/versionUtils';
import { Button } from '@/components/ui/button';
import { Undo } from 'lucide-react';

interface VersionHistoryProps {
  patches: SchemaPatch[];
  onRevert?: (patch: SchemaPatch) => void; // Changed from index: number to patch: SchemaPatch
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({ patches, onRevert }) => {
  if (patches.length === 0) {
    return (
      <div className="text-sm text-slate-500 p-4 text-center">
        No version history yet
      </div>
    );
  }

  // Sort patches by timestamp, newest first
  const sortedPatches = [...patches].sort((a, b) => b.timestamp - a.timestamp);
  
  return (
    <div className="version-history overflow-auto max-h-[300px]">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Version</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Changes</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
            {onRevert && <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {sortedPatches.map((patch) => (
            <tr key={patch.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-mono text-xs">{formatVersion(patch.version)}</td>
              <td className="px-4 py-2">
                <span title={patch.description}>
                  {patch.description.length > 30 
                    ? `${patch.description.slice(0, 30)}...` 
                    : patch.description}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-500 text-xs">
                {new Date(patch.timestamp).toLocaleString()}
              </td>
              <td className="px-4 py-2">
                <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                  patch.tier === 'major' ? 'bg-red-100 text-red-800' : 
                  patch.tier === 'minor' ? 'bg-blue-100 text-blue-800' : 
                  'bg-green-100 text-green-800'
                }`}>
                  {patch.tier}
                </span>
              </td>
              {onRevert && (
                <td className="px-4 py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1"
                    onClick={() => {
                      console.log('Revert button clicked for patch:', patch);
                      onRevert(patch);
                    }}
                    title={`Revert to version ${formatVersion(patch.version)}`}
                  >
                    <Undo size={12} />
                    Revert
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
