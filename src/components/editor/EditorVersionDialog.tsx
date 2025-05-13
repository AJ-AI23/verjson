
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VersionHistory } from '@/components/VersionHistory';
import { JsonPatch } from 'fast-json-patch';

interface EditorVersionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  patches: JsonPatch[];
  onRevert: (index: number) => void;
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
