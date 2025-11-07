import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DiagramStyles, DiagramStyleTheme } from '@/types/diagramStyles';
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

  const availableThemes = styles?.themes ? Object.keys(styles.themes) : ['light', 'dark'];

  const handleRender = async () => {
    setIsRendering(true);

    try {
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
      const selectedThemeData = styles?.themes[selectedTheme];
      if (selectedThemeData?.colors?.background) {
        renderContainer.style.backgroundColor = selectedThemeData.colors.background;
      }
      
      document.body.appendChild(renderContainer);

      // Create a wrapper for the React Flow instance
      const flowWrapper = document.createElement('div');
      flowWrapper.style.width = '100%';
      flowWrapper.style.height = '100%';
      renderContainer.appendChild(flowWrapper);

      // Import ReactDOM dynamically to render the diagram
      const ReactDOM = await import('react-dom/client');
      const root = ReactDOM.createRoot(flowWrapper);

      // Create the styles with the selected theme
      const renderStyles: DiagramStyles = {
        ...styles,
        activeTheme: selectedTheme
      };

      // Create a promise that resolves when the diagram is ready
      let resolveReady: () => void;
      const readyPromise = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });

      // Render the diagram with render mode enabled
      root.render(
        <ReactFlowProvider>
          <SequenceDiagramRenderer
            data={data}
            styles={renderStyles}
            readOnly={true}
            isRenderMode={true}
            onRenderReady={() => resolveReady()}
          />
        </ReactFlowProvider>
      );
      
      // Wait for the diagram to be fully rendered and fitted
      await readyPromise;
      
      // Additional wait for any animations or layout adjustments
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture the rendered diagram
      const dataUrl = await toPng(renderContainer, {
        quality: 1.0,
        pixelRatio: 2,
        width,
        height,
        backgroundColor: selectedThemeData?.colors?.background
      });

      // Clean up
      root.unmount();
      document.body.removeChild(renderContainer);

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

      toast.success('Diagram rendered successfully!');
      console.log('Render public URL:', uploadData.publicUrl);
      
      onOpenChange(false);

    } catch (error) {
      console.error('Rendering error:', error);
      toast.error('Failed to render diagram');
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Render Diagram</DialogTitle>
          <DialogDescription>
            Configure rendering settings and generate a PNG image
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
