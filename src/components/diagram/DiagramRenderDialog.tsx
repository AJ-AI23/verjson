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

  // Default themes if none provided
  const defaultThemes = {
    light: defaultLightTheme,
    dark: defaultDarkTheme
  };

  const availableThemes = styles?.themes ? Object.keys(styles.themes) : ['light', 'dark'];

  const handleRender = async () => {
    setIsRendering(true);
    console.log('[Render] Starting diagram render process');

    try {
      // Ensure we have valid styles with themes
      const renderStyles: DiagramStyles = {
        themes: styles?.themes || defaultThemes,
        activeTheme: selectedTheme
      };

      console.log('[Render] Using styles:', { 
        hasThemes: !!renderStyles.themes, 
        activeTheme: renderStyles.activeTheme,
        themeKeys: Object.keys(renderStyles.themes || {})
      });
      
      console.log('[Render] Diagram data:', {
        hasData: !!data,
        hasLifelines: !!data?.lifelines,
        lifelinesCount: data?.lifelines?.length || 0,
        hasNodes: !!data?.nodes,
        nodesCount: data?.nodes?.length || 0,
        lifelines: data?.lifelines,
        nodes: data?.nodes
      });

      // Create a hidden rendering container
      const renderContainer = document.createElement('div');
      renderContainer.id = 'diagram-render-container';
      renderContainer.style.position = 'fixed';
      renderContainer.style.top = '-9999px';
      renderContainer.style.left = '-9999px';
      renderContainer.style.width = `${width}px`;
      renderContainer.style.height = `${height}px`;
      renderContainer.style.overflow = 'hidden';
      
      // Apply theme background
      const selectedThemeData = renderStyles.themes[selectedTheme];
      if (selectedThemeData?.colors?.background) {
        renderContainer.style.backgroundColor = selectedThemeData.colors.background;
      }
      
      document.body.appendChild(renderContainer);
      console.log('[Render] Container created and added to DOM');

      // Create a wrapper for the React Flow instance
      const flowWrapper = document.createElement('div');
      flowWrapper.style.width = '100%';
      flowWrapper.style.height = '100%';
      renderContainer.appendChild(flowWrapper);

      // Import ReactDOM dynamically to render the diagram
      const ReactDOM = await import('react-dom/client');
      const root = ReactDOM.createRoot(flowWrapper);
      console.log('[Render] React root created');

      // Create a promise that resolves when the diagram is ready
      let resolveReady: () => void;
      let rejectReady: (error: Error) => void;
      const readyPromise = new Promise<void>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });

      // Set a timeout for the rendering process (10 seconds)
      const renderTimeout = setTimeout(() => {
        rejectReady(new Error('Diagram rendering timed out after 10 seconds'));
      }, 10000);

      console.log('[Render] Starting diagram component render');

      // Render the diagram with render mode enabled
      root.render(
        <ReactFlowProvider>
          <SequenceDiagramRenderer
            data={data}
            styles={renderStyles}
            readOnly={true}
            isRenderMode={true}
            onRenderReady={() => {
              console.log('[Render] Diagram ready callback triggered');
              clearTimeout(renderTimeout);
              resolveReady();
            }}
          />
        </ReactFlowProvider>
      );
      
      console.log('[Render] Waiting for diagram to be ready...');
      // Wait for the diagram to be fully rendered and fitted
      await readyPromise;
      
      console.log('[Render] Diagram ready, waiting for layout stabilization...');
      // Additional wait for any animations or layout adjustments
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[Render] Capturing diagram as PNG...');
      // Capture the rendered diagram
      const dataUrl = await toPng(renderContainer, {
        quality: 1.0,
        pixelRatio: 2,
        width,
        height,
        backgroundColor: selectedThemeData?.colors?.background
      });

      console.log('[Render] PNG captured, cleaning up...');
      // Clean up
      root.unmount();
      document.body.removeChild(renderContainer);

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
      
      // Clean up on error
      try {
        const container = document.getElementById('diagram-render-container');
        if (container) {
          document.body.removeChild(container);
        }
      } catch (cleanupError) {
        console.error('[Render] Cleanup error:', cleanupError);
      }
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
                <span className="text-xs text-muted-foreground">
                  Scaled to fit
                </span>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                <div 
                  className="mx-auto border shadow-lg"
                  style={{ 
                    width: '100%',
                    aspectRatio: `${width} / ${height}`,
                    maxHeight: '100%'
                  }}
                >
                  <ReactFlowProvider>
                    <SequenceDiagramRenderer
                      data={data}
                      styles={previewStyles}
                      readOnly={true}
                      isRenderMode={false}
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
