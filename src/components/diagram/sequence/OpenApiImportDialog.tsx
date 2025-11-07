import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useDocuments } from '@/hooks/useDocuments';
import { DiagramNode, Lifeline } from '@/types/diagram';
import { getMethodColor } from '@/lib/diagram/sequenceNodeTypes';
import { FileJson, Search, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface OpenApiImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (nodes: DiagramNode[]) => void;
  lifelines: Lifeline[];
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

export const OpenApiImportDialog: React.FC<OpenApiImportDialogProps> = ({
  isOpen,
  onClose,
  onImport,
  lifelines,
  currentWorkspaceId
}) => {
  const { documents } = useDocuments(currentWorkspaceId);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(new Set());
  const [targetLifelineId, setTargetLifelineId] = useState<string>(lifelines[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter OpenAPI documents
  const openApiDocuments = useMemo(() => {
    return documents?.filter(doc => doc.file_type === 'openapi') || [];
  }, [documents]);

  // Extract endpoints from selected document
  const endpoints = useMemo(() => {
    if (!selectedDocumentId) return [];

    const document = openApiDocuments.find(doc => doc.id === selectedDocumentId);
    if (!document || !document.content) return [];

    const extractedEndpoints: EndpointInfo[] = [];
    const paths = document.content.paths || {};

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
            documentId: document.id,
            documentName: document.name
          });
        }
      });
    });

    return extractedEndpoints;
  }, [selectedDocumentId, openApiDocuments]);

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

  const handleToggleEndpoint = (path: string, method: string) => {
    const key = `${method}:${path}`;
    const newSelection = new Set(selectedEndpoints);
    
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    
    setSelectedEndpoints(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedEndpoints.size === filteredEndpoints.length) {
      setSelectedEndpoints(new Set());
    } else {
      const allKeys = filteredEndpoints.map(ep => `${ep.method}:${ep.path}`);
      setSelectedEndpoints(new Set(allKeys));
    }
  };

  const handleImport = () => {
    if (selectedEndpoints.size === 0 || !targetLifelineId) return;

    const nodesToImport: DiagramNode[] = [];
    const sourceLifelineId = targetLifelineId;
    const targetLifelineNextId = lifelines.length > 1 
      ? lifelines.find(l => l.id !== targetLifelineId)?.id || targetLifelineId
      : targetLifelineId;
    
    endpoints.forEach(endpoint => {
      const key = `${endpoint.method}:${endpoint.path}`;
      if (selectedEndpoints.has(key)) {
        const nodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const sourceAnchorId = `anchor-${nodeId}-source`;
        const targetAnchorId = `anchor-${nodeId}-target`;
        
        const yPos = 100;
        
        const node: DiagramNode = {
          id: nodeId,
          type: 'endpoint',
          label: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
          anchors: [
            { id: sourceAnchorId, lifelineId: sourceLifelineId, yPosition: yPos, anchorType: 'source' },
            { id: targetAnchorId, lifelineId: targetLifelineNextId, yPosition: yPos, anchorType: 'target' }
          ],
          data: {
            method: endpoint.method,
            path: endpoint.path,
            description: endpoint.description || endpoint.summary,
            openApiRef: {
              documentId: endpoint.documentId,
              path: endpoint.path,
              method: endpoint.method
            }
          }
        };
        nodesToImport.push(node);
      }
    });

    onImport(nodesToImport);
    setSelectedEndpoints(new Set());
    setSearchQuery('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import from OpenAPI
          </DialogTitle>
          <DialogDescription>
            Select an OpenAPI document and choose endpoints to import as diagram nodes
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
              {/* Target Position */}
              <div className="space-y-2">
                <Label>Target Lifeline</Label>
                <Select value={targetLifelineId} onValueChange={setTargetLifelineId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lifelines.map(lifeline => (
                      <SelectItem key={lifeline.id} value={lifeline.id}>
                        {lifeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                <div className="flex items-center justify-between">
                  <Label>Endpoints ({filteredEndpoints.length})</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedEndpoints.size === filteredEndpoints.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                <ScrollArea className="h-[300px] border rounded-md">
                  <div className="p-4 space-y-2">
                    {filteredEndpoints.length === 0 ? (
                      <div className="text-sm text-slate-500 text-center py-8">
                        No endpoints found
                      </div>
                    ) : (
                      filteredEndpoints.map((endpoint) => {
                        const key = `${endpoint.method}:${endpoint.path}`;
                        const isSelected = selectedEndpoints.has(key);

                        return (
                          <div
                            key={key}
                            className="flex items-start gap-3 p-3 border rounded-md hover:bg-slate-50 cursor-pointer"
                            onClick={() => handleToggleEndpoint(endpoint.path, endpoint.method)}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleEndpoint(endpoint.path, endpoint.method)}
                              className="mt-1"
                            />
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
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-slate-600">
            {selectedEndpoints.size} endpoint{selectedEndpoints.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={selectedEndpoints.size === 0 || !targetLifelineId}
            >
              Import {selectedEndpoints.size > 0 && `(${selectedEndpoints.size})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
