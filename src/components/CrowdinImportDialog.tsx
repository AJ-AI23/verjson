import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Download, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ImportVersionConflictPreview } from '@/components/ImportVersionConflictPreview';
import { CrowdinFileValidationDialog } from '@/components/CrowdinFileValidationDialog';
import { compareDocumentVersionsPartial } from '@/lib/importVersionUtils';

interface CrowdinImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    name: string;
    content: any;
    workspace_id: string;
  };
  crowdinIntegration?: {
    project_id?: string;
    file_id?: string;
    file_ids?: string[];
    filename?: string;
    filenames?: string[];
    split_by_paths?: boolean;
  };
  onImportConfirm: (importedSchema: any, comparison: any, sourceDocumentName: string) => void;
}

export const CrowdinImportDialog: React.FC<CrowdinImportDialogProps> = ({
  open,
  onOpenChange,
  document,
  crowdinIntegration,
  onImportConfirm,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importedContent, setImportedContent] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [step, setStep] = useState<'import' | 'validation' | 'preview'>('import');
  const [fileValidation, setFileValidation] = useState<any>(null);
  const [backgroundProcessing, setBackgroundProcessing] = useState<{
    isActive: boolean;
    message: string;
    filesCount?: number;
  }>({ isActive: false, message: '' });

  const handleImport = async () => {
    if (!crowdinIntegration?.file_id && (!crowdinIntegration?.file_ids || crowdinIntegration.file_ids.length === 0)) {
      setError('No Crowdin file ID found for this document');
      return;
    }

    try {
      setIsImporting(true);
      setError('');

      // Support both single file and multiple files
      const hasMultipleFiles = crowdinIntegration?.file_ids && Array.isArray(crowdinIntegration.file_ids);
      
      const { data, error } = await supabase.functions.invoke('crowdin-integration', {
        body: {
          action: 'importTranslationsFromCrowdin',
          ...(hasMultipleFiles 
            ? { fileIds: crowdinIntegration.file_ids }
            : { fileId: crowdinIntegration.file_id }
          ),
          projectId: crowdinIntegration.project_id,
          documentId: document.id,
          workspaceId: document.workspace_id,
        }
      });

      if (error || data.error) {
        setError(data?.error || 'Failed to import from Crowdin');
        return;
      }

      // Handle background processing response
      if (data.background) {
        setBackgroundProcessing({
          isActive: true,
          message: data.message || `Import of ${data.filesCount} files started in background`,
          filesCount: data.filesCount
        });
        toast.success(data.message || `Import of ${data.filesCount} files started in background`);
        toast.info('Large imports are processed in the background. You can continue working while files are being processed.');
        return;
      }

      // Check if this is a partial import (some files missing)
      if (data.fileValidation && data.partialImport) {
        setFileValidation(data);
        setStep('validation');
        return;
      }

      // Process the import data (only for synchronous imports)
      await processImportData(data);
      
    } catch (err) {
      console.error('Error importing from Crowdin:', err);
      setError('Failed to import from Crowdin');
    } finally {
      setIsImporting(false);
    }
  };

  const processImportData = async (data: any) => {
    let finalContent: any;
    
    if (data.isMultiFile) {
      // Merge multiple files back into original document structure
      const { mergeTranslationFiles, applyTranslationsToDocument } = await import('@/lib/translationUtils');
      const mergedTranslations = mergeTranslationFiles(data.content);
      finalContent = applyTranslationsToDocument(document.content, mergedTranslations);
    } else {
      finalContent = data.content;
    }

    setImportedContent(finalContent);
    
    // Compare current document content with imported content using partial comparison for Crowdin
    const comparisonResult = compareDocumentVersionsPartial(
      document.content,
      finalContent
    );
    
    setComparison(comparisonResult);
    setStep('preview');
    
    toast.success('Successfully imported from Crowdin');
  };

  const handleContinuePartialImport = async () => {
    if (fileValidation) {
      // Process the partial import data
      await processImportData(fileValidation);
      if (fileValidation.missingFiles > 0) {
        toast.success(`Imported ${fileValidation.availableFiles} of ${fileValidation.availableFiles + fileValidation.missingFiles} files from Crowdin`);
      }
    }
  };

  const handleCancelValidation = () => {
    setStep('import');
    setFileValidation(null);
  };

  const handleConfirmImport = () => {
    if (comparison) {
      // Use the mergedSchema if available (for partial imports) or fall back to importedContent
      const finalSchema = comparison.mergedSchema || importedContent;
      onImportConfirm(finalSchema, comparison, `Crowdin: ${crowdinIntegration?.filename || 'Unknown'}`);
      handleClose();
    }
  };

  const handleClose = () => {
    setStep('import');
    setImportedContent(null);
    setComparison(null);
    setFileValidation(null);
    setError('');
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === 'validation') {
      setStep('import');
      setFileValidation(null);
    } else {
      setStep('import');
      setImportedContent(null);
      setComparison(null);
    }
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import from Crowdin
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'validation' && fileValidation && (
            <CrowdinFileValidationDialog
              open={true}
              onOpenChange={() => {}}
              fileValidation={fileValidation.fileValidation || []}
              availableFiles={fileValidation.availableFiles || 0}
              missingFiles={fileValidation.missingFiles || 0}
              onContinuePartial={handleContinuePartialImport}
              onCancel={handleCancelValidation}
              documentName={document.name}
            />
          )}

          {step === 'import' && (
            <div className="space-y-6 p-1">
              {/* Background Processing Success */}
              {backgroundProcessing.isActive ? (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Import Started Successfully</AlertTitle>
                    <AlertDescription>
                      {backgroundProcessing.message}
                    </AlertDescription>
                  </Alert>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Background Processing
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm">
                        <p className="text-muted-foreground">
                          Your import of {backgroundProcessing.filesCount} files is being processed in the background. 
                          This may take a few minutes depending on the file sizes.
                        </p>
                        <p className="text-muted-foreground mt-2">
                          You can continue working with other documents while the import completes. 
                          You'll receive a notification when it's finished.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end">
                    <Button onClick={() => onOpenChange(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <>
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
                          <span className="font-medium">Crowdin Files:</span>
                          <div className="text-muted-foreground">
                            {crowdinIntegration?.filenames && Array.isArray(crowdinIntegration.filenames) ? (
                              <div className="space-y-1">
                                <p className="text-sm">
                                  {crowdinIntegration.filenames.length} files will be imported:
                                </p>
                                <ul className="text-xs space-y-1 max-h-16 overflow-y-auto">
                                  {crowdinIntegration.filenames.map((filename, index) => (
                                    <li key={index} className="truncate">• {filename}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : (
                              <p>{crowdinIntegration?.filename || 'Unknown filename'}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {crowdinIntegration?.project_id && (
                        <div className="text-sm">
                          <span className="font-medium">Project ID:</span>
                          <span className="text-muted-foreground ml-2">
                            {crowdinIntegration.project_id}
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
                        disabled={isImporting || (!crowdinIntegration?.file_id && (!crowdinIntegration?.file_ids || crowdinIntegration.file_ids.length === 0))}
                        className="w-full"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Validating & Importing from Crowdin...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Import from Crowdin
                          </>
                        )}
                      </Button>
                      
                      {!crowdinIntegration?.file_id && (!crowdinIntegration?.file_ids || crowdinIntegration.file_ids.length === 0) && (
                        <p className="text-xs text-muted-foreground mt-2">
                          This document has not been exported to Crowdin yet.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
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
                  sourceDocumentName={`Crowdin: ${crowdinIntegration?.filename || 'Unknown'}`}
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