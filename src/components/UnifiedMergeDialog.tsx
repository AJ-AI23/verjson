import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DocumentMergePreview } from '@/components/workspace/DocumentMergePreview';
import { MergeErrorBoundary } from '@/components/workspace/MergeErrorBoundary';
import { DocumentMergeResult } from '@/lib/documentMergeEngine';
import { Document } from '@/types/workspace';
import { ArrowLeft, Download, GitMerge, Upload } from 'lucide-react';

export type MergeOperationType = 'document-merge' | 'crowdin-import' | 'version-import';

interface UnifiedMergeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  operationType: MergeOperationType;
  title?: string;
  mergeResult: DocumentMergeResult | null;
  documents: Document[];
  resultName: string;
  onConflictResolve: (updatedResult: DocumentMergeResult) => void;
  onConfirm: () => void;
  onBack?: () => void;
  isAnalyzing?: boolean;
  showBackButton?: boolean;
}

const getOperationConfig = (type: MergeOperationType) => {
  switch (type) {
    case 'document-merge':
      return {
        title: 'Merge Documents',
        icon: GitMerge,
        confirmText: 'Merge Documents'
      };
    case 'crowdin-import':
      return {
        title: 'Import from Crowdin',
        icon: Download,
        confirmText: 'Import Version'
      };
    case 'version-import':
      return {
        title: 'Import Version',
        icon: Upload,
        confirmText: 'Import Version'
      };
    default:
      return {
        title: 'Merge Preview',
        icon: GitMerge,
        confirmText: 'Confirm'
      };
  }
};

export const UnifiedMergeDialog: React.FC<UnifiedMergeDialogProps> = ({
  isOpen,
  onOpenChange,
  operationType,
  title,
  mergeResult,
  documents,
  resultName,
  onConflictResolve,
  onConfirm,
  onBack,
  isAnalyzing = false,
  showBackButton = false
}) => {
  const config = getOperationConfig(operationType);
  const Icon = config.icon;
  const displayTitle = title || config.title;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {showBackButton && onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Icon className="h-4 w-4" />
            {displayTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isAnalyzing ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2" />
              <span>Analyzing merge conflicts...</span>
            </div>
          ) : mergeResult ? (
            <MergeErrorBoundary>
              <DocumentMergePreview
                documents={documents}
                mergeResult={mergeResult}
                resultName={resultName}
                onConflictResolve={onConflictResolve}
              />
            </MergeErrorBoundary>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Unable to analyze documents for merging
            </div>
          )}
        </div>

        {mergeResult && !isAnalyzing && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            {showBackButton && onBack && (
              <Button variant="outline" onClick={onBack}>
                Back
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={onConfirm}
              disabled={!mergeResult.isCompatible}
            >
              {config.confirmText}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};