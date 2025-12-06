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
import { Settings, Eye } from 'lucide-react';
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
  
  const [activeTheme, setActiveTheme] = useState<string>(selectedTheme);
  const [mobileTab, setMobileTab] = useState<string>('settings');
  const previewContainerRef = React.useRef<HTMLDivElement>(null);
  const previewFitViewRef = React.useRef<(() => void) | null>(null);
  const previewGetViewportRef = React.useRef<(() => { x: number; y: number; zoom: number }) | null>(null);
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
  
  const handleGetViewportReady = useCallback((getViewport: () => { x: number; y: number; zoom: number }) => {
    previewGetViewportRef.current = getViewport;
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
    const selectedThemeData = styles?.themes?.[selectedTheme] || defaultThemes[selectedTheme as 'light' | 'dark'];
    const captureWidth = width;
    const captureHeight = height;
    const captureFormat = outputFormat;
    const captureTheme = selectedTheme;
    
    // Capture the current viewport from the preview
    const currentViewport = previewGetViewportRef.current?.() || { x: 0, y: 0, zoom: 1 };
    
    // Calculate the viewport scale factor based on container size difference
    // The preview container has a certain size, the offscreen will be at target dimensions
    const previewRect = previewContainerRef.current?.getBoundingClientRect();
    const scaleX = previewRect ? captureWidth / previewRect.width : 1;
    const scaleY = previewRect ? captureHeight / previewRect.height : 1;
    
    // Scale the viewport to match the target dimensions
    const scaledViewport = {
      x: currentViewport.x * scaleX,
      y: currentViewport.y * scaleY,
      zoom: currentViewport.zoom
    };
    
    console.log('[Render] Viewport captured:', { currentViewport, scaledViewport, scaleX, scaleY });

    try {
      // Create an offscreen container at the exact target dimensions
      const offscreenContainer = document.createElement('div');
      offscreenContainer.style.cssText = `
        position: fixed;
        left: -9999px;
        top: -9999px;
        width: ${captureWidth}px;
        height: ${captureHeight}px;
        background-color: ${selectedThemeData?.colors?.background || '#ffffff'};
        overflow: hidden;
      `;
      document.body.appendChild(offscreenContainer);

      // Render the diagram into the offscreen container with the captured viewport
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(offscreenContainer);
      
      await new Promise<void>((resolve) => {
        root.render(
          <ReactFlowProvider>
            <SequenceDiagramRenderer
              data={data}
              styles={previewStyles}
              theme={captureTheme}
              readOnly={true}
              isRenderMode={true}
              initialViewport={scaledViewport}
              hasUserInteractedWithViewport={true}
              onRenderReady={() => {
                // Give it a bit more time to fully render
                setTimeout(resolve, 300);
              }}
            />
          </ReactFlowProvider>
        );
      });

      // Capture the offscreen container at its actual size (1:1 pixel ratio)
      const renderFunction = captureFormat === 'svg' ? toSvg : toPng;
      const dataUrl = await renderFunction(offscreenContainer, {
        quality: captureFormat === 'png' ? 1.0 : undefined,
        pixelRatio: 1,
        width: captureWidth,
        height: captureHeight,
        backgroundColor: selectedThemeData?.colors?.background,
        cacheBust: true,
        filter: (node) => {
          if (node.classList) {
            return !node.classList.contains('react-flow__controls') &&
                   !node.classList.contains('react-flow__minimap') &&
                   !node.classList.contains('react-flow__attribution');
          }
          return true;
        }
      });

      // Cleanup
      root.unmount();
      document.body.removeChild(offscreenContainer);
      
      if (!dataUrl || dataUrl.length < 100) {
        throw new Error(`${captureFormat.toUpperCase()} capture produced empty or invalid data`);
      }

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

      toast.success(`Diagram rendered successfully as ${captureFormat.toUpperCase()}!`);
      onOpenChange(false);

    } catch (error) {
      console.error('[Render] Error occurred:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to render diagram');
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
        onGetViewportReady={handleGetViewportReady}
        onViewportChange={handleViewportChange}
      />
    </ReactFlowProvider>
  ), [data, previewStyles, activeTheme, handleRenderReady, handleFitViewReady, handleGetViewportReady, handleViewportChange]);

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
            className={isMobile ? "w-full" : ""}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRender}
            className={isMobile ? "w-full" : ""}
          >
            Render {outputFormat.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
