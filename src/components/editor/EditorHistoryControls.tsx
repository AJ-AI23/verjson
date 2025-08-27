import React from 'react';
import { Button } from '@/components/ui/button';
import { Undo2, Redo2, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EditorHistoryControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearHistory: () => void;
  currentIndex: number;
  totalEntries: number;
  disabled?: boolean;
}

export const EditorHistoryControls: React.FC<EditorHistoryControlsProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearHistory,
  currentIndex,
  totalEntries,
  disabled = false
}) => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={onUndo}
          disabled={disabled || !canUndo}
          title={disabled ? "Caching disabled" : "Undo (Ctrl+Z)"}
          className="h-8 px-2"
        >
          <Undo2 className="h-3 w-3" />
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={onRedo}
          disabled={disabled || !canRedo}
          title={disabled ? "Caching disabled" : "Redo (Ctrl+Y)"}
          className="h-8 px-2"
        >
          <Redo2 className="h-3 w-3" />
        </Button>
      </div>
      
      {!disabled && totalEntries > 0 && (
        <Badge variant="secondary" className="text-xs">
          {currentIndex}/{totalEntries}
        </Badge>
      )}
      
      {disabled && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Cache Off
        </Badge>
      )}
      
      {!disabled && totalEntries > 0 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearHistory}
          title="Clear history"
          className="h-8 px-2 text-xs"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};