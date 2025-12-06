import React from 'react';
import { Plus, Link, Unlink, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

interface AnchorTooltipProps {
  anchorId: string;
  anchorType: 'source' | 'target';
  isInProcess: boolean;
  canAddProcess: boolean;
  hasNearbyProcesses: boolean;
  onCreateProcess: () => void;
  onAddToExisting: () => void;
  onRemoveFromProcess?: () => void;
  onSwitchAnchorType: () => void;
  position: { x: number; y: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AnchorTooltip: React.FC<AnchorTooltipProps> = ({
  anchorId,
  anchorType,
  isInProcess,
  canAddProcess,
  hasNearbyProcesses,
  onCreateProcess,
  onAddToExisting,
  onRemoveFromProcess,
  onSwitchAnchorType,
  position,
  open,
  onOpenChange
}) => {
  const switchLabel = anchorType === 'source' ? 'Switch to target' : 'Switch to source';

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
        {/* Switch anchor type option - always visible */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onSwitchAnchorType}
          className="w-full justify-start h-8 text-xs"
          title={switchLabel}
        >
          <ArrowLeftRight className="h-3 w-3 mr-2" />
          {switchLabel}
        </Button>
        
        {isInProcess ? (
          // Show remove option when anchor is in a process
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemoveFromProcess}
            className="w-full justify-start h-8 text-xs text-destructive hover:text-destructive"
            title="Remove this anchor from its current process"
          >
            <Unlink className="h-3 w-3 mr-2" />
            Remove from Process
          </Button>
        ) : (
          // Show add options when anchor is not in a process
          <>
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
          </>
        )}
      </div>
    </div>
  );
};
