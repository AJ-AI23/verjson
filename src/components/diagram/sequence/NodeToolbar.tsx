import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NodeToolbarProps {
  position: { x: number; y: number };
  onEdit: () => void;
  onDelete: () => void;
}

export const NodeToolbar: React.FC<NodeToolbarProps> = ({ position, onEdit, onDelete }) => {
  return (
    <div
      className="absolute z-[1100] flex gap-1 p-1 bg-background border border-border rounded-lg shadow-lg animate-scale-in"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -120%)'
      }}
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={onEdit}
        className="h-8 w-8 p-0"
        title="Edit node"
      >
        <Edit2 className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
        title="Delete node"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};
