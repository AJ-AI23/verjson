import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ImportVersionConflictPreview } from "./ImportVersionConflictPreview";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useDocuments } from "@/hooks/useDocuments";
import { useDocumentVersions } from "@/hooks/useDocumentVersions";
import { compareDocumentVersions, DocumentVersionComparison } from "@/lib/importVersionUtils";
import { applySelectedPatches } from "@/lib/versionUtils";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";

interface ImportVersionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentSchema: any;
  onImportConfirm: (
    importedSchema: any, 
    comparison: DocumentVersionComparison, 
    sourceDocumentName: string
  ) => void;
  currentDocumentId: string;
  currentFileType: string;
}

type DialogStep = 'workspace' | 'document' | 'preview';

export const ImportVersionDialog: React.FC<ImportVersionDialogProps> = ({
  isOpen,
  onOpenChange,
  currentSchema,
  onImportConfirm,
  currentDocumentId,
  currentFileType
}) => {
  const [currentStep, setCurrentStep] = useState<DialogStep>('workspace');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [comparison, setComparison] = useState<DocumentVersionComparison | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const { workspaces, loading: workspacesLoading } = useWorkspaces();
  const { documents, loading: documentsLoading } = useDocuments(selectedWorkspaceId);
  const { versions: selectedDocVersions } = useDocumentVersions(selectedDocumentId);

  // Filter documents to show only compatible ones (same file type, not current document)
  const compatibleDocuments = useMemo(() => {
    return documents.filter(doc => 
      doc.file_type === currentFileType && 
      doc.id !== currentDocumentId
    );
  }, [documents, currentFileType, currentDocumentId]);

  // Calculate the current schema of the selected document based on its selected patches
  const selectedDocumentCurrentSchema = useMemo(() => {
    if (!selectedDocVersions.length) return null;
    
    console.log('🔍 Calculating selected document schema from versions:', selectedDocVersions);
    
    // Find the latest released version with full_document (this is our base)
    const releasedVersions = selectedDocVersions
      .filter(version => version.is_released && version.full_document)
      .sort((a, b) => {
        // Sort by version numbers (major.minor.patch)
        if (a.version_major !== b.version_major) return b.version_major - a.version_major;
        if (a.version_minor !== b.version_minor) return b.version_minor - a.version_minor;
        return b.version_patch - a.version_patch;
      });
    
    let baseSchema: any = null;
    let baseVersionTimestamp = 0;
    
    if (releasedVersions.length > 0) {
      // Use the latest released version as base
      baseSchema = releasedVersions[0].full_document;
      baseVersionTimestamp = new Date(releasedVersions[0].created_at).getTime();
      console.log('🔍 Using released version as base:', releasedVersions[0]);
    } else {
      // No released versions, find the earliest full_document or fall back to empty schema
      const fullDocVersions = selectedDocVersions
        .filter(version => version.full_document)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      if (fullDocVersions.length > 0) {
        baseSchema = fullDocVersions[0].full_document;
        baseVersionTimestamp = new Date(fullDocVersions[0].created_at).getTime();
        console.log('🔍 Using earliest full document as base:', fullDocVersions[0]);
      } else {
        baseSchema = {};
        console.log('🔍 No full document found, using empty schema as base');
      }
    }
    
    // Get all selected patches that came after the base version
    const patchesToApply = selectedDocVersions
      .filter(version => 
        version.is_selected && 
        version.patches && 
        version.patches.length > 0 &&
        new Date(version.created_at).getTime() > baseVersionTimestamp
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) // Apply in chronological order
      .map(version => ({
        id: version.id,
        version: {
          major: version.version_major,
          minor: version.version_minor,
          patch: version.version_patch
        },
        description: version.description,
        patches: version.patches || [],
        timestamp: new Date(version.created_at).getTime(),
        isSelected: version.is_selected,
        isReleased: version.is_released,
        fullDocument: version.full_document,
        tier: version.tier as 'major' | 'minor' | 'patch'
      }));
    
    console.log('🔍 Base schema:', JSON.stringify(baseSchema, null, 2));
    console.log('🔍 Patches to apply after base:', patchesToApply);
    
    // Apply the patches to the base schema
    let result = baseSchema;
    if (patchesToApply.length > 0) {
      // Create a full patches array that includes the base version if needed
      const allPatches = [...patchesToApply];
      
      // If we have a base schema but no released version in the patches, 
      // we need to create a synthetic base patch
      if (Object.keys(baseSchema).length > 0 && !patchesToApply.some(p => p.isReleased)) {
        const basePatch = {
          id: 'base-' + Date.now(),
          version: { major: 0, minor: 0, patch: 0 },
          description: 'Base version',
          patches: [],
          timestamp: baseVersionTimestamp,
          isSelected: true,
          isReleased: true,
          fullDocument: baseSchema,
          tier: 'major' as const
        };
        allPatches.unshift(basePatch);
      }
      
      result = applySelectedPatches(allPatches);
    }
    
    console.log('🔍 Final calculated import schema:', JSON.stringify(result, null, 2));
    
    return result;
  }, [selectedDocVersions]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('workspace');
      setSelectedWorkspaceId('');
      setSelectedDocumentId('');
      setComparison(null);
    }
  }, [isOpen]);

  // Perform comparison when we have both schemas
  useEffect(() => {
    if (currentStep === 'preview' && selectedDocumentCurrentSchema && currentSchema) {
      setIsComparing(true);
      console.log('🔍 Import Comparison Debug:');
      console.log('Current Schema:', JSON.stringify(currentSchema, null, 2));
      console.log('Import Schema:', JSON.stringify(selectedDocumentCurrentSchema, null, 2));
      
      try {
        const comparisonResult = compareDocumentVersions(currentSchema, selectedDocumentCurrentSchema);
        console.log('Comparison Result:', comparisonResult);
        setComparison(comparisonResult);
      } catch (error) {
        console.error('Error comparing versions:', error);
      } finally {
        setIsComparing(false);
      }
    }
  }, [currentStep, selectedDocumentCurrentSchema, currentSchema]);

  const handleWorkspaceSelect = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setSelectedDocumentId('');
    setCurrentStep('document');
  };

  const handleDocumentSelect = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setCurrentStep('preview');
  };

  const handleBack = () => {
    if (currentStep === 'document') {
      setCurrentStep('workspace');
      setSelectedDocumentId('');
    } else if (currentStep === 'preview') {
      setCurrentStep('document');
      setComparison(null);
    }
  };

  const handleImportConfirm = () => {
    if (comparison && selectedDocumentCurrentSchema) {
      const selectedDoc = compatibleDocuments.find(doc => doc.id === selectedDocumentId);
      onImportConfirm(selectedDocumentCurrentSchema, comparison, selectedDoc?.name || 'Unknown Document');
      onOpenChange(false);
    }
  };

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);
  const selectedDocument = compatibleDocuments.find(d => d.id === selectedDocumentId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentStep !== 'workspace' && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            Import Version
            {currentStep === 'document' && selectedWorkspace && (
              <Badge variant="outline">from {selectedWorkspace.name}</Badge>
            )}
            {currentStep === 'preview' && selectedDocument && (
              <Badge variant="outline">from {selectedDocument.name}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {currentStep === 'workspace' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a workspace to import a document version from:
              </p>
              
              {workspacesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {workspaces.map(workspace => (
                    <div
                      key={workspace.id}
                      onClick={() => handleWorkspaceSelect(workspace.id)}
                      className="p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="font-medium">{workspace.name}</div>
                      {workspace.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {workspace.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 'document' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a document to import from <strong>{selectedWorkspace?.name}</strong>:
              </p>
              
              {documentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : compatibleDocuments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No compatible documents found in this workspace</p>
                  <p className="text-xs mt-1">Only {currentFileType} documents can be imported</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {compatibleDocuments.map(document => (
                    <div
                      key={document.id}
                      onClick={() => handleDocumentSelect(document.id)}
                      className="p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{document.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Updated {new Date(document.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {document.file_type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 'preview' && (
            <div className="space-y-4">
              {isComparing ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Analyzing differences...</span>
                </div>
              ) : comparison ? (
                <ImportVersionConflictPreview
                  currentSchema={currentSchema}
                  importSchema={selectedDocumentCurrentSchema}
                  comparison={comparison}
                  sourceDocumentName={selectedDocument?.name || 'Unknown Document'}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Unable to compare documents
                </div>
              )}
            </div>
          )}
        </div>

        {currentStep === 'preview' && comparison && !isComparing && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportConfirm}>
              Import Version ({comparison.recommendedVersionTier})
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};