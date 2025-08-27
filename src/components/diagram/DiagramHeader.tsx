
import React from 'react';
import { Button } from '@/components/ui/button';
import { Maximize, Minimize, X } from 'lucide-react';

interface DiagramHeaderProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const DiagramHeader: React.FC<DiagramHeaderProps> = ({ 
  isFullscreen = false,
  onToggleFullscreen
}) => {
  return (
    <div className="p-2 border-b bg-card shadow-sm">
      <div className="flex items-center justify-end">
        
        
        {onToggleFullscreen && (
          <div className="flex items-center gap-2">
            {isFullscreen ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleFullscreen}
                className="gap-2"
                title="Exit fullscreen (Esc)"
              >
                <Minimize className="h-4 w-4" />
                Exit Fullscreen
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleFullscreen}
                className="gap-2"
                title="Enter fullscreen"
              >
                <Maximize className="h-4 w-4" />
                Fullscreen
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
