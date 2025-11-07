import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DiagramStyles, DiagramStyleTheme, defaultLightTheme, defaultDarkTheme } from '@/types/diagramStyles';
import { SequenceDiagramData } from '@/types/diagram';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { toPng } from 'html-to-image';
import { Loader2 } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { SequenceDiagramRenderer } from './sequence/SequenceDiagramRenderer';

interface DiagramRenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  data: SequenceDiagramData;
  styles?: DiagramStyles;
  diagramRef: React.RefObject<HTMLDivElement>;
}

export const DiagramRenderDialog: React.FC<DiagramRenderDialogProps> = ({
  open,
  onOpenChange,
  documentId,
  data,
  styles,
  diagramRef
}) => {
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [selectedTheme, setSelectedTheme] = useState(styles?.activeTheme || 'light');
  const [isRendering, setIsRendering] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<{ x: number; y: number; zoom: number } | null>(null);
  const previewContainerRef = React.useRef<HTMLDivElement>(null);

  // Default themes if none provided
  const defaultThemes = {
    light: defaultLightTheme,
    dark: defaultDarkTheme
  };

  const availableThemes = styles?.themes ? Object.keys(styles.themes) : ['light', 'dark'];

  const handleRender = async () => {
    if (!previewViewport) {
      toast.error('Please wait for preview to load');
      return;
    }

    if (!previewContainerRef.current) {
      toast.error('Preview container not found');
      return;
    }

    setIsRendering(true);
    console.log('[Render] Starting diagram render process with viewport:', previewViewport);

    try {
      const selectedThemeData = styles?.themes?.[selectedTheme] || defaultThemes[selectedTheme as 'light' | 'dark'];
      
      console.log('[Render] Capturing preview container directly');
      
      // Find the React Flow viewport element within the preview
      const reactFlowViewport = previewContainerRef.current.querySelector('.react-flow__viewport');
      if (!reactFlowViewport) {
        throw new Error('React Flow viewport not found in preview');
      }
      
      console.log('[Render] Found React Flow viewport, capturing as PNG...');
      
      // Capture the preview container as PNG
      const dataUrl = await toPng(previewContainerRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        width,
        height,
        backgroundColor: selectedThemeData?.colors?.background,
        cacheBust: true
      });

      console.log('[Render] PNG captured successfully');

      console.log('[Render] Uploading to server...');
      // Upload to server
      const { data: uploadData, error } = await supabase.functions.invoke('diagram-render', {
        body: {
          documentId,
          styleTheme: selectedTheme,
          width,
          height,
          imageData: dataUrl
        }
      });

      if (error) throw error;

      console.log('[Render] Upload successful:', uploadData);
      toast.success('Diagram rendered successfully!');
      
      onOpenChange(false);

    } catch (error) {
      console.error('[Render] Error occurred:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to render diagram');
    } finally {
      setIsRendering(false);
      console.log('[Render] Render process complete');
    }
  };

  // Prepare preview styles
  const previewStyles: DiagramStyles = {
    themes: styles?.themes || defaultThemes,
    activeTheme: selectedTheme
  };

  // Reference for fit view control in preview
  const previewFitViewRef = React.useRef<(() => void) | null>(null);

  const handleFitView = () => {
    if (previewFitViewRef.current) {
      previewFitViewRef.current();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>Render Diagram</DialogTitle>
          <DialogDescription>
            Configure settings and preview before rendering to PNG
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 flex-1 min-h-0">
          {/* Settings Panel */}
          <div className="w-64 space-y-4 flex-shrink-0">
            <div className="space-y-2">
              <Label htmlFor="width">Width (px)</Label>
              <Input
                id="width"
                type="number"
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value) || 1920)}
                min={800}
                max={4096}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="height">Height (px)</Label>
              <Input
                id="height"
                type="number"
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value) || 1080)}
                min={600}
                max={4096}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">Style Theme</Label>
              <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableThemes.map(theme => (
                    <SelectItem key={theme} value={theme}>
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 space-y-2 border-t">
              <div className="text-sm text-muted-foreground">
                <p>Aspect Ratio: {(width / height).toFixed(2)}</p>
                <p className="mt-1">Resolution: {width} × {height}</p>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 border rounded-lg overflow-hidden bg-muted/20 min-w-0">
            <div className="h-full flex flex-col">
              <div className="bg-muted px-3 py-2 border-b flex items-center justify-between">
                <span className="text-sm font-medium">Preview</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFitView}
                  className="h-7 text-xs"
                >
                  Fit to View
                </Button>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                <div 
                  ref={previewContainerRef}
                  className="mx-auto border shadow-lg"
                  style={{ 
                    width: `${width}px`,
                    height: `${height}px`,
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                >
                  <ReactFlowProvider>
                    <SequenceDiagramRenderer
                      data={data}
                      styles={previewStyles}
                      readOnly={true}
                      isRenderMode={true}
                      onFitViewReady={(fitView) => {
                        previewFitViewRef.current = fitView;
                        // Auto-fit on first load
                        setTimeout(() => fitView(), 100);
                      }}
                      onViewportChange={(viewport) => {
                        setPreviewViewport(viewport);
                      }}
                    />
                  </ReactFlowProvider>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRendering}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRender}
            disabled={isRendering}
          >
            {isRendering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Render PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
