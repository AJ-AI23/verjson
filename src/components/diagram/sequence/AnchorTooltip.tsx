import React from 'react';
import { Plus, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

interface AnchorTooltipProps {
  anchorId: string;
  isInProcess: boolean;
  canAddProcess: boolean;
  hasNearbyProcesses: boolean;
  onCreateProcess: () => void;
  onAddToExisting: () => void;
  position: { x: number; y: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AnchorTooltip: React.FC<AnchorTooltipProps> = ({
  anchorId,
  isInProcess,
  canAddProcess,
  hasNearbyProcesses,
  onCreateProcess,
  onAddToExisting,
  position,
  open,
  onOpenChange
}) => {
  if (isInProcess) {
    return null; // Don't show tooltip if anchor is already in a process
  }

  return (
    <div
      className="fixed z-[2000] pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -120%)'
      }}
    >
      <div className="pointer-events-auto bg-popover border border-border rounded-lg shadow-lg p-2 flex flex-col gap-1 min-w-[180px]">
        <Button
          size="sm"
          variant="ghost"
          onClick={onCreateProcess}
          disabled={!canAddProcess}
          className="w-full justify-start h-8 text-xs"
          title={!canAddProcess ? "Maximum 3 parallel processes reached" : "Create a new process"}
        >
          <Plus className="h-3 w-3 mr-2" />
          Add Process
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={onAddToExisting}
          disabled={!hasNearbyProcesses}
          className="w-full justify-start h-8 text-xs"
          title={!hasNearbyProcesses ? "No processes on this lifeline" : "Add to an existing process"}
        >
          <Link className="h-3 w-3 mr-2" />
          Add to Existing
        </Button>
      </div>
    </div>
  );
};
