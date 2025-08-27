import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, RefreshCw, Info } from 'lucide-react';

interface VersionMismatchRibbonProps {
  isVisible: boolean;
  onDismiss: () => void;
  onStartFresh: () => void;
  onKeepEdits: () => void;
  documentId?: string;
}

export const VersionMismatchRibbon: React.FC<VersionMismatchRibbonProps> = ({
  isVisible,
  onDismiss,
  onStartFresh,
  onKeepEdits,
  documentId
}) => {
  if (!isVisible) return null;

  return (
    <Alert className="mb-2 border-amber-200 bg-amber-50 text-amber-800">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            This document was updated while you were editing.
          </span>
          <span className="text-sm text-amber-600">
            Your local edits are preserved.
          </span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Button
            size="sm"
            variant="outline"
            onClick={onKeepEdits}
            className="h-7 px-2 text-xs border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-800"
          >
            Keep Editing
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onStartFresh}
            className="h-7 px-2 text-xs border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-800"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Start Fresh
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-200"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};