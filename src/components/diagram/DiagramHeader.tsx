
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize, Minimize, Settings, RotateCcw, Magnet, Bug } from 'lucide-react';
import { DiagramSettingsDialog } from './DiagramSettingsDialog';
import { DiagramStyles } from '@/types/diagramStyles';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useDebug } from '@/contexts/DebugContext';

interface DiagramHeaderProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  diagramType?: 'schema' | 'sequence';
  styles?: DiagramStyles;
  onStylesChange?: (styles: DiagramStyles) => void;
  currentTheme?: string;
  onThemeChange?: (theme: string) => void;
  onResetLayout?: () => void;
  smartSpacing?: boolean;
  onToggleSmartSpacing?: () => void;
  onApplySmartSpacing?: () => void;
}

export const DiagramHeader: React.FC<DiagramHeaderProps> = ({ 
  isFullscreen = false,
  onToggleFullscreen,
  diagramType = 'schema',
  styles,
  onStylesChange,
  currentTheme,
  onThemeChange,
  onResetLayout,
  smartSpacing,
  onToggleSmartSpacing,
  onApplySmartSpacing
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { showDiagramDebug, toggleDiagramDebug } = useDebug();

  return (
    <div className="p-2 border-b bg-card shadow-sm">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          {onToggleSmartSpacing && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={smartSpacing ? "default" : "outline"}
                    size="sm"
                    onClick={onToggleSmartSpacing}
                    className="gap-2"
                  >
                    <Magnet className="h-4 w-4" />
                    Smart Spacing
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {smartSpacing 
                    ? "Disable automatic node spacing" 
                    : "Enable automatic node spacing to prevent overlaps"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onApplySmartSpacing && smartSpacing && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onApplySmartSpacing}
                    className="gap-2"
                  >
                    Apply Now
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Apply smart spacing to current layout
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onResetLayout && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onResetLayout}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset Layout
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Reset all nodes to their calculated positions
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showDiagramDebug ? "default" : "outline"}
                  size="sm"
                  onClick={toggleDiagramDebug}
                  className="gap-2"
                >
                  <Bug className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showDiagramDebug 
                  ? "Hide node debug info" 
                  : "Show node dimensions and positions"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
