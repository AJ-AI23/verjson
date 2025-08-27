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
import { supabase } from "@/integrations/supabase/client";
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
  const [documentContent, setDocumentContent] = useState<any>(null);

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
    if (!selectedDocVersions.length || !selectedDocumentId) return null;
    
    console.log('🔍 Calculating selected document schema from versions:', selectedDocVersions);
    
    try {
      // Convert versions to patches format for applySelectedPatches
      const patches = selectedDocVersions
        .map(version => ({
          id: version.id,
          timestamp: new Date(version.created_at).getTime(),
          version: {
            major: version.version_major,
            minor: version.version_minor,
            patch: version.version_patch
          },
          description: version.description,
          patches: version.patches ? (typeof version.patches === 'string' ? JSON.parse(version.patches) : version.patches) : undefined,
          tier: version.tier as 'major' | 'minor' | 'patch',
          isReleased: version.is_released,
          fullDocument: version.full_document || undefined,
          isSelected: version.is_selected,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
      
      console.log('🔍 Converted patches for import calculation:', patches);
      
      // Use the applySelectedPatches function to get the current state
      const result = applySelectedPatches(patches);
      
      console.log('🔍 Final calculated import schema:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('Error calculating import schema:', error);
      return {};
    }
  }, [selectedDocVersions, selectedDocumentId]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('workspace');
      setSelectedWorkspaceId('');
      setSelectedDocumentId('');
      setComparison(null);
      setDocumentContent(null);
    }
  }, [isOpen]);

      // Fetch document content directly when a document is selected
  useEffect(() => {
    if (selectedDocumentId) {
      const fetchDocumentContent = async () => {
        try {
          const { data: document, error } = await supabase
            .from('documents')
            .select('content')
            .eq('id', selectedDocumentId)
            .single();
          
          if (error) {
            console.warn('Could not fetch document content:', error);
            setDocumentContent(null);
          } else if (document?.content) {
            // Use the import-specific function to get only released version content
            const { getEffectiveDocumentContentForImport } = await import('@/lib/documentUtils');
            const effectiveContent = await getEffectiveDocumentContentForImport(selectedDocumentId, document.content);
            console.log('🔍 Fetched effective document content for import:', effectiveContent);
            setDocumentContent(effectiveContent);
          }
        } catch (error) {
          console.warn('Error fetching document content:', error);
          setDocumentContent(null);
        }
      };
      
      fetchDocumentContent();
    } else {
      setDocumentContent(null);
    }
  }, [selectedDocumentId]);

  // Use document content if available, otherwise use calculated schema
  const finalImportSchema = useMemo(() => {
    if (documentContent) {
      console.log('🔍 Using direct document content for import');
      return documentContent;
    }
    
    if (selectedDocumentCurrentSchema) {
      console.log('🔍 Using calculated schema from versions for import');
      return selectedDocumentCurrentSchema;
    }
    
    return null;
  }, [documentContent, selectedDocumentCurrentSchema]);

  // Perform comparison when we have both schemas
  useEffect(() => {
    if (currentStep === 'preview' && finalImportSchema && currentSchema) {
      setIsComparing(true);
      console.log('🔍 Import Comparison Debug:');
      console.log('Current Schema:', JSON.stringify(currentSchema, null, 2));
      console.log('Import Schema:', JSON.stringify(finalImportSchema, null, 2));
      
      try {
        const comparisonResult = compareDocumentVersions(currentSchema, finalImportSchema);
        console.log('Comparison Result:', comparisonResult);
        setComparison(comparisonResult);
      } catch (error) {
        console.error('Error comparing versions:', error);
      } finally {
        setIsComparing(false);
      }
    }
  }, [currentStep, finalImportSchema, currentSchema]);

  const handleBack = () => {
    if (currentStep === 'document') {
      setCurrentStep('workspace');
      setSelectedDocumentId('');
    } else if (currentStep === 'preview') {
      setCurrentStep('document');
      setComparison(null);
    }
  };

  const handleWorkspaceSelect = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setSelectedDocumentId('');
    setCurrentStep('document');
  };

  const handleDocumentSelect = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setCurrentStep('preview');
  };

  const handleImportConfirm = () => {
    if (comparison && finalImportSchema) {
      const selectedDoc = compatibleDocuments.find(doc => doc.id === selectedDocumentId);
      onImportConfirm(finalImportSchema, comparison, selectedDoc?.name || 'Unknown Document');
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
                  importSchema={finalImportSchema}
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