
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
  onDeleteVersion: (patchId: string) => void;
}

export const EditorVersionDialog: React.FC<EditorVersionDialogProps> = ({
  isOpen,
  onOpenChange,
  patches,
  onToggleSelection,
  onMarkAsReleased,
  onDeleteVersion
}) => {
  console.log('🔍 EditorVersionDialog: Rendering with props:', {
    isOpen,
    patchCount: patches?.length || 0,
    patches: patches?.map(p => ({
      id: p.id,
      description: p.description,
      version: `${p.version.major}.${p.version.minor}.${p.version.patch}`,
      isSelected: p.isSelected,
      isReleased: p.isReleased,
      hasFullDocument: !!p.fullDocument
    })) || 'NO PATCHES'
  });

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
          onDeleteVersion={onDeleteVersion}
        />
      </DialogContent>
    </Dialog>
  );
};
