
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize, Minimize, Settings } from 'lucide-react';
import { DiagramSettingsDialog } from './DiagramSettingsDialog';
import { DiagramStyles } from '@/types/diagramStyles';

interface DiagramHeaderProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  diagramType?: 'schema' | 'sequence';
  styles?: DiagramStyles;
  onStylesChange?: (styles: DiagramStyles) => void;
  currentTheme?: string;
  onThemeChange?: (theme: string) => void;
}

export const DiagramHeader: React.FC<DiagramHeaderProps> = ({ 
  isFullscreen = false,
  onToggleFullscreen,
  diagramType = 'schema',
  styles,
  onStylesChange,
  currentTheme,
  onThemeChange
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="p-2 border-b bg-card shadow-sm">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="gap-2"
            title="Diagram settings"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        
        {onToggleFullscreen && (
          <>
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
          </>
        )}
        </div>
      </div>
      
      <DiagramSettingsDialog 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen}
        diagramType={diagramType}
        styles={styles}
        onStylesChange={onStylesChange}
        currentTheme={currentTheme}
        onThemeChange={onThemeChange}
      />
    </div>
  );
};
