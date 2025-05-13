
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VersionHistory } from '@/components/VersionHistory';
import { Operation } from 'fast-json-patch'; // Changed from JsonPatch to Operation
import { SchemaPatch } from '@/lib/versionUtils'; // Added import for SchemaPatch

interface EditorVersionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  patches: SchemaPatch[]; // Changed from JsonPatch[] to SchemaPatch[]
  onRevert: (patch: SchemaPatch) => void; // Changed parameter from index: number to patch: SchemaPatch
}

export const EditorVersionDialog: React.FC<EditorVersionDialogProps> = ({
  isOpen,
  onOpenChange,
  patches,
  onRevert
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
        </DialogHeader>
        <VersionHistory 
          patches={patches} 
          onRevert={onRevert} 
        />
      </DialogContent>
    </Dialog>
  );
};
