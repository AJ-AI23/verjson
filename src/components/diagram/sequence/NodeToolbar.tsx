import React from 'react';
import { Edit2, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type EntityType = 'node' | 'lifeline' | 'process' | 'mixed';

interface NodeToolbarProps {
  position: { x: number; y: number };
  selectedCount: number;
  entityType?: EntityType;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  canDuplicate?: boolean; // Explicitly control duplicate button visibility
  duplicateDisabledReason?: string; // Tooltip when duplicate is disabled
}

export const NodeToolbar: React.FC<NodeToolbarProps> = ({ 
  position, 
  selectedCount,
  entityType = 'node',
  onEdit, 
  onDelete,
  onDuplicate,
  canDuplicate = true,
  duplicateDisabledReason
}) => {
  const getEntityLabel = () => {
    if (selectedCount === 1) {
      switch (entityType) {
        case 'lifeline': return 'lifeline';
        case 'process': return 'process';
        case 'node': return 'node';
        default: return 'item';
      }
    }
    
    switch (entityType) {
      case 'lifeline': return 'lifelines';
      case 'process': return 'processes';
      case 'node': return 'nodes';
      case 'mixed': return 'items';
      default: return 'items';
    }
  };

  const showEditButton = selectedCount === 1;
  const showDuplicateButton = onDuplicate && canDuplicate;
  
  return (
    <div
      className="absolute z-[1100] flex gap-1 p-1 bg-background border border-border rounded-lg shadow-lg animate-scale-in"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -120%)'
      }}
    >
      {showEditButton && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onEdit}
          className="h-8 w-8 p-0"
          title={`Edit ${getEntityLabel()}`}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      )}
      
      {showDuplicateButton && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onDuplicate}
          className="h-8 w-8 p-0"
          title={
            duplicateDisabledReason || 
            `Duplicate ${selectedCount > 1 ? `${selectedCount} ${getEntityLabel()}` : getEntityLabel()} (Ctrl+D)`
          }
        >
          <Copy className="h-4 w-4" />
        </Button>
      )}
      
      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
        title={selectedCount > 1 ? `Delete ${selectedCount} ${getEntityLabel()}` : `Delete ${getEntityLabel()}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      
      {selectedCount > 1 && (
        <Badge variant="secondary" className="ml-1 h-6 px-2 text-xs flex items-center">
          {selectedCount}
        </Badge>
      )}
    </div>
  );
};
