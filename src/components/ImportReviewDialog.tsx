import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, FileText, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ImportVersionConflictPreview } from '@/components/ImportVersionConflictPreview';
import { useDocumentVersions } from '@/hooks/useDocumentVersions';
import { compareDocumentVersionsPartial } from '@/lib/importVersionUtils';

interface ImportReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  versionId: string;
  document: {
    name: string;
    content: any;
  };
}

export const ImportReviewDialog: React.FC<ImportReviewDialogProps> = ({
  open,
  onOpenChange,
  documentId,
  versionId,
  document
}) => {
  const [step, setStep] = useState<'review' | 'applying'>('review');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingVersion, setPendingVersion] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  
  const { versions, approvePendingVersion, rejectPendingVersion } = useDocumentVersions(documentId);

  // Load the pending version and create comparison
  useEffect(() => {
    if (open && documentId) {
      // If versionId is provided, use it directly
      if (versionId) {
        const version = versions.find(v => v.id === versionId && v.status === 'pending');
        if (version) {
          setPendingVersion(version);
          
          // Create comparison between current document and pending version
          if (version.full_document) {
            const comparisonResult = compareDocumentVersionsPartial(
              document.content,
              version.full_document
            );
            setComparison(comparisonResult);
          }
        }
      } else {
        // Find the most recent pending version for this document
        const pendingVersions = versions.filter(v => v.status === 'pending');
        const latestPending = pendingVersions.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        if (latestPending) {
          setPendingVersion(latestPending);
          
          // Create comparison between current document and pending version
          if (latestPending.full_document) {
            const comparisonResult = compareDocumentVersionsPartial(
              document.content,
              latestPending.full_document
            );
            setComparison(comparisonResult);
          }
        }
      }
    }
  }, [open, documentId, versionId, versions, document.content]);

  const handleApprove = async () => {
    setStep('applying');
    setIsLoading(true);
    
    try {
      const result = await approvePendingVersion(pendingVersion.id);
      if (result.success) {
        toast.success('Import applied successfully');
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to apply import');
        setStep('review');
      }
    } catch (error) {
      console.error('Error approving import:', error);
      toast.error('Failed to apply import');
      setStep('review');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    
    try {
      const result = await rejectPendingVersion(pendingVersion.id);
      if (result.success) {
        toast.success('Import rejected');
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to reject import');
      }
    } catch (error) {
      console.error('Error rejecting import:', error);
      toast.error('Failed to reject import');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
      setStep('review');
    }
  };

  if (!pendingVersion) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Review</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Review Crowdin Import - {document.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {step === 'review' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Import Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Source:</span> Crowdin
                    </div>
                    <div>
                      <span className="font-medium">Import Date:</span>{' '}
                      {new Date(pendingVersion.created_at).toLocaleString()}
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">Description:</span> {pendingVersion.description}
                    </div>
                    {comparison && (
                      <div className="col-span-2">
                        <span className="font-medium">Changes:</span>{' '}
                        {comparison.patches?.length || 0} modifications detected
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {comparison && (
                <div className="flex-1 overflow-hidden">
                  <ImportVersionConflictPreview
                    comparison={comparison}
                    currentSchema={document.content}
                    importSchema={pendingVersion.full_document}
                    sourceDocumentName="Crowdin Import"
                  />
                </div>
              )}

              <Alert>
                <AlertDescription>
                  Review the changes above. Approving will apply these changes to your document and create a new version.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {step === 'applying' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <h3 className="text-lg font-medium">Applying Import</h3>
              <p className="text-sm text-muted-foreground">
                Updating document with imported changes...
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          
          {step === 'review' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isLoading}
                className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject Import
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isLoading}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Apply Import
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportReviewDialog;