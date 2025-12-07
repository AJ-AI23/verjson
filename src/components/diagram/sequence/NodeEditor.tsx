import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DiagramNode, DiagramNodeType } from '@/types/diagram';
import { Badge } from '@/components/ui/badge';
import { FileJson } from 'lucide-react';
import { EndpointImportDialog } from './EndpointImportDialog';

interface NodeEditorProps {
  node: DiagramNode | null;
  lifelines: Array<{ id: string; name: string }>;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: Partial<DiagramNode>) => void;
  onDelete: (nodeId: string) => void;
  currentWorkspaceId?: string;
}

export const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  lifelines,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  currentWorkspaceId
}) => {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [localNode, setLocalNode] = useState<DiagramNode | null>(node);
  
  // Update local state when dialog opens with new node
  useEffect(() => {
    if (isOpen && node) {
      setLocalNode(node);
    }
  }, [isOpen, node]);

  if (!localNode) return null;

  const handleUpdate = (field: string, value: any) => {
    setLocalNode(prev => {
      if (!prev) return null;
      
      // When changing type to 'endpoint', initialize method and path if not set
      if (field === 'type' && value === 'endpoint') {
        return {
          ...prev,
          [field]: value,
          data: {
            ...prev.data,
            method: prev.data?.method || 'GET',
            path: prev.data?.path || '/api/endpoint'
          }
        };
      }
      
      return { ...prev, [field]: value };
    });
  };

  const handleDataUpdate = (field: string, value: any) => {
    setLocalNode(prev => prev ? {
      ...prev,
      data: { ...prev.data, [field]: value }
    } : null);
  };
  
  const handleClose = () => {
    // Save all changes when closing
    if (localNode && node) {
      const labelChanged = localNode.label !== node.label;
      const typeChanged = localNode.type !== node.type;
      const descriptionChanged = localNode.description !== node.description;
      const dataChanged = JSON.stringify(localNode.data) !== JSON.stringify(node.data);
      const hasChanges = labelChanged || typeChanged || descriptionChanged || dataChanged;
      
      if (hasChanges) {
        onUpdate(localNode.id, {
          label: localNode.label,
          type: localNode.type,
          description: localNode.description,
          data: localNode.data
        });
      }
    }
    onClose();
  };

  const handleImportEndpoint = (endpoint: {
    method: string;
    path: string;
    summary?: string;
    description?: string;
    documentId: string;
  }) => {
    setLocalNode(prev => prev ? {
      ...prev,
      label: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
      data: {
        ...prev.data,
        method: endpoint.method,
        path: endpoint.path,
        description: endpoint.description,
        openApiRef: {
          documentId: endpoint.documentId,
          path: endpoint.path,
          method: endpoint.method
        }
      }
    } : null);
  };

  const handleDelete = () => {
    onDelete(localNode.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Node</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="node-type">Node Type</Label>
            <Select
              value={localNode.type}
              onValueChange={(value) => handleUpdate('type', value as DiagramNodeType)}
            >
              <SelectTrigger id="node-type">
                <SelectValue placeholder="Select node type" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="endpoint">API Endpoint</SelectItem>
                <SelectItem value="process">Process</SelectItem>
                <SelectItem value="decision">Decision</SelectItem>
                <SelectItem value="data">Data Store</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-label">Label</Label>
            <Input
              id="node-label"
              value={localNode.label}
              onChange={(e) => handleUpdate('label', e.target.value)}
              placeholder="Node label"
            />
          </div>

          {localNode.type === 'endpoint' && (
            <>
              <div className="flex items-center justify-between">
                <Label>Endpoint Details</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportDialogOpen(true)}
                  className="gap-2"
                >
                  <FileJson className="h-4 w-4" />
                  Import from OpenAPI
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="node-method">HTTP Method</Label>
                <Select
                  value={localNode.data?.method || 'GET'}
                  onValueChange={(value) => handleDataUpdate('method', value)}
                >
                  <SelectTrigger id="node-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                    <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                    <SelectItem value="HEAD">HEAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="node-path">API Path</Label>
                <Input
                  id="node-path"
                  value={localNode.data?.path || ''}
                  onChange={(e) => handleDataUpdate('path', e.target.value)}
                  placeholder="/api/endpoint"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="node-description">Description</Label>
            <Textarea
              id="node-description"
              value={localNode.description || ''}
              onChange={(e) => handleUpdate('description', e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Connected Lifelines</Label>
            <div className="text-sm text-slate-600 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Source:</span>
                <span>{lifelines.find(l => l.id === localNode.anchors[0].lifelineId)?.name || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Target:</span>
                <span>{lifelines.find(l => l.id === localNode.anchors[1].lifelineId)?.name || 'Unknown'}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Drag the anchor points on the diagram to change lifeline connections</p>
            </div>
          </div>

          {localNode.data?.openApiRef && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-xs font-semibold text-blue-900 mb-1">
                OpenAPI Reference
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                <div>Document: {localNode.data.openApiRef.documentId.slice(0, 8)}...</div>
                <div>
                  <Badge variant="outline" className="text-xs">
                    {localNode.data.openApiRef.method}
                  </Badge>
                  {' '}
                  {localNode.data.openApiRef.path}
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-4">
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="flex-1"
            >
              Delete Node
            </Button>
            <Button
              onClick={handleClose}
              className="flex-1"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>

      <EndpointImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImport={handleImportEndpoint}
        currentWorkspaceId={currentWorkspaceId}
      />
    </Dialog>
  );
};
