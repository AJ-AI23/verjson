import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { DiagramEdge, DiagramEdgeType } from '@/types/diagram';
import { X } from 'lucide-react';

interface EdgeEditorProps {
  edge: DiagramEdge | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (edgeId: string, updates: Partial<DiagramEdge>) => void;
  onDelete: (edgeId: string) => void;
}

export const EdgeEditor: React.FC<EdgeEditorProps> = ({
  edge,
  isOpen,
  onClose,
  onUpdate,
  onDelete
}) => {
  if (!edge) return null;

  const handleUpdate = (field: string, value: any) => {
    onUpdate(edge.id, { [field]: value });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this edge?')) {
      onDelete(edge.id);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Edit Connection</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edge-label">Label</Label>
            <Input
              id="edge-label"
              value={edge.label || ''}
              onChange={(e) => handleUpdate('label', e.target.value)}
              placeholder="Connection label"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edge-type">Connection Type</Label>
            <Select
              value={edge.type || 'default'}
              onValueChange={(value) => handleUpdate('type', value as DiagramEdgeType)}
            >
              <SelectTrigger id="edge-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="sync">Synchronous</SelectItem>
                <SelectItem value="async">Asynchronous</SelectItem>
                <SelectItem value="return">Return/Response</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              {edge.type === 'sync' && 'Solid line for synchronous calls'}
              {edge.type === 'async' && 'Dashed line with animation for async operations'}
              {edge.type === 'return' && 'Dotted line for return flows'}
              {(!edge.type || edge.type === 'default') && 'Standard connection line'}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="edge-animated">Animated</Label>
            <Switch
              id="edge-animated"
              checked={edge.animated || false}
              onCheckedChange={(checked) => handleUpdate('animated', checked)}
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs font-semibold text-slate-900 mb-2">Connection Info</div>
            <div className="text-xs text-slate-600 space-y-1">
              <div>Source: {edge.source}</div>
              <div>Target: {edge.target}</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
