import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, FileText, RefreshCw, Plus } from 'lucide-react';

interface FileStatus {
  filename: string;
  exists: boolean;
  action: 'create' | 'update';
  existingFileId?: string;
}

interface CrowdinExportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileStatuses: FileStatus[];
  onConfirmExport: () => void;
  onCancel: () => void;
  projectName: string;
  branchName?: string;
  folderName?: string;
}

export const CrowdinExportPreviewDialog: React.FC<CrowdinExportPreviewDialogProps> = ({
  open,
  onOpenChange,
  fileStatuses,
  onConfirmExport,
  onCancel,
  projectName,
  branchName,
  folderName,
}) => {
  const filesToCreate = fileStatuses.filter(f => f.action === 'create');
  const filesToUpdate = fileStatuses.filter(f => f.action === 'update');

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Preview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1">
          {/* Export Destination */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Export Destination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Project:</span>
                <Badge variant="outline">{projectName}</Badge>
              </div>
              {branchName && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Branch:</span>
                  <Badge variant="secondary">{branchName}</Badge>
                </div>
              )}
              {folderName && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Folder:</span>
                  <Badge variant="secondary">{folderName}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Export Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {filesToCreate.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">New Files:</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {filesToCreate.length}
                  </Badge>
                </div>
              )}
              {filesToUpdate.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Files to Update:</span>
                  <Badge variant="default" className="bg-blue-100 text-blue-800">
                    {filesToUpdate.length}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* File Actions List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Files to Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {fileStatuses.map((file) => (
                <div key={file.filename} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center gap-2">
                    {file.action === 'create' ? (
                      <Plus className="h-4 w-4 text-green-600" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-blue-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{file.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.action === 'create' ? 'Will create new file' : 'Will update existing file'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={file.action === 'create' ? "default" : "secondary"}>
                    {file.action === 'create' ? 'New' : 'Update'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Warning for Updates */}
          {filesToUpdate.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {filesToUpdate.length} existing file{filesToUpdate.length > 1 ? 's' : ''} will be overwritten with new content. 
                This action cannot be undone. Make sure you have backups if needed.
              </AlertDescription>
            </Alert>
          )}

          {/* Success Info */}
          {filesToCreate.length > 0 && filesToUpdate.length === 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                All files are new and will be created in Crowdin. No existing files will be modified.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirmExport}>
            {filesToUpdate.length > 0 ? 'Confirm Export & Update' : 'Confirm Export'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};