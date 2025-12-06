import React, { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DiagramStyles, DiagramStyleTheme, defaultLightTheme, defaultDarkTheme } from '@/types/diagramStyles';
import { SequenceDiagramData } from '@/types/diagram';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { toPng, toSvg } from 'html-to-image';
import { Loader2, Settings, Eye } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { SequenceDiagramRenderer } from './sequence/SequenceDiagramRenderer';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [selectedTheme, setSelectedTheme] = useState<string>('light');
  const [outputFormat, setOutputFormat] = useState<'png' | 'svg'>('png');
  const [isRendering, setIsRendering] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string>(selectedTheme);
  const [mobileTab, setMobileTab] = useState<string>('settings');
  const previewContainerRef = React.useRef<HTMLDivElement>(null);
  const previewFitViewRef = React.useRef<(() => void) | null>(null);
  const hasFittedViewRef = React.useRef(false);
  const isReadyRef = React.useRef(false);
  
  // Memoize callbacks to prevent unnecessary re-renders
  const handleRenderReady = useCallback(() => {
    isReadyRef.current = true;
  }, []);
  
  const handleFitViewReady = useCallback((fitView: () => void) => {
    previewFitViewRef.current = fitView;
    // Auto fit view once on initial load
    if (!hasFittedViewRef.current) {
      hasFittedViewRef.current = true;
      setTimeout(() => fitView(), 150);
    }
  }, []);
  
  const handleViewportChange = useCallback(() => {
    // No state updates needed - just track via refs
  }, []);

  // Sync active theme with selected theme
  React.useEffect(() => {
    setActiveTheme(selectedTheme);
  }, [selectedTheme]);

  // Trigger fitView when switching to preview tab on mobile
  React.useEffect(() => {
    if (isMobile && mobileTab === 'preview' && previewFitViewRef.current) {
      // Small delay to ensure ReactFlow is fully rendered
      const timer = setTimeout(() => {
        if (previewFitViewRef.current) {
          previewFitViewRef.current();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isMobile, mobileTab]);

  // Default themes if none provided
  const defaultThemes = {
    light: defaultLightTheme,
    dark: defaultDarkTheme
  };

  const availableThemes = styles?.themes ? Object.keys(styles.themes) : ['light', 'dark'];

  const handleRender = async () => {
    if (!isReadyRef.current) {
      toast.error('Please wait for preview to load');
      return;
    }

    if (!previewContainerRef.current) {
      toast.error('Preview container not found');
      return;
    }

    // Capture the container reference and all values before any state changes
    const containerToCapture = previewContainerRef.current;
    const selectedThemeData = styles?.themes?.[selectedTheme] || defaultThemes[selectedTheme as 'light' | 'dark'];
    const captureWidth = width;
    const captureHeight = height;
    const captureFormat = outputFormat;
    const captureTheme = selectedTheme;

    // Capture the current viewport transform to restore if needed
    const viewportElement = containerToCapture.querySelector('.react-flow__viewport') as HTMLElement;
    const originalTransform = viewportElement?.style.transform;
    console.log('[Render] Captured original viewport transform:', originalTransform);

    // Set rendering state AFTER we've captured everything
    setIsRendering(true);
    
    // Use requestAnimationFrame to let React finish any updates, then restore transform if it changed
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        if (viewportElement && viewportElement.style.transform !== originalTransform) {
          console.log('[Render] Transform changed! Restoring original:', originalTransform, '-> current:', viewportElement.style.transform);
          viewportElement.style.transform = originalTransform;
        }
        resolve();
      });
    });

    try {
      console.log('[Render] Starting capture with theme:', {
        captureTheme,
        hasThemeData: !!selectedThemeData,
        backgroundColor: selectedThemeData?.colors?.background
      });
      
      // Find the React Flow viewport element within the preview
      const reactFlowViewport = containerToCapture.querySelector('.react-flow__viewport');
      if (!reactFlowViewport) {
        throw new Error('React Flow viewport not found in preview');
      }
      
      // Get the actual dimensions of the preview container
      const previewRect = containerToCapture.getBoundingClientRect();
      const scale = captureWidth / previewRect.width;
      
      console.log('[Render] Capture settings:', { 
        targetWidth: captureWidth, 
        targetHeight: captureHeight, 
        previewWidth: previewRect.width,
        previewHeight: previewRect.height,
        scale,
        backgroundColor: selectedThemeData?.colors?.background
      });
      
      console.log(`[Render] Calling to${captureFormat === 'svg' ? 'Svg' : 'Png'}...`);
      
      // Capture the preview container as PNG or SVG at the target resolution
      const renderFunction = captureFormat === 'svg' ? toSvg : toPng;
      const dataUrl = await renderFunction(containerToCapture, {
        quality: captureFormat === 'png' ? 1.0 : undefined,
        pixelRatio: captureFormat === 'png' ? scale : 1,
        width: previewRect.width,
        height: previewRect.height,
        backgroundColor: selectedThemeData?.colors?.background,
        cacheBust: true,
        filter: (node) => {
          // Filter out any overlays or controls that shouldn't be captured
          if (node.classList) {
            return !node.classList.contains('react-flow__controls') &&
                   !node.classList.contains('react-flow__minimap') &&
                   !node.classList.contains('react-flow__attribution');
          }
          return true;
        }
      });
      
      console.log(`[Render] ${captureFormat.toUpperCase()} captured successfully, data URL length:`, dataUrl.length);
      
      if (!dataUrl || dataUrl.length < 100) {
        throw new Error(`${captureFormat.toUpperCase()} capture produced empty or invalid data`);
      }

      console.log('[Render] Uploading to server...');
      // Upload to server
      const { data: uploadData, error } = await supabase.functions.invoke('diagram-render', {
        body: {
          documentId,
          styleTheme: captureTheme,
          width: captureWidth,
          height: captureHeight,
          imageData: dataUrl,
          format: captureFormat
        }
      });

      if (error) throw error;

      console.log('[Render] Upload successful:', uploadData);
      toast.success(`Diagram rendered successfully as ${captureFormat.toUpperCase()}!`);
      
      onOpenChange(false);

    } catch (error) {
      console.error('[Render] Error occurred:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to render diagram');
    } finally {
      setIsRendering(false);
      console.log('[Render] Render process complete');
    }
  };

  // Memoize preview styles to prevent unnecessary re-renders
  const previewStyles: DiagramStyles = useMemo(() => ({
    themes: styles?.themes || defaultThemes
  }), [styles?.themes]);

  // Get the active theme colors
  const activeThemeData = useMemo(() => 
    previewStyles.themes[selectedTheme] || previewStyles.themes['light'] || defaultLightTheme,
    [previewStyles.themes, selectedTheme]
  );

  const handleFitView = () => {
    console.log('[DiagramRenderDialog] Fit to View button clicked - MANUAL fitView call');
    if (previewFitViewRef.current) {
      previewFitViewRef.current();
    }
  };

  // Settings panel content (reusable for both layouts)
  const SettingsPanel = () => (
    <div className="space-y-4">
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

      <div className="space-y-2">
        <Label htmlFor="format">Output Format</Label>
        <Select value={outputFormat} onValueChange={(value: 'png' | 'svg') => setOutputFormat(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="png">PNG (Raster)</SelectItem>
            <SelectItem value="svg">SVG (Vector)</SelectItem>
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
  );

  // Memoize the preview content to prevent re-renders when isRendering changes
  const previewContent = useMemo(() => (
    <ReactFlowProvider>
      <SequenceDiagramRenderer
        data={data}
        styles={previewStyles}
        theme={activeTheme}
        readOnly={true}
        isRenderMode={true}
        hasUserInteractedWithViewport={hasFittedViewRef.current}
        onRenderReady={handleRenderReady}
        onFitViewReady={handleFitViewReady}
        onViewportChange={handleViewportChange}
      />
    </ReactFlowProvider>
  ), [data, previewStyles, activeTheme, handleRenderReady, handleFitViewReady, handleViewportChange]);

  // Preview panel content (reusable for both layouts)
  const PreviewPanel = () => (
    <div className="h-full flex flex-col">
      <div className="bg-muted px-3 py-2 border-b flex items-center justify-between flex-shrink-0">
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
      <div className="flex-1 min-h-0 flex items-center justify-center p-2">
        <div 
          ref={previewContainerRef}
          className="border shadow-lg relative"
          style={{ 
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: `${width} / ${height}`,
            backgroundColor: activeThemeData.colors.background
          }}
        >
          {previewContent}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMobile ? "max-w-full h-[90vh] p-4" : "max-w-6xl h-[80vh]"}>
        <DialogHeader>
          <DialogTitle>Render Diagram</DialogTitle>
          <DialogDescription>
            Configure settings and preview before rendering
          </DialogDescription>
        </DialogHeader>

        {isMobile ? (
          // Mobile layout with tabs
          <Tabs value={mobileTab} onValueChange={setMobileTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="settings" className="flex-1 overflow-auto mt-4">
              <SettingsPanel />
            </TabsContent>
            <TabsContent value="preview" className="flex-1 min-h-0 mt-4">
              <div className="h-full border rounded-lg overflow-hidden bg-muted/20">
                <PreviewPanel />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          // Desktop layout with side-by-side panels
          <div className="flex gap-6 flex-1 min-h-0">
            {/* Settings Panel */}
            <div className="w-64 flex-shrink-0">
              <SettingsPanel />
            </div>

            {/* Preview Panel */}
            <div className="flex-1 border rounded-lg overflow-hidden bg-muted/20 min-w-0">
              <PreviewPanel />
            </div>
          </div>
        )}

        <DialogFooter className={isMobile ? "flex-col gap-2" : ""}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRendering}
            className={isMobile ? "w-full" : ""}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRender}
            disabled={isRendering}
            className={isMobile ? "w-full" : ""}
          >
            {isRendering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Render {outputFormat.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
