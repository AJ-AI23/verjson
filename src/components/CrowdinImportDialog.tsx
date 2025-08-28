import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ImportVersionConflictPreview } from '@/components/ImportVersionConflictPreview';
import { compareDocumentVersionsPartial } from '@/lib/importVersionUtils';

interface CrowdinImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    name: string;
    content: any;
    crowdin_file_id?: string;
    crowdin_project_id?: string;
    crowdin_filename?: string;
    workspace_id: string;
  };
  onImportConfirm: (importedSchema: any, comparison: any, sourceDocumentName: string) => void;
}

export const CrowdinImportDialog: React.FC<CrowdinImportDialogProps> = ({
  open,
  onOpenChange,
  document,
  onImportConfirm,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importedContent, setImportedContent] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [step, setStep] = useState<'import' | 'preview'>('import');

  const handleImport = async () => {
    if (!document.crowdin_file_id) {
      setError('No Crowdin file ID found for this document');
      return;
    }

    try {
      setIsImporting(true);
      setError('');

      const { data, error } = await supabase.functions.invoke('crowdin-integration', {
        body: {
          action: 'import',
          fileId: document.crowdin_file_id,
          projectId: document.crowdin_project_id,
          documentId: document.id,
          workspaceId: document.workspace_id,
        }
      });

      if (error || data.error) {
        setError(data?.error || 'Failed to import from Crowdin');
        return;
      }

      setImportedContent(data.content);
      
      // Compare current document content with imported content using partial comparison for Crowdin
      const comparisonResult = compareDocumentVersionsPartial(
        document.content,
        data.content
      );
      
      setComparison(comparisonResult);
      setStep('preview');
      
      toast.success('Successfully imported from Crowdin');
    } catch (err) {
      console.error('Error importing from Crowdin:', err);
      setError('Failed to import from Crowdin');
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = () => {
    if (comparison) {
      // Use the mergedSchema if available (for partial imports) or fall back to importedContent
      const finalSchema = comparison.mergedSchema || importedContent;
      onImportConfirm(finalSchema, comparison, `Crowdin: ${document.crowdin_filename || 'Unknown'}`);
      handleClose();
    }
  };

  const handleClose = () => {
    setStep('import');
    setImportedContent(null);
    setComparison(null);
    setError('');
    onOpenChange(false);
  };

  const handleBack = () => {
    setStep('import');
    setImportedContent(null);
    setComparison(null);
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import from Crowdin
            {step === 'preview' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                className="ml-auto"
              >
                Back
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'import' && (
            <div className="space-y-6 p-1">
              {/* Document Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Document Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Document:</span>
                      <p className="text-muted-foreground">{document.name}</p>
                    </div>
                    <div>
                      <span className="font-medium">Crowdin File:</span>
                      <p className="text-muted-foreground">
                        {document.crowdin_filename || 'Unknown filename'}
                      </p>
                    </div>
                  </div>
                  
                  {document.crowdin_project_id && (
                    <div className="text-sm">
                      <span className="font-medium">Project ID:</span>
                      <span className="text-muted-foreground ml-2">
                        {document.crowdin_project_id}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Import Action */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import from Crowdin</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    This will download the latest version of your document from Crowdin and 
                    show you a preview of any changes before importing.
                  </p>
                  
                  <Button
                    onClick={handleImport}
                    disabled={isImporting || !document.crowdin_file_id}
                    className="w-full"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing from Crowdin...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Import from Crowdin
                      </>
                    )}
                  </Button>
                  
                  {!document.crowdin_file_id && (
                    <p className="text-xs text-muted-foreground mt-2">
                      This document has not been exported to Crowdin yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {step === 'preview' && importedContent && comparison && (
            <div className="h-full flex flex-col">
              <div className="mb-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Successfully imported from Crowdin. Review the changes below and confirm to create a new document version.
                  </AlertDescription>
                </Alert>
              </div>

              <div className="flex-1 overflow-hidden">
                <ImportVersionConflictPreview
                  currentSchema={document.content}
                  importSchema={comparison.mergedSchema || importedContent}
                  comparison={comparison}
                  sourceDocumentName={`Crowdin: ${document.crowdin_filename || 'Unknown'}`}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button onClick={handleConfirmImport}>
                  Import Version
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};