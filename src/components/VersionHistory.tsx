
import React from 'react';
import { SchemaPatch, formatVersion } from '@/lib/versionUtils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Package, Tag, Trash2 } from 'lucide-react';

interface VersionHistoryProps {
  patches: SchemaPatch[];
  onToggleSelection?: (patchId: string) => void;
  onMarkAsReleased?: (patchId: string) => void;
  onDeleteVersion?: (patchId: string) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({ patches, onToggleSelection, onMarkAsReleased, onDeleteVersion }) => {
  if (patches.length === 0) {
    return (
      <div className="text-sm text-slate-500 p-4 text-center">
        No version history yet
      </div>
    );
  }

  // Sort patches by timestamp, oldest first to show initial version at top
  const sortedPatches = [...patches].sort((a, b) => a.timestamp - b.timestamp);
  
  // Check if a patch is before a released version (but allow initial version to be deselected)
  const isBeforeReleased = (patch: SchemaPatch) => {
    const patchIndex = sortedPatches.findIndex(p => p.id === patch.id);
    return sortedPatches.slice(patchIndex + 1).some(p => p.isReleased && p.description !== 'Initial version');
  };
  
  // Check if a version can be deleted
  const canDelete = (patch: SchemaPatch) => {
    if (isInitialVersion(patch)) return false;
    
    // Check if this is a released version with later versions
    const patchIndex = sortedPatches.findIndex(p => p.id === patch.id);
    const hasLaterVersions = sortedPatches.slice(patchIndex + 1).length > 0;
    
    return !(patch.isReleased && hasLaterVersions);
  };
  const isInitialVersion = (patch: SchemaPatch) => {
    return patch.description === 'Initial version' && patch.isReleased;
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
            {(onMarkAsReleased || onDeleteVersion) && (
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {sortedPatches.map((patch, index) => {
            const beforeReleased = isBeforeReleased(patch);
            const isInitial = isInitialVersion(patch);
            return (
              <tr key={patch.id} className={`hover:bg-slate-50 ${patch.isSelected ? 'bg-blue-50' : ''} ${isInitial ? 'border-l-4 border-l-blue-500' : ''}`}>
                <td className="px-3 py-2">
                  <Checkbox
                    checked={patch.isSelected}
                    disabled={beforeReleased && patch.isSelected}
                    onCheckedChange={() => onToggleSelection?.(patch.id)}
                    title={
                      isInitial ? 'Initial version - base document' :
                      beforeReleased && patch.isSelected ? 'Cannot deselect versions before a released version' : ''
                    }
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    {formatVersion(patch.version)}
                    {patch.isReleased && (
                      <Badge variant={isInitial ? "default" : "secondary"} className="text-xs">
                        <Package size={10} className="mr-1" />
                        {isInitial ? 'Initial' : 'Released'}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span title={patch.description} className={isInitial ? 'font-medium text-blue-700' : ''}>
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
                {(onMarkAsReleased || onDeleteVersion) && (
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {onMarkAsReleased && !patch.isReleased && !isInitial && patch.isSelected && (
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
                      
                      {onDeleteVersion && canDelete(patch) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete this version"
                            >
                              <Trash2 size={10} />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Version</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete version {formatVersion(patch.version)}?
                                {patch.description && ` (${patch.description})`}
                                <br />
                                <br />
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => onDeleteVersion(patch.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
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
