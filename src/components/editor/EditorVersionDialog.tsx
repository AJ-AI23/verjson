
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VersionHistory } from '@/components/VersionHistory';
import { Operation } from 'fast-json-patch'; // Changed from JsonPatch to Operation
import { SchemaPatch } from '@/lib/versionUtils'; // Added import for SchemaPatch

interface EditorVersionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  patches: SchemaPatch[];
  onToggleSelection: (patchId: string) => void;
  onMarkAsReleased: (patchId: string) => void;
}

export const EditorVersionDialog: React.FC<EditorVersionDialogProps> = ({
  isOpen,
  onOpenChange,
  patches,
  onToggleSelection,
  onMarkAsReleased
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
        </DialogHeader>
        <VersionHistory 
          patches={patches} 
          onToggleSelection={onToggleSelection}
          onMarkAsReleased={onMarkAsReleased}
        />
      </DialogContent>
    </Dialog>
  );
};
