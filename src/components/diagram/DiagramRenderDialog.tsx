import React, { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DiagramStyles, DiagramStyleTheme, defaultLightTheme, defaultDarkTheme } from "@/types/diagramStyles";
import { SequenceDiagramData } from "@/types/diagram";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toPng, toSvg } from "html-to-image";
import { Settings, Eye } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import { SequenceDiagramRenderer } from "./sequence/SequenceDiagramRenderer";
import { useIsMobile } from "@/hooks/use-mobile";

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
  diagramRef,
}) => {
  const isMobile = useIsMobile();
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [selectedTheme, setSelectedTheme] = useState<string>("light");
  const [outputFormat, setOutputFormat] = useState<"png" | "svg">("png");

  const [activeTheme, setActiveTheme] = useState<string>(selectedTheme);
  const [mobileTab, setMobileTab] = useState<string>("settings");
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
    if (isMobile && mobileTab === "preview" && previewFitViewRef.current) {
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
    dark: defaultDarkTheme,
  };

  const availableThemes = styles?.themes ? Object.keys(styles.themes) : ["light", "dark"];

  const handleRender = async () => {
    if (!previewContainerRef.current) {
      toast.error("Preview container not found");
      return;
    }

    const selectedThemeData = styles?.themes?.[selectedTheme] || defaultThemes[selectedTheme as "light" | "dark"];
    const captureWidth = width;
    const captureHeight = height;
    const captureFormat = outputFormat;
    const captureTheme = selectedTheme;

    try {
      const containerToCapture = previewContainerRef.current;

      // Capture the preview container directly with exact output dimensions
      const renderFunction = captureFormat === "svg" ? toSvg : toPng;
      const dataUrl = await renderFunction(containerToCapture, {
        quality: captureFormat === "png" ? 1.0 : undefined,
        canvasWidth: captureWidth,
        canvasHeight: captureHeight,
        pixelRatio: 1,
        backgroundColor: selectedThemeData?.colors?.background,
        cacheBust: true,
        filter: (node) => {
          if (node.classList) {
            return (
              !node.classList.contains("react-flow__controls") &&
              !node.classList.contains("react-flow__minimap") &&
              !node.classList.contains("react-flow__attribution")
            );
          }
          return true;
        },
      });

      if (!dataUrl || dataUrl.length < 100) {
        throw new Error(`${captureFormat.toUpperCase()} capture produced empty or invalid data`);
      }

      // Upload to server
      const { data: uploadData, error } = await supabase.functions.invoke("diagram-render", {
        body: {
          documentId,
          styleTheme: captureTheme,
          width: captureWidth,
          height: captureHeight,
          imageData: dataUrl,
          format: captureFormat,
        },
      });

      if (error) throw error;

      toast.success(`Diagram rendered successfully as ${captureFormat.toUpperCase()}!`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to render diagram");
    }
  };

  // Memoize preview styles to prevent unnecessary re-renders
  const previewStyles: DiagramStyles = useMemo(
    () => ({
      themes: styles?.themes || defaultThemes,
    }),
    [styles?.themes],
  );

  // Get the active theme colors
  const activeThemeData = useMemo(
    () => previewStyles.themes[selectedTheme] || previewStyles.themes["light"] || defaultLightTheme,
    [previewStyles.themes, selectedTheme],
  );

  const handleFitView = () => {
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
            {availableThemes.map((theme) => (
              <SelectItem key={theme} value={theme}>
                {theme.charAt(0).toUpperCase() + theme.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="format">Output Format</Label>
        <Select value={outputFormat} onValueChange={(value: "png" | "svg") => setOutputFormat(value)}>
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
          <p className="mt-1">
            Resolution: {width} × {height}
          </p>
        </div>
      </div>
    </div>
  );

  // Memoize the preview content to prevent re-renders when isRendering changes
  const previewContent = useMemo(
    () => (
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
    ),
    [
      data,
      previewStyles,
      activeTheme,
      handleRenderReady,
      handleFitViewReady,
      handleGetViewportReady,
      handleViewportChange,
    ],
  );

  // Preview panel content (reusable for both layouts)
  const PreviewPanel = () => (
    <div className="h-full flex flex-col">
      <div className="bg-muted px-3 py-2 border-b flex items-center justify-between flex-shrink-0">
        <span className="text-sm font-medium">Preview</span>
        <Button variant="ghost" size="sm" onClick={handleFitView} className="h-7 text-xs">
          Fit to View
        </Button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-2">
        <div
          ref={previewContainerRef}
          className="border shadow-lg relative"
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: `${width} / ${height}`,
            backgroundColor: activeThemeData.colors.background,
          }}
        >
          {previewContent}
          {/* Render area indicator */}
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="absolute inset-0 border-2 border-dashed border-primary/50" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMobile ? "max-w-full h-[90vh] p-4" : "max-w-6xl h-[80vh]"}>
        <DialogHeader>
          <DialogTitle>Render Diagram</DialogTitle>
          <DialogDescription>Configure settings and preview before rendering</DialogDescription>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} className={isMobile ? "w-full" : ""}>
            Cancel
          </Button>
          <Button onClick={handleRender} className={isMobile ? "w-full" : ""}>
            Render {outputFormat.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
