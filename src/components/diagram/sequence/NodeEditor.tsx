import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DiagramNode, DiagramNodeType } from '@/types/diagram';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface NodeEditorProps {
  node: DiagramNode | null;
  lifelines: Array<{ id: string; name: string }>;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: Partial<DiagramNode>) => void;
  onDelete: (nodeId: string) => void;
}

export const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  lifelines,
  isOpen,
  onClose,
  onUpdate,
  onDelete
}) => {
  if (!node) return null;

  const handleUpdate = (field: string, value: any) => {
    onUpdate(node.id, { [field]: value });
  };

  const handleDataUpdate = (field: string, value: any) => {
    onUpdate(node.id, {
      data: { ...node.data, [field]: value }
    });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this node?')) {
      onDelete(node.id);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Node</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="node-type">Node Type</Label>
            <Select
              value={node.type}
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
              value={node.label}
              onChange={(e) => handleUpdate('label', e.target.value)}
              placeholder="Node label"
            />
          </div>

          {node.type === 'endpoint' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="node-method">HTTP Method</Label>
                <Select
                  value={node.data?.method || 'GET'}
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
                  value={node.data?.path || ''}
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
              value={node.data?.description || ''}
              onChange={(e) => handleDataUpdate('description', e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Connected Lifelines</Label>
            <div className="text-sm text-slate-600 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Source:</span>
                <span>{lifelines.find(l => l.id === node.anchors[0].lifelineId)?.name || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Target:</span>
                <span>{lifelines.find(l => l.id === node.anchors[1].lifelineId)?.name || 'Unknown'}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Drag the anchor points on the diagram to change lifeline connections</p>
            </div>
          </div>

          {node.data?.openApiRef && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-xs font-semibold text-blue-900 mb-1">
                OpenAPI Reference
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                <div>Document: {node.data.openApiRef.documentId.slice(0, 8)}...</div>
                <div>
                  <Badge variant="outline" className="text-xs">
                    {node.data.openApiRef.method}
                  </Badge>
                  {' '}
                  {node.data.openApiRef.path}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
