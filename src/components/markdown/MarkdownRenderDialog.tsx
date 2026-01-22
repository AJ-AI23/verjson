import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { MarkdownDocument, PAGE_SIZES, PageSize, PageOrientation, mmToPixels, getEffectivePageDimensions } from '@/types/markdown';
import { MarkdownStyles, MarkdownStyleTheme, defaultMarkdownStyles } from '@/types/markdownStyles';
import { linesToMarkdown } from '@/lib/markdownUtils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Settings, Eye, FileText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownRenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  document: MarkdownDocument;
}

const PAGE_SIZE_OPTIONS = Object.keys(PAGE_SIZES);

export const MarkdownRenderDialog: React.FC<MarkdownRenderDialogProps> = ({
  open,
  onOpenChange,
  documentId,
  document: markdownDoc
}) => {
  const isMobile = useIsMobile();
  const [selectedTheme, setSelectedTheme] = useState<string>(markdownDoc.selectedTheme || 'light');
  const [globalPageSize, setGlobalPageSize] = useState<string>('A4');
  const [globalOrientation, setGlobalOrientation] = useState<PageOrientation>('portrait');
  const [overridePageSizes, setOverridePageSizes] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [mobileTab, setMobileTab] = useState<string>('settings');
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const pages = markdownDoc.data?.pages || [];
  const styles = markdownDoc.styles || defaultMarkdownStyles;
  const availableThemes = styles?.themes ? Object.keys(styles.themes) : ['light', 'dark'];

  // Get theme data for styling
  const themeData = useMemo(() => {
    return styles?.themes?.[selectedTheme] || defaultMarkdownStyles.themes?.light;
  }, [styles, selectedTheme]);

  // Get effective page dimensions for a page (considering override)
  const getPageDimensions = useCallback((pageIndex: number): { size: PageSize; orientation: PageOrientation } => {
    if (overridePageSizes) {
      return {
        size: PAGE_SIZES[globalPageSize],
        orientation: globalOrientation
      };
    }
    const page = pages[pageIndex];
    return {
      size: page?.pageSize || PAGE_SIZES.A4,
      orientation: page?.orientation || 'portrait'
    };
  }, [pages, overridePageSizes, globalPageSize, globalOrientation]);

  // Generate preview styles from theme
  const previewStyles = useMemo(() => {
    if (!themeData) return {};
    return {
      '--md-font-family': themeData.fonts?.bodyFont || 'system-ui, sans-serif',
      '--md-font-size': themeData.fonts?.baseFontSize || '16px',
      '--md-line-height': themeData.elements?.paragraph?.lineHeight || '1.6',
      '--md-text-color': themeData.colors?.text || '#1a1a1a',
      '--md-background': themeData.colors?.background || '#ffffff',
      '--md-heading-color': themeData.elements?.h1?.color || '#111111',
      '--md-link-color': themeData.colors?.link || '#0066cc',
      '--md-code-bg': themeData.colors?.codeBackground || '#f5f5f5',
      '--md-code-color': themeData.colors?.codeText || '#333333',
      '--md-blockquote-border': themeData.colors?.blockquoteBorder || '#e0e0e0',
    } as React.CSSProperties;
  }, [themeData]);

  // Render a single page content
  const renderPageContent = useCallback((pageIndex: number) => {
    const page = pages[pageIndex];
    if (!page) return null;
    
    const markdownContent = linesToMarkdown(page.lines);
    const { size, orientation } = getPageDimensions(pageIndex);
    const effectiveSize = getEffectivePageDimensions(size, orientation);
    
    // Convert mm to pixels at 96 DPI for preview
    const widthPx = mmToPixels(effectiveSize.width, 96);
    const heightPx = mmToPixels(effectiveSize.height, 96);
    
    return (
      <div
        key={page.id}
        ref={(el) => { pageRefs.current[pageIndex] = el; }}
        className="bg-white shadow-lg border overflow-hidden flex-shrink-0"
        style={{
          width: `${widthPx}px`,
          height: `${heightPx}px`,
          ...previewStyles,
          fontFamily: 'var(--md-font-family)',
          fontSize: 'var(--md-font-size)',
          lineHeight: 'var(--md-line-height)',
          color: 'var(--md-text-color)',
          backgroundColor: 'var(--md-background)',
        }}
      >
        <div className="p-8 h-full overflow-auto prose prose-sm max-w-none" style={{
          '--tw-prose-headings': 'var(--md-heading-color)',
          '--tw-prose-links': 'var(--md-link-color)',
          '--tw-prose-code': 'var(--md-code-color)',
        } as React.CSSProperties}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {markdownContent}
          </ReactMarkdown>
        </div>
      </div>
    );
  }, [pages, getPageDimensions, previewStyles]);

  // Handle PDF generation
  const handleRender = async () => {
    if (pages.length === 0) {
      toast.error('No pages to render');
      return;
    }

    setIsRendering(true);

    try {
      // Create a hidden container for rendering
      const renderContainer = window.document.createElement('div');
      renderContainer.style.position = 'absolute';
      renderContainer.style.left = '-9999px';
      renderContainer.style.top = '0';
      window.document.body.appendChild(renderContainer);

      let pdf: jsPDF | null = null;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { size, orientation } = getPageDimensions(i);
        const effectiveSize = getEffectivePageDimensions(size, orientation);
        
        // Higher DPI for better quality PDF
        const dpi = 150;
        const widthPx = mmToPixels(effectiveSize.width, dpi);
        const heightPx = mmToPixels(effectiveSize.height, dpi);
        
        // Create page element
        const pageElement = window.document.createElement('div');
        pageElement.style.width = `${widthPx}px`;
        pageElement.style.height = `${heightPx}px`;
        pageElement.style.backgroundColor = themeData?.colors?.background || '#ffffff';
        pageElement.style.color = themeData?.colors?.text || '#1a1a1a';
        pageElement.style.fontFamily = themeData?.fonts?.bodyFont || 'system-ui, sans-serif';
        pageElement.style.fontSize = `${parseInt(themeData?.fonts?.baseFontSize || '16') * (dpi / 96)}px`;
        pageElement.style.lineHeight = themeData?.elements?.paragraph?.lineHeight || '1.6';
        pageElement.style.padding = `${32 * (dpi / 96)}px`;
        pageElement.style.boxSizing = 'border-box';
        pageElement.style.overflow = 'hidden';
        
        // Render markdown content
        const markdownContent = linesToMarkdown(page.lines);
        pageElement.innerHTML = `<div class="prose max-w-none">${markdownToHtml(markdownContent)}</div>`;
        
        renderContainer.innerHTML = '';
        renderContainer.appendChild(pageElement);
        
        // Wait for fonts and images to load
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Capture as PNG
        const dataUrl = await toPng(pageElement, {
          width: widthPx,
          height: heightPx,
          pixelRatio: 1,
          backgroundColor: themeData?.colors?.background || '#ffffff',
          cacheBust: true,
        });
        
        // Initialize PDF on first page
        if (i === 0) {
          pdf = new jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: [effectiveSize.width, effectiveSize.height],
          });
        } else if (pdf) {
          // Add new page with correct dimensions
          pdf.addPage([effectiveSize.width, effectiveSize.height], orientation);
        }
        
        if (pdf) {
          pdf.addImage(dataUrl, 'PNG', 0, 0, effectiveSize.width, effectiveSize.height);
        }
      }

      // Cleanup
      window.document.body.removeChild(renderContainer);

      if (!pdf) {
        throw new Error('Failed to create PDF');
      }

      // Get PDF as base64
      const pdfData = pdf.output('datauristring');

      // Upload to server
      const { data: uploadData, error } = await supabase.functions.invoke('markdown-render', {
        body: {
          documentId,
          styleTheme: selectedTheme,
          pdfData,
          pageCount: pages.length,
          title: markdownDoc.info?.title || 'Untitled'
        }
      });

      if (error) throw error;

      toast.success(`PDF generated successfully with ${pages.length} page(s)!`);
      
      // Also trigger download
      pdf.save(`${markdownDoc.info?.title || 'document'}.pdf`);
      
      onOpenChange(false);

    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate PDF');
    } finally {
      setIsRendering(false);
    }
  };

  // Simple markdown to HTML converter for render container
  const markdownToHtml = (md: string): string => {
    // Basic markdown conversion - ReactMarkdown will handle the preview
    return md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/\n/gim, '<br>');
  };

  // Settings panel
  const SettingsPanel = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Style Theme</Label>
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

      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <Label htmlFor="override-sizes" className="text-sm">Override all page sizes</Label>
          <Switch
            id="override-sizes"
            checked={overridePageSizes}
            onCheckedChange={setOverridePageSizes}
          />
        </div>
        
        {overridePageSizes && (
          <>
            <div className="space-y-2">
              <Label>Page Size</Label>
              <Select value={globalPageSize} onValueChange={setGlobalPageSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <SelectItem key={size} value={size}>
                      {size} ({PAGE_SIZES[size].width} × {PAGE_SIZES[size].height} mm)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Orientation</Label>
              <Select value={globalOrientation} onValueChange={(v: PageOrientation) => setGlobalOrientation(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      <div className="pt-4 border-t">
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {pages.length} page{pages.length !== 1 ? 's' : ''}
          </p>
          {pages.map((page, i) => {
            const { size, orientation } = getPageDimensions(i);
            const effectiveSize = getEffectivePageDimensions(size, orientation);
            return (
              <p key={page.id} className="text-xs pl-6">
                Page {i + 1}: {page.title || 'Untitled'} ({effectiveSize.width}×{effectiveSize.height}mm, {orientation})
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Preview panel with page navigation
  const PreviewPanel = () => {
    const currentPage = pages[previewPageIndex];
    const { size, orientation } = getPageDimensions(previewPageIndex);
    const effectiveSize = getEffectivePageDimensions(size, orientation);
    
    // Scale preview to fit container
    const containerWidth = isMobile ? 280 : 500;
    const containerHeight = isMobile ? 350 : 450;
    const pageWidthPx = mmToPixels(effectiveSize.width, 96);
    const pageHeightPx = mmToPixels(effectiveSize.height, 96);
    const scale = Math.min(containerWidth / pageWidthPx, containerHeight / pageHeightPx, 1);
    
    return (
      <div className="h-full flex flex-col">
        <div className="bg-muted px-3 py-2 border-b flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium">
            Page {previewPageIndex + 1} of {pages.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewPageIndex(Math.max(0, previewPageIndex - 1))}
              disabled={previewPageIndex === 0}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewPageIndex(Math.min(pages.length - 1, previewPageIndex + 1))}
              disabled={previewPageIndex >= pages.length - 1}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-muted/30 overflow-hidden">
          <div 
            className="flex items-center justify-center"
            style={{ 
              width: `${pageWidthPx * scale}px`,
              height: `${pageHeightPx * scale}px`,
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          >
            <div 
              ref={previewContainerRef}
              style={{ 
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
                flexShrink: 0,
              }}
            >
              {renderPageContent(previewPageIndex)}
            </div>
          </div>
        </div>
        <div className="px-3 py-2 border-t text-xs text-muted-foreground text-center">
          {currentPage?.title || 'Untitled'} • {effectiveSize.width}×{effectiveSize.height}mm
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMobile ? "max-w-full h-[90vh] p-4" : "max-w-5xl h-[80vh]"}>
        <DialogHeader>
          <DialogTitle>Render PDF</DialogTitle>
          <DialogDescription>
            Generate a PDF document from your markdown pages
          </DialogDescription>
        </DialogHeader>

        {isMobile ? (
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
          <div className="flex gap-6 flex-1 min-h-0">
            <div className="w-64 flex-shrink-0 overflow-y-auto">
              <SettingsPanel />
            </div>
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
            disabled={isRendering || pages.length === 0}
            className={isMobile ? "w-full" : ""}
          >
            {isRendering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>Generate PDF</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
