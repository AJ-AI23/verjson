import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useDocuments } from '@/hooks/useDocuments';
import { getMethodColor } from '@/lib/diagram/sequenceNodeTypes';
import { FileJson, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EndpointImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (endpoint: {
    method: string;
    path: string;
    summary?: string;
    description?: string;
    documentId: string;
  }) => void;
  currentWorkspaceId?: string;
}

interface EndpointInfo {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  documentId: string;
  documentName: string;
}

export const EndpointImportDialog: React.FC<EndpointImportDialogProps> = ({
  isOpen,
  onClose,
  onImport,
  currentWorkspaceId
}) => {
  const { documents } = useDocuments(currentWorkspaceId);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [documentContent, setDocumentContent] = useState<any>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Filter OpenAPI documents
  const openApiDocuments = useMemo(() => {
    const filtered = documents?.filter(doc => doc.file_type === 'openapi') || [];
    console.log('[EndpointImport] Total documents:', documents?.length);
    console.log('[EndpointImport] OpenAPI documents:', filtered.length);
    return filtered;
  }, [documents]);

  // Fetch document content when a document is selected
  useEffect(() => {
    const fetchDocumentContent = async () => {
      if (!selectedDocumentId) {
        setDocumentContent(null);
        return;
      }

      setLoadingContent(true);
      try {
        const { data, error } = await supabase.functions.invoke('document-content', {
          body: { action: 'fetchDocumentWithContent', document_id: selectedDocumentId }
        });

        if (error) {
          console.error('[EndpointImport] Error fetching document:', error);
          setDocumentContent(null);
        } else {
          console.log('[EndpointImport] Fetched document with versions:', data.document);
          setDocumentContent(data.document?.content);
        }
      } catch (err) {
        console.error('[EndpointImport] Error:', err);
        setDocumentContent(null);
      } finally {
        setLoadingContent(false);
      }
    };

    fetchDocumentContent();
  }, [selectedDocumentId]);

  // Extract endpoints from selected document
  const endpoints = useMemo(() => {
    if (!selectedDocumentId || !documentContent) {
      console.log('[EndpointImport] No content yet');
      return [];
    }

    console.log('[EndpointImport] Document content type:', typeof documentContent);

    // Handle both parsed JSON objects and JSON strings
    let content = documentContent;
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch (e) {
        console.error('[EndpointImport] Failed to parse document content:', e);
        return [];
      }
    }

    const extractedEndpoints: EndpointInfo[] = [];
    const paths = content.paths || {};

    console.log('[EndpointImport] Paths found:', Object.keys(paths).length);

    Object.entries(paths).forEach(([path, pathItem]: [string, any]) => {
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
      
      methods.forEach(method => {
        if (pathItem[method]) {
          const operation = pathItem[method];
          extractedEndpoints.push({
            path,
            method: method.toUpperCase(),
            summary: operation.summary,
            description: operation.description,
            documentId: selectedDocumentId,
            documentName: openApiDocuments.find(d => d.id === selectedDocumentId)?.name || ''
          });
        }
      });
    });

    console.log('[EndpointImport] Extracted endpoints:', extractedEndpoints.length);
    return extractedEndpoints;
  }, [selectedDocumentId, documentContent, openApiDocuments]);

  // Filter endpoints based on search
  const filteredEndpoints = useMemo(() => {
    if (!searchQuery) return endpoints;
    
    const query = searchQuery.toLowerCase();
    return endpoints.filter(endpoint => 
      endpoint.path.toLowerCase().includes(query) ||
      endpoint.method.toLowerCase().includes(query) ||
      endpoint.summary?.toLowerCase().includes(query) ||
      endpoint.description?.toLowerCase().includes(query)
    );
  }, [endpoints, searchQuery]);

  const handleImport = (endpoint: EndpointInfo) => {
    onImport({
      method: endpoint.method,
      path: endpoint.path,
      summary: endpoint.summary,
      description: endpoint.description || endpoint.summary,
      documentId: endpoint.documentId
    });
    setSearchQuery('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Import Endpoint from OpenAPI
          </DialogTitle>
          <DialogDescription>
            Select an OpenAPI document and choose an endpoint to populate the node fields
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Selection */}
          <div className="space-y-2">
            <Label>OpenAPI Document</Label>
            {openApiDocuments.length === 0 ? (
              <div className="text-sm text-slate-500 p-4 border border-dashed rounded-md text-center">
                <FileJson className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                No OpenAPI documents found in this workspace
              </div>
            ) : (
              <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an OpenAPI document" />
                </SelectTrigger>
                <SelectContent>
                  {openApiDocuments.map(doc => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedDocumentId && (
            <>
              {loadingContent ? (
                <div className="text-sm text-slate-500 p-4 text-center">
                  Loading endpoints...
                </div>
              ) : (
                <>
                  {/* Search */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search endpoints..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Endpoints List */}
              <div className="space-y-2">
                <Label>Select Endpoint ({filteredEndpoints.length})</Label>

                <ScrollArea className="h-[400px] border rounded-md">
                  <div className="p-4 space-y-2">
                    {filteredEndpoints.length === 0 ? (
                      <div className="text-sm text-slate-500 text-center py-8">
                        No endpoints found
                      </div>
                    ) : (
                      filteredEndpoints.map((endpoint) => {
                        const key = `${endpoint.method}:${endpoint.path}`;

                        return (
                          <div
                            key={key}
                            className="flex items-start gap-3 p-3 border rounded-md hover:bg-slate-50 cursor-pointer transition-colors"
                            onClick={() => handleImport(endpoint)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={getMethodColor(endpoint.method)}>
                                  {endpoint.method}
                                </Badge>
                                <code className="text-xs font-mono text-slate-600 truncate">
                                  {endpoint.path}
                                </code>
                              </div>
                              {endpoint.summary && (
                                <div className="text-sm text-slate-700 line-clamp-1">
                                  {endpoint.summary}
                                </div>
                              )}
                              {endpoint.description && (
                                <div className="text-xs text-slate-500 line-clamp-2 mt-1">
                                  {endpoint.description}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
