import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, FileX, Files } from 'lucide-react';

interface FileValidation {
  fileId: string;
  exists: boolean;
  name?: string;
  path?: string;
  error?: string;
}

interface CrowdinFileValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileValidation: FileValidation[];
  availableFiles: number;
  missingFiles: number;
  onContinuePartial: () => void;
  onCancel: () => void;
  documentName: string;
}

export const CrowdinFileValidationDialog: React.FC<CrowdinFileValidationDialogProps> = ({
  open,
  onOpenChange,
  fileValidation,
  availableFiles,
  missingFiles,
  onContinuePartial,
  onCancel,
  documentName,
}) => {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Files className="h-5 w-5" />
            File Validation Results
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Import Summary for "{documentName}"</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Available Files:</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  {availableFiles}
                </Badge>
              </div>
              {missingFiles > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Missing Files:</span>
                  <Badge variant="destructive">
                    {missingFiles}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* File Status List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">File Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {fileValidation.map((file) => (
                <div key={file.fileId} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center gap-2">
                    {file.exists ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <FileX className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {file.name || `File ID: ${file.fileId}`}
                      </p>
                      {file.path && (
                        <p className="text-xs text-muted-foreground">{file.path}</p>
                      )}
                      {file.error && (
                        <p className="text-xs text-red-600">{file.error}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={file.exists ? "default" : "destructive"}>
                    {file.exists ? "Available" : "Missing"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Action Alert */}
          {missingFiles > 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {missingFiles} file{missingFiles > 1 ? 's are' : ' is'} missing from Crowdin. 
                You can continue with a partial import of the available files, or cancel to resolve the missing files first.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                All files are available for import. You can proceed with the full import.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {availableFiles > 0 && (
            <Button onClick={onContinuePartial}>
              {missingFiles > 0 ? `Import ${availableFiles} Available File${availableFiles > 1 ? 's' : ''}` : 'Import All Files'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};