import React, { useState } from 'react';
import { SketchPicker } from 'react-color';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
    onUpdate(process.id, { [field]: value });
  };

  const handleDelete = () => {
    onDelete(process.id);
    onClose();
  };

  const ColorInput = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [localValue, setLocalValue] = useState(value);
    
    // Update local value when prop changes (but not during picking)
    React.useEffect(() => {
      if (!isOpen) {
        setLocalValue(value);
      }
    }, [value, isOpen]);
    
    const handleChange = (newValue: string) => {
      setLocalValue(newValue);
    };
    
    const handleClose = () => {
      setIsOpen(false);
      // Only update parent when closing
      if (localValue !== value) {
        onChange(localValue);
      }
    };
    
    return (
      <div className="space-y-2">
        <Label className="text-sm">{label}</Label>
        <div className="flex gap-2">
          <Popover open={isOpen} onOpenChange={(open) => {
            if (open) {
              setIsOpen(true);
            } else {
              handleClose();
            }
          }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-16 h-10 p-1 cursor-pointer"
                style={{ backgroundColor: localValue }}
              >
                <span className="sr-only">Pick color</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-0" align="start">
              <SketchPicker 
                color={localValue} 
                onChange={(color) => handleChange(color.hex)}
                disableAlpha
              />
            </PopoverContent>
          </Popover>
          <Input
            type="text"
            value={localValue}
            onChange={(e) => {
              setLocalValue(e.target.value);
              onChange(e.target.value);
            }}
            className="flex-1 font-mono text-xs"
          />
        </div>
      </div>
    );
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

          <ColorInput
            label="Color (optional)"
            value={process.color || '#94a3b8'}
            onChange={(value) => handleUpdate('color', value)}
          />

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
