import React, { useState } from 'react';
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
  const [previewViewport, setPreviewViewport] = useState<{ x: number; y: number; zoom: number } | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string>(selectedTheme);
  const [initialRenderComplete, setInitialRenderComplete] = useState(false);
  const [mobileTab, setMobileTab] = useState<string>('settings');
  const previewContainerRef = React.useRef<HTMLDivElement>(null);

  // Sync active theme with selected theme
  React.useEffect(() => {
    setActiveTheme(selectedTheme);
    setInitialRenderComplete(false);
  }, [selectedTheme]);

  // Default themes if none provided
  const defaultThemes = {
    light: defaultLightTheme,
    dark: defaultDarkTheme
  };

  const availableThemes = styles?.themes ? Object.keys(styles.themes) : ['light', 'dark'];

  const handleRender = async () => {
    console.log('[Render] Button clicked!', { hasViewport: !!previewViewport, hasRef: !!previewContainerRef.current });
    
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
      
      console.log('[Render] Starting capture with theme:', {
        selectedTheme,
        hasThemeData: !!selectedThemeData,
        backgroundColor: selectedThemeData?.colors?.background,
        themeColors: selectedThemeData?.colors
      });
      
      console.log('[Render] Capturing preview container directly');
      
      if (!previewContainerRef.current) {
        throw new Error('Preview container ref is null');
      }
      
      // Find the React Flow viewport element within the preview
      const reactFlowViewport = previewContainerRef.current.querySelector('.react-flow__viewport');
      if (!reactFlowViewport) {
        throw new Error('React Flow viewport not found in preview');
      }
      
      console.log('[Render] Found React Flow viewport, checking container styles...');
      const computedStyle = window.getComputedStyle(previewContainerRef.current);
      console.log('[Render] Container computed background:', computedStyle.backgroundColor);
      
      // Debug: Check what's actually in the DOM
      const reactFlowPane = previewContainerRef.current.querySelector('.react-flow__pane');
      const nodes = previewContainerRef.current.querySelectorAll('[data-id]');
      console.log('[Render] DOM elements found:', {
        hasReactFlowPane: !!reactFlowPane,
        nodeCount: nodes.length,
        containerHTML: previewContainerRef.current.innerHTML.substring(0, 500)
      });
      
      console.log('[Render] Starting PNG capture...');
      
      // Get the actual dimensions of the preview container
      const previewRect = previewContainerRef.current.getBoundingClientRect();
      const scale = width / previewRect.width;
      
      console.log('[Render] Capture settings:', { 
        targetWidth: width, 
        targetHeight: height, 
        previewWidth: previewRect.width,
        previewHeight: previewRect.height,
        scale,
        backgroundColor: selectedThemeData?.colors?.background
      });
      
      // Add a small delay to ensure theme is fully applied
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log(`[Render] Calling to${outputFormat === 'svg' ? 'Svg' : 'Png'}...`);
      
      // Capture the preview container as PNG or SVG at the target resolution
      const renderFunction = outputFormat === 'svg' ? toSvg : toPng;
      const dataUrl = await renderFunction(previewContainerRef.current, {
        quality: outputFormat === 'png' ? 1.0 : undefined,
        pixelRatio: outputFormat === 'png' ? scale : 1,
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
      
      console.log(`[Render] ${outputFormat.toUpperCase()} captured successfully, data URL length:`, dataUrl.length);
      
      if (!dataUrl || dataUrl.length < 100) {
        throw new Error(`${outputFormat.toUpperCase()} capture produced empty or invalid data`);
      }

      console.log(`[Render] ${outputFormat.toUpperCase()} captured successfully`);

      console.log('[Render] Uploading to server...');
      // Upload to server
      const { data: uploadData, error } = await supabase.functions.invoke('diagram-render', {
        body: {
          documentId,
          styleTheme: selectedTheme,
          width,
          height,
          imageData: dataUrl,
          format: outputFormat
        }
      });

      if (error) throw error;

      console.log('[Render] Upload successful:', uploadData);
      toast.success(`Diagram rendered successfully as ${outputFormat.toUpperCase()}!`);
      
      onOpenChange(false);

    } catch (error) {
      console.error('[Render] Error occurred:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to render diagram');
    } finally {
      setIsRendering(false);
      console.log('[Render] Render process complete');
    }
  };

  // Prepare preview styles with correct theme
  const previewStyles: DiagramStyles = {
    themes: styles?.themes || defaultThemes
  };

  // Get the active theme colors
  const activeThemeData = previewStyles.themes[selectedTheme] || previewStyles.themes['light'] || defaultLightTheme;

  // Reference for fit view control in preview
  const previewFitViewRef = React.useRef<(() => void) | null>(null);

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

  // Preview panel content (reusable for both layouts)
  const PreviewPanel = () => (
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
            width: '100%',
            aspectRatio: `${width} / ${height}`,
            maxHeight: '100%',
            backgroundColor: activeThemeData.colors.background
          }}
        >
          <ReactFlowProvider>
            <SequenceDiagramRenderer
              data={data}
              styles={previewStyles}
              theme={activeTheme}
              readOnly={true}
              isRenderMode={true}
              hasUserInteractedWithViewport={hasUserInteracted}
              onRenderReady={() => {
                console.log('[DiagramRenderDialog] onRenderReady - Diagram fully rendered');
                const viewport = { x: 0, y: 0, zoom: 1 };
                setPreviewViewport(viewport);
                
                // Force proper layout by toggling theme after initial mount
                if (!initialRenderComplete) {
                  setTimeout(() => {
                    console.log('[DiagramRenderDialog] Toggling theme to force layout recalculation');
                    // Toggle to opposite theme temporarily
                    const tempTheme = activeTheme === 'light' ? 'dark' : 'light';
                    setActiveTheme(tempTheme);
                    setTimeout(() => {
                      setActiveTheme(selectedTheme);
                      setInitialRenderComplete(true);
                    }, 50);
                  }, 100);
                }
              }}
              onFitViewReady={(fitView) => {
                console.log('[DiagramRenderDialog] onFitViewReady called, storing fitView reference');
                previewFitViewRef.current = fitView;
              }}
              onViewportChange={(viewport) => {
                console.log('[DiagramRenderDialog] Viewport changed - USER INTERACTION', viewport);
                setPreviewViewport(viewport);
                setHasUserInteracted(true);
              }}
            />
          </ReactFlowProvider>
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
