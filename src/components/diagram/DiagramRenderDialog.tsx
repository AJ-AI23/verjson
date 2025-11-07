import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DiagramStyles } from '@/types/diagramStyles';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { toPng } from 'html-to-image';
import { Loader2 } from 'lucide-react';

interface DiagramRenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  styles?: DiagramStyles;
  diagramRef: React.RefObject<HTMLDivElement>;
}

export const DiagramRenderDialog: React.FC<DiagramRenderDialogProps> = ({
  open,
  onOpenChange,
  documentId,
  styles,
  diagramRef
}) => {
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [selectedTheme, setSelectedTheme] = useState(styles?.activeTheme || 'light');
  const [isRendering, setIsRendering] = useState(false);

  const availableThemes = styles?.themes ? Object.keys(styles.themes) : ['light', 'dark'];

  const handleRender = async () => {
    if (!diagramRef.current) {
      toast.error('Diagram not ready for rendering');
      return;
    }

    setIsRendering(true);

    try {
      // Apply temporary dimensions for rendering
      const element = diagramRef.current;
      const originalWidth = element.style.width;
      const originalHeight = element.style.height;
      
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;

      // Wait a bit for layout to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate PNG
      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2,
        width,
        height
      });

      // Restore original dimensions
      element.style.width = originalWidth;
      element.style.height = originalHeight;

      // Upload to server
      const { data, error } = await supabase.functions.invoke('diagram-render', {
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
      console.log('Render public URL:', data.publicUrl);
      
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
