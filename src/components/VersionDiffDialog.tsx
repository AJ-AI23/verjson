import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatVersion, Version } from '@/lib/versionUtils';

interface VersionDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diff: any;
  version1: { version: Version; description: string } | null;
  version2: { version: Version; description: string } | null;
  loading?: boolean;
}

export const VersionDiffDialog: React.FC<VersionDiffDialogProps> = ({
  open,
  onOpenChange,
  diff,
  version1,
  version2,
  loading
}) => {
  const getOperationColor = (op: string) => {
    switch (op) {
      case 'add':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'remove':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'replace':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'move':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'copy':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatValue = (value: any) => {
    if (value === undefined) return null;
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Version Comparison
            {version1 && version2 && (
              <span className="text-sm font-normal text-muted-foreground">
                v{formatVersion(version1.version)} → v{formatVersion(version2.version)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">Calculating differences...</span>
            </div>
          ) : diff ? (
            <>
              {/* Summary */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                <h4 className="font-medium mb-3">Comparison Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong className="text-muted-foreground">From Version:</strong>
                    <div className="mt-1">
                      <Badge variant="outline">v{version1 ? formatVersion(version1.version) : 'N/A'}</Badge>
                      <span className="ml-2 text-muted-foreground">{version1?.description || ''}</span>
                    </div>
                  </div>
                  <div>
                    <strong className="text-muted-foreground">To Version:</strong>
                    <div className="mt-1">
                      <Badge variant="outline">v{version2 ? formatVersion(version2.version) : 'N/A'}</Badge>
                      <span className="ml-2 text-muted-foreground">{version2?.description || ''}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Changes */}
              {diff.diff && diff.diff.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-medium">Changes ({diff.diff.length})</h4>
                  <div className="space-y-2 max-h-96 overflow-auto">
                    {diff.diff.map((change: any, index: number) => (
                      <div 
                        key={index} 
                        className={`p-3 rounded-lg border ${getOperationColor(change.op)}`}
                      >
                        <div className="flex items-start gap-3">
                          <Badge variant="secondary" className={`uppercase text-xs ${getOperationColor(change.op)}`}>
                            {change.op}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-sm break-all">{change.path}</div>
                            {change.op === 'replace' && change.oldValue !== undefined && (
                              <div className="mt-2 space-y-1">
                                <div className="text-xs text-muted-foreground">Old value:</div>
                                <pre className="text-xs bg-red-50 p-2 rounded border border-red-200 overflow-auto max-h-32">
                                  {formatValue(change.oldValue)}
                                </pre>
                              </div>
                            )}
                            {(change.op === 'add' || change.op === 'replace') && change.value !== undefined && (
                              <div className="mt-2 space-y-1">
                                <div className="text-xs text-muted-foreground">
                                  {change.op === 'replace' ? 'New value:' : 'Value:'}
                                </div>
                                <pre className="text-xs bg-green-50 p-2 rounded border border-green-200 overflow-auto max-h-32">
                                  {formatValue(change.value)}
                                </pre>
                              </div>
                            )}
                            {change.from && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                From: <span className="font-mono">{change.from}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No differences found between these versions.</p>
                </div>
              )}

              {/* Statistics - calculate from diff */}
              {diff.diff && diff.diff.length > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <h4 className="font-medium mb-3">Statistics</h4>
                  <div className="flex gap-4 text-sm">
                    {(() => {
                      const added = diff.diff.filter((c: any) => c.op === 'add').length;
                      const removed = diff.diff.filter((c: any) => c.op === 'remove').length;
                      const modified = diff.diff.filter((c: any) => c.op === 'replace').length;
                      return (
                        <>
                          {added > 0 && (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-green-100 text-green-700">+{added}</Badge>
                              <span className="text-muted-foreground">added</span>
                            </div>
                          )}
                          {removed > 0 && (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-red-100 text-red-700">-{removed}</Badge>
                              <span className="text-muted-foreground">removed</span>
                            </div>
                          )}
                          {modified > 0 && (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-100 text-blue-700">~{modified}</Badge>
                              <span className="text-muted-foreground">modified</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <p>No diff data available.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
