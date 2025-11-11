import React, { useState, useEffect } from 'react';
import { SketchPicker } from 'react-color';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Lifeline } from '@/types/diagram';

interface LifelineEditorProps {
  lifeline: Lifeline | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (lifelineId: string, updates: Partial<Lifeline>) => void;
  onDelete: (lifelineId: string) => void;
}

export const LifelineEditor: React.FC<LifelineEditorProps> = ({
  lifeline,
  isOpen,
  onClose,
  onUpdate,
  onDelete
}) => {
  const [localLifeline, setLocalLifeline] = useState<Lifeline | null>(lifeline);
  
  // Update local state when dialog opens with new lifeline
  useEffect(() => {
    if (isOpen && lifeline) {
      setLocalLifeline(lifeline);
    }
  }, [isOpen, lifeline]);

  if (!localLifeline) return null;

  const handleUpdate = (field: string, value: any) => {
    setLocalLifeline(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleDone = () => {
    if (localLifeline && lifeline) {
      const hasChanges = 
        localLifeline.name !== lifeline.name ||
        localLifeline.description !== lifeline.description ||
        localLifeline.color !== lifeline.color ||
        localLifeline.anchorColor !== lifeline.anchorColor;
      
      if (hasChanges) {
        onUpdate(localLifeline.id, {
          name: localLifeline.name,
          description: localLifeline.description,
          color: localLifeline.color,
          anchorColor: localLifeline.anchorColor
        });
      }
    }
    onClose();
  };

  const handleDelete = () => {
    if (localLifeline) {
      onDelete(localLifeline.id);
    }
    onClose();
  };

  const ColorInput = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [localValue, setLocalValue] = useState(value);
    
    useEffect(() => {
      if (!isOpen) {
        setLocalValue(value);
      }
    }, [value, isOpen]);
    
    const handleChange = (newValue: string) => {
      setLocalValue(newValue);
    };
    
    const handleClose = () => {
      setIsOpen(false);
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDone()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Lifeline</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lifeline-name">Name</Label>
            <Input
              id="lifeline-name"
              value={localLifeline.name || ''}
              onChange={(e) => handleUpdate('name', e.target.value)}
              placeholder="Lifeline name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lifeline-description">Description (optional)</Label>
            <Textarea
              id="lifeline-description"
              value={localLifeline.description || ''}
              onChange={(e) => handleUpdate('description', e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <ColorInput
            label="Background Color (optional)"
            value={localLifeline.color || '#f8fafc'}
            onChange={(value) => handleUpdate('color', value)}
          />

          <ColorInput
            label="Anchor Color (optional)"
            value={localLifeline.anchorColor || '#3b82f6'}
            onChange={(value) => handleUpdate('anchorColor', value)}
          />

          <div className="flex gap-2 pt-4">
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="flex-1"
            >
              Delete Lifeline
            </Button>
            <Button
              onClick={handleDone}
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
