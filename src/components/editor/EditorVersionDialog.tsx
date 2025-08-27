
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VersionHistory } from '@/components/VersionHistory';
import { Operation } from 'fast-json-patch'; // Changed from JsonPatch to Operation
import { SchemaPatch } from '@/lib/versionUtils'; // Added import for SchemaPatch
import { useDebug } from '@/contexts/DebugContext';

interface EditorVersionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  documentId: string;
  onToggleSelection: (patchId: string) => void;
  onMarkAsReleased: (patchId: string) => void;
  onDeleteVersion: (patchId: string) => void;
}

export const EditorVersionDialog: React.FC<EditorVersionDialogProps> = ({
  isOpen,
  onOpenChange,
  documentId,
  onToggleSelection,
  onMarkAsReleased,
  onDeleteVersion
}) => {
  const { debugToast } = useDebug();
  
  debugToast('🔍 EditorVersionDialog: Rendering with documentId', documentId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
        </DialogHeader>
        <VersionHistory 
          documentId={documentId}
          onToggleSelection={onToggleSelection}
          onMarkAsReleased={onMarkAsReleased}
          onDeleteVersion={onDeleteVersion}
        />
      </DialogContent>
    </Dialog>
  );
};
