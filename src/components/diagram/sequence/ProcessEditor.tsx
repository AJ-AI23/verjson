import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ProcessNode } from '@/types/diagram';

interface ProcessEditorProps {
  process: ProcessNode | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (processId: string, updates: Partial<ProcessNode>) => void;
  onDelete: (processId: string) => void;
}

export const ProcessEditor: React.FC<ProcessEditorProps> = ({
  process,
  isOpen,
  onClose,
  onUpdate,
  onDelete
}) => {
  if (!process) return null;

  const handleUpdate = (field: string, value: any) => {
    console.log('🔄 [ProcessEditor] Updating process:', { processId: process.id, field, value });
    onUpdate(process.id, { [field]: value });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this process?')) {
      onDelete(process.id);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Process</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="process-description">Description</Label>
            <Input
              id="process-description"
              value={process.description || ''}
              onChange={(e) => handleUpdate('description', e.target.value)}
              placeholder="Process description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="process-color">Color (optional)</Label>
            <Input
              id="process-color"
              type="color"
              value={process.color || '#94a3b8'}
              onChange={(e) => handleUpdate('color', e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="flex-1"
            >
              Delete Process
            </Button>
            <Button
              onClick={onClose}
              className="flex-1"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
