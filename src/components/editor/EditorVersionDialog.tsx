
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VersionHistory } from '@/components/VersionHistory';
import { Operation } from 'fast-json-patch';
import { SchemaPatch, Version, VersionTier } from '@/lib/versionUtils';
import { DocumentVersionComparison } from '@/lib/importVersionUtils';
import { useDebug } from '@/contexts/DebugContext';

interface EditorVersionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  documentId: string;
  onToggleSelection: (patchId: string) => Promise<void>;
  onMarkAsReleased: (patchId: string) => Promise<void>;
  onDeleteVersion: (patchId: string) => void;
  onImportVersion?: (importedSchema: any, comparison: DocumentVersionComparison, sourceDocumentName: string) => void;
  currentSchema?: any;
  currentFileType?: string;
  userRole: 'owner' | 'editor' | 'viewer';
  isOwner: boolean;
  // New props for commit functionality
  currentVersion?: Version;
  isModified?: boolean;
  schema?: string;
  patches?: any[];
  onVersionBump?: (newVersion: Version, tier: VersionTier, description: string, isReleased?: boolean, autoVersion?: boolean) => Promise<string | null>;
  suggestedVersion?: Version | null;
}

export const EditorVersionDialog: React.FC<EditorVersionDialogProps> = ({
  isOpen,
  onOpenChange,
  documentId,
  onToggleSelection,
  onMarkAsReleased,
  onDeleteVersion,
  onImportVersion,
  currentSchema,
  currentFileType,
  userRole,
  isOwner,
  currentVersion,
  isModified,
  schema,
  patches,
  onVersionBump,
  suggestedVersion
}) => {
  const { debugToast } = useDebug();

  React.useEffect(() => {
    debugToast('🔍 EditorVersionDialog: Mounted/updated with documentId', documentId);
  }, [debugToast, documentId]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Versions</DialogTitle>
        </DialogHeader>
        <VersionHistory 
          documentId={documentId}
          onToggleSelection={onToggleSelection}
          onMarkAsReleased={onMarkAsReleased}
          onDeleteVersion={onDeleteVersion}
          onImportVersion={onImportVersion}
          currentSchema={currentSchema}
          currentFileType={currentFileType}
          userRole={userRole}
          isOwner={isOwner}
          currentVersion={currentVersion}
          isModified={isModified}
          schema={schema}
          patches={patches}
          onVersionBump={onVersionBump}
          suggestedVersion={suggestedVersion}
        />
      </DialogContent>
    </Dialog>
  );
};
