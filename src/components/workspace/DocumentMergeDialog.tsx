import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentMergePreview } from "./DocumentMergePreview";
import { DocumentMergeEngine, DocumentMergeResult } from "@/lib/documentMergeEngine";
import { getEffectiveDocumentContentForImport } from "@/lib/documentUtils";
import { Document } from "@/types/workspace";
import { ArrowLeft, FileText, Loader2, GitMerge, AlertTriangle } from "lucide-react";

interface DocumentMergeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  documents: Document[];
  onMergeConfirm: (mergedDocument: any, resultName: string) => void;
  workspaceName?: string;
}

type DialogStep = 'selection' | 'preview' | 'finalize';

export const DocumentMergeDialog: React.FC<DocumentMergeDialogProps> = ({
  isOpen,
  onOpenChange,
  documents,
  onMergeConfirm,
  workspaceName
}) => {
  const [currentStep, setCurrentStep] = useState<DialogStep>('selection');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [resultName, setResultName] = useState('');
  const [mergeResult, setMergeResult] = useState<DocumentMergeResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [effectiveDocuments, setEffectiveDocuments] = useState<Document[]>([]);

  // Group documents by file type for easier selection
  const documentsByType = useMemo(() => {
    const groups: { [key: string]: Document[] } = {};
    documents.forEach(doc => {
      if (!groups[doc.file_type]) {
        groups[doc.file_type] = [];
      }
      groups[doc.file_type].push(doc);
    });
    return groups;
  }, [documents]);

  // Get selected document objects with effective content
  const selectedDocumentObjects = useMemo(() => {
    return effectiveDocuments.filter(doc => selectedDocuments.includes(doc.id));
  }, [effectiveDocuments, selectedDocuments]);

  // Check compatibility when documents are selected
  const compatibilityCheck = useMemo(() => {
    if (selectedDocumentObjects.length < 2) {
      return null;
    }
    return DocumentMergeEngine.checkCompatibility(selectedDocumentObjects);
  }, [selectedDocumentObjects]);

  // Fetch effective content for all documents when dialog opens
  useEffect(() => {
    if (isOpen && documents.length > 0) {
      const fetchEffectiveContent = async () => {
        try {
          setIsAnalyzing(true);
          const documentsWithEffectiveContent = await Promise.all(
            documents.map(async (doc) => {
              const effectiveContent = await getEffectiveDocumentContentForImport(doc.id, doc.content);
              return {
                ...doc,
                content: effectiveContent
              };
            })
          );
          setEffectiveDocuments(documentsWithEffectiveContent);
        } catch (error) {
          console.error('Error fetching effective document content:', error);
          // Fallback to original documents if fetching fails
          setEffectiveDocuments(documents);
        } finally {
          setIsAnalyzing(false);
        }
      };

      fetchEffectiveContent();
    } else if (!isOpen) {
      setEffectiveDocuments([]);
    }
  }, [isOpen, documents]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('selection');
      setSelectedDocuments([]);
      setResultName('');
      setMergeResult(null);
    } else {
      // Generate default name when dialog opens
      const defaultName = `Merged_${workspaceName || 'Schema'}_${new Date().toISOString().split('T')[0]}`;
      setResultName(defaultName);
    }
  }, [isOpen, workspaceName]);

  // Perform merge analysis when moving to preview step
  useEffect(() => {
    if (currentStep === 'preview' && selectedDocumentObjects.length >= 2 && resultName && !isAnalyzing) {
      setIsAnalyzing(true);
      
      // Use setTimeout to allow UI to update before heavy computation
      setTimeout(() => {
        try {
          console.log('🔍 Merge Analysis Debug:');
          console.log('Selected Documents:', selectedDocumentObjects.map(d => ({ id: d.id, name: d.name })));
          console.log('Effective Content Preview:', selectedDocumentObjects.map(d => ({ 
            name: d.name, 
            content: typeof d.content === 'object' ? Object.keys(d.content).join(', ') : 'invalid'
          })));
          
          const result = DocumentMergeEngine.mergeDocuments(selectedDocumentObjects, resultName);
          console.log('Merge Result:', result);
          setMergeResult(result);
        } catch (error) {
          console.error('Error analyzing merge:', error);
          setMergeResult({
            mergedSchema: {},
            conflicts: [{
              path: '/',
              type: 'incompatible_schema',
              severity: 'high',
              description: 'Failed to analyze documents for merging',
              documents: selectedDocumentObjects.map(d => d.name),
              values: []
            }],
            isCompatible: false,
            warnings: ['Analysis failed'],
            summary: { addedProperties: 0, mergedComponents: 0, totalConflicts: 1 }
          });
        } finally {
          setIsAnalyzing(false);
        }
      }, 100);
    }
  }, [currentStep, selectedDocumentObjects, resultName, isAnalyzing]);

  const handleDocumentSelect = (documentId: string, checked: boolean) => {
    setSelectedDocuments(prev => {
      if (checked) {
        return [...prev, documentId];
      } else {
        return prev.filter(id => id !== documentId);
      }
    });
  };

  const handleSelectAllInType = (fileType: string, checked: boolean) => {
    const docsInType = documentsByType[fileType].map(doc => doc.id);
    
    setSelectedDocuments(prev => {
      if (checked) {
        // Add all documents of this type that aren't already selected
        const newSelections = docsInType.filter(id => !prev.includes(id));
        return [...prev, ...newSelections];
      } else {
        // Remove all documents of this type
        return prev.filter(id => !docsInType.includes(id));
      }
    });
  };

  // Use effective documents for UI display but original documents for grouping
  const displayDocumentsByType = useMemo(() => {
    const groups: { [key: string]: Document[] } = {};
    const docsToDisplay = effectiveDocuments.length > 0 ? effectiveDocuments : documents;
    
    docsToDisplay.forEach(doc => {
      if (!groups[doc.file_type]) {
        groups[doc.file_type] = [];
      }
      groups[doc.file_type].push(doc);
    });
    return groups;
  }, [effectiveDocuments, documents]);

  const handleNext = () => {
    if (currentStep === 'selection') {
      setCurrentStep('preview');
    } else if (currentStep === 'preview') {
      setCurrentStep('finalize');
    }
  };

  const handleBack = () => {
    if (currentStep === 'preview') {
      setCurrentStep('selection');
      setMergeResult(null);
    } else if (currentStep === 'finalize') {
      setCurrentStep('preview');
    }
  };

  const handleMergeConfirm = () => {
    if (mergeResult?.isCompatible && mergeResult.mergedSchema) {
      onMergeConfirm(mergeResult.mergedSchema, resultName);
      onOpenChange(false);
    }
  };

  const canProceed = selectedDocuments.length >= 2 && compatibilityCheck?.isCompatible;
  const allSelectedSameType = selectedDocumentObjects.length > 0 && 
    new Set(selectedDocumentObjects.map(doc => doc.file_type)).size === 1;

  // Show loading state while fetching effective content
  const isLoadingContent = isOpen && documents.length > 0 && effectiveDocuments.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentStep !== 'selection' && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <GitMerge className="h-4 w-4" />
            Merge Documents
            {currentStep === 'selection' && (
              <Badge variant="outline">
                {selectedDocuments.length} selected
              </Badge>
            )}
            {currentStep === 'preview' && mergeResult && (
              <Badge variant={mergeResult.isCompatible ? "default" : "destructive"}>
                {mergeResult.isCompatible ? 'Compatible' : 'Incompatible'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {currentStep === 'selection' && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Select at least 2 documents to merge. Only documents of the same type can be merged together.
                {isLoadingContent && (
                  <span className="block mt-2 text-blue-600">
                    Loading latest released versions...
                  </span>
                )}
              </div>

              {!allSelectedSameType && selectedDocuments.length > 1 && (
                <Alert className="border-orange-500">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Selected documents must all be of the same type (JSON Schema or OpenAPI).
                  </AlertDescription>
                </Alert>
              )}

              {compatibilityCheck && !compatibilityCheck.isCompatible && (
                <Alert className="border-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium">Documents Cannot Be Merged</div>
                    <div className="text-sm mt-1">{compatibilityCheck.reason}</div>
                  </AlertDescription>
                </Alert>
              )}

              {isLoadingContent ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading document versions...</span>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {Object.entries(displayDocumentsByType).map(([fileType, docs]) => {
                    const selectedInType = docs.filter(doc => selectedDocuments.includes(doc.id)).length;
                    const allSelectedInType = selectedInType === docs.length;
                    const someSelectedInType = selectedInType > 0 && selectedInType < docs.length;

                    return (
                      <Card key={fileType}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Checkbox
                              checked={allSelectedInType}
                              onCheckedChange={(checked) => handleSelectAllInType(fileType, !!checked)}
                            />
                            <Badge variant="outline" className="text-xs">
                              {fileType}
                            </Badge>
                            <span className="text-sm font-normal text-muted-foreground">
                              ({docs.length} documents, {selectedInType} selected)
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            {docs.map(doc => (
                              <div key={doc.id} className="flex items-center space-x-2 p-2 rounded border">
                                <Checkbox
                                  checked={selectedDocuments.includes(doc.id)}
                                  onCheckedChange={(checked) => handleDocumentSelect(doc.id, !!checked)}
                                />
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{doc.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Updated {new Date(doc.updated_at).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {currentStep === 'preview' && (
            <div className="space-y-4">
              {isAnalyzing ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Analyzing documents for merge compatibility...</span>
                </div>
              ) : mergeResult ? (
                <DocumentMergePreview
                  documents={selectedDocumentObjects}
                  mergeResult={mergeResult}
                  resultName={resultName}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Unable to analyze documents for merging
                </div>
              )}
            </div>
          )}

          {currentStep === 'finalize' && mergeResult && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Confirm the merge settings and provide a name for the new document.
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Merge Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div><strong>Documents to merge:</strong> {selectedDocumentObjects.length}</div>
                    <div><strong>Total conflicts:</strong> {mergeResult.conflicts.length}</div>
                    <div><strong>Properties/Components:</strong> {mergeResult.summary.addedProperties + mergeResult.summary.mergedComponents}</div>
                  </div>
                  
                  <div className="mt-3">
                    <div className="text-sm font-medium mb-2">Source Documents:</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedDocumentObjects.map(doc => (
                        <Badge key={doc.id} variant="outline" className="text-xs">
                          {doc.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label htmlFor="result-name">Merged Document Name</Label>
                <Input
                  id="result-name"
                  value={resultName}
                  onChange={(e) => setResultName(e.target.value)}
                  placeholder="Enter name for merged document"
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {currentStep === 'selection' && `${selectedDocuments.length} of ${documents.length} documents selected`}
            {currentStep === 'preview' && mergeResult && `${mergeResult.conflicts.length} conflicts detected`}
            {currentStep === 'finalize' && 'Ready to create merged document'}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            
            {currentStep === 'selection' && (
              <Button onClick={handleNext} disabled={!canProceed || isLoadingContent}>
                Preview Merge
              </Button>
            )}
            
            {currentStep === 'preview' && mergeResult?.isCompatible && !isAnalyzing && (
              <Button onClick={handleNext}>
                Configure Merge
              </Button>
            )}
            
            {currentStep === 'finalize' && (
              <Button 
                onClick={handleMergeConfirm} 
                disabled={!resultName.trim() || !mergeResult?.isCompatible}
              >
                Create Merged Document
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};