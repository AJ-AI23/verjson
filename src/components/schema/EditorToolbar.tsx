
import React, { useState, useRef } from 'react';
import { Save, MessageCircle, FileText, Calendar, Clock, Copy, X, Share, Download, RefreshCw, Palette, Upload, Image, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

import { NotationsPanel } from '@/components/notations/NotationsPanel';
import { RedoclyDialog } from '@/components/RedoclyDialog';
import { QADialog } from '@/components/QADialog';
import { OpenAPISplitDialog } from '@/components/OpenAPISplitDialog';
import { DocumentConfigDialog } from '@/components/DocumentConfigDialog';
import { UrlAuthDialog } from '@/components/workspace/UrlAuthDialog';
import { DiagramRenderDialog } from '@/components/diagram/DiagramRenderDialog';
import { MarkdownRenderDialog } from '@/components/markdown/MarkdownRenderDialog';
import { DocumentInformationDialog } from '@/components/DocumentInformationDialog';
import { supabase } from '@/integrations/supabase/client';

import { SchemaType } from '@/lib/schemaUtils';
import { useEditorSettings } from '@/contexts/EditorSettingsContext';
import { useNotationsManager } from '@/hooks/useNotationsManager';
import { useDebug } from '@/contexts/DebugContext';

interface EditorToolbarProps {
  schema: string;
  schemaType: SchemaType;
  groupProperties: boolean;
  maxDepth: number;
  onSchemaTypeChange: (type: SchemaType) => void;
  onGroupPropertiesChange: (checked: boolean) => void;
  toggleVersionHistory: (isOpen?: boolean) => void;
  setSchema: (schema: string) => void;
  setSavedSchema: (schema: string) => void;
  onAddNotation?: (nodeId: string, user: string, message: string) => void;
  documentName?: string;
  selectedDocument?: any;
  onClose?: () => void;
  onDocumentUpdate?: (updates: { name?: string; is_public?: boolean }) => void;
  onSave?: (content: any) => void;
  onOpenStyles?: () => void;
  onImportOpenApi?: () => void;
  diagramRef?: React.RefObject<HTMLDivElement>;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  schema,
  schemaType,
  groupProperties,
  maxDepth,
  onSchemaTypeChange,
  onGroupPropertiesChange,
  toggleVersionHistory,
  setSchema,
  setSavedSchema,
  onAddNotation,
  documentName,
  selectedDocument,
  onClose,
  onDocumentUpdate,
  onSave,
  onOpenStyles,
  onImportOpenApi,
  diagramRef: propDiagramRef,
}) => {
  const internalDiagramRef = useRef<HTMLDivElement>(null);
  const diagramRef = propDiagramRef || internalDiagramRef;
  const { debugToast } = useDebug();
  const { updateMaxDepth } = useEditorSettings();
  const [isNotationsPanelOpen, setIsNotationsPanelOpen] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string>('');
  const [isRenderDialogOpen, setIsRenderDialogOpen] = useState(false);
  const [isDocInfoDialogOpen, setIsDocInfoDialogOpen] = useState(false);
  
  const { groupedNotations, activeNotationCount } = useNotationsManager(schema);
  
  const handleAddNotation = (nodeId: string, user: string, message: string) => {
    if (onAddNotation) {
      onAddNotation(nodeId, user, message);
    }
  };

  const handleReplyToNotation = (nodeId: string, user: string, message: string) => {
    // For now, treat replies as new notations
    handleAddNotation(nodeId, user, message);
  };

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast.success('Document ID copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy ID');
    }
  };

  const handleCopyPublicUrl = async (id: string) => {
    try {
      const publicUrl = `https://swghcmyqracwifpdfyap.supabase.co/functions/v1/public-document?id=${id}`;
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Public URL copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy public URL');
    }
  };

  const handleCopyPngUrl = async () => {
    if (!selectedDocument?.id) return;
    
    // Default to light theme for PNG export
    const pngUrl = `https://swghcmyqracwifpdfyap.supabase.co/functions/v1/public-diagram?id=${selectedDocument.id}&format=png&style_theme=light`;
    
    try {
      await navigator.clipboard.writeText(pngUrl);
      toast.success('PNG URL copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy URL');
    }
  };

  const handleCopyPdfUrl = async () => {
    if (!selectedDocument?.id) return;
    
    try {
      // Get the latest PDF render for this document
      // Using type assertion since the table was just created and types may not be updated
      const { data: render, error } = await supabase
        .from('markdown_renders' as any)
        .select('storage_path')
        .eq('document_id', selectedDocument.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: { storage_path: string } | null, error: any };
      
      if (error) throw error;
      
      if (!render?.storage_path) {
        toast.error('No PDF render found. Please render the document first.');
        return;
      }
      
      // Generate signed URL for private bucket (1 hour expiry)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('markdown-renders')
        .createSignedUrl(render.storage_path, 3600);
      
      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error('Failed to generate signed URL');
      }
      
      await navigator.clipboard.writeText(signedUrlData.signedUrl);
      toast.success('PDF URL copied to clipboard (valid for 1 hour)');
    } catch (error) {
      console.error('Failed to get PDF URL:', error);
      toast.error('Failed to copy PDF URL');
    }
  };

  const handleReloadFromUrl = async () => {
    if (!selectedDocument?.import_url) return;
    
    setIsReloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to reload from URL');
        setIsReloading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('fetch-authenticated-url', {
        body: { 
          action: 'fetchWithStoredCredentials',
          url: selectedDocument.import_url,
          documentId: selectedDocument.id
        }
      });

      if (error) throw error;

      // Check if authentication is required
      if (data.requiresAuth || (data.error && data.error.includes('requiresAuth'))) {
        setPendingUrl(selectedDocument.import_url);
        setAuthDialogOpen(true);
        setIsReloading(false);
        return;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const content = JSON.parse(data.content);
      
      // Update the schema in the editor
      const newSchema = JSON.stringify(content, null, 2);
      setSchema(newSchema);
      setSavedSchema(newSchema);
      
      // Save the updated content to the database
      if (onSave) {
        onSave(content);
      }
      
      toast.success('Document reloaded from URL and saved');
    } catch (error) {
      toast.error(`Failed to reload from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsReloading(false);
    }
  };

  const handleAuthenticate = async (authMethod: 'basic' | 'bearer', credentials: string) => {
    if (!pendingUrl || !selectedDocument) return;
    
    setIsReloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to authenticate');
        return;
      }

      const { data, error } = await supabase.functions.invoke('fetch-authenticated-url', {
        body: { 
          action: 'fetch',
          url: pendingUrl,
          authMethod,
          credentials,
          documentId: selectedDocument.id
        }
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      const content = JSON.parse(data.content);
      
      // Update the schema in the editor
      const newSchema = JSON.stringify(content, null, 2);
      setSchema(newSchema);
      setSavedSchema(newSchema);
      
      // Save the updated content to the database
      if (onSave) {
        onSave(content);
      }
      
      toast.success('Document reloaded from URL and saved');
      setAuthDialogOpen(false);
      setPendingUrl('');
    } catch (error) {
      toast.error(`Failed to reload from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsReloading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileTypeIcon = (fileType: string) => {
    return <FileText className="h-4 w-4" />;
  };

  const getFileTypeLabel = (fileType: string) => {
    if (fileType === 'diagram') return 'Diagram';
    if (fileType === 'markdown') return 'Markdown';
    return fileType === 'openapi' ? 'OpenAPI' : 'JSON Schema';
  };

  const isDiagram = selectedDocument?.file_type === 'diagram';
  const isMarkdown = selectedDocument?.file_type === 'markdown';
  const supportsStyles = isDiagram || isMarkdown;

  return (
    <TooltipProvider>
      <div className="mb-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3">
            {/* Document Information Section */}
            {selectedDocument ? (
              <div className="mb-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setIsDocInfoDialogOpen(true)}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Document Information</p>
                        </TooltipContent>
                      </Tooltip>
                      <DocumentConfigDialog 
                        document={selectedDocument}
                        onDocumentUpdate={onDocumentUpdate || (() => {})}
                        disabled={!selectedDocument}
                      />
                      {getFileTypeIcon(selectedDocument.file_type)}
                      <h3 className="font-semibold text-foreground truncate">
                        {selectedDocument.name}
                      </h3>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {getFileTypeLabel(selectedDocument.file_type)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1 md:gap-3 text-xs text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopyId(selectedDocument.id)}
                          >
                            <Copy className="h-3 w-3" />
                            <span className="hidden md:inline">ID</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{selectedDocument.id}</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopyPublicUrl(selectedDocument.id)}
                          >
                            <Share className="h-3 w-3" />
                            <span className="hidden md:inline">URL</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy public JSON URL</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      {isDiagram && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1 gap-1 text-xs text-muted-foreground hover:text-foreground"
                              onClick={handleCopyPngUrl}
                            >
                              <Image className="h-3 w-3" />
                              <span className="hidden md:inline">PNG</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Copy public PNG URL</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      {isMarkdown && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1 gap-1 text-xs text-muted-foreground hover:text-foreground"
                              onClick={handleCopyPdfUrl}
                            >
                              <FileText className="h-3 w-3" />
                              <span className="hidden md:inline">PDF</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Copy public PDF URL</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      {selectedDocument.import_url && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1 gap-1 text-xs text-muted-foreground hover:text-foreground"
                              onClick={handleReloadFromUrl}
                              disabled={isReloading}
                            >
                              <RefreshCw className={`h-3 w-3 ${isReloading ? 'animate-spin' : ''}`} />
                              <span className="hidden md:inline">Reload</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Reload document from original URL</p>
                            <p className="text-xs text-muted-foreground">{selectedDocument.import_url}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                  
                  <div className="hidden lg:flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Created: {formatDate(selectedDocument.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Updated: {formatDate(selectedDocument.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground">No document selected</h3>
                  <span className="hidden sm:inline text-xs text-muted-foreground">— Select a document from the workspace panel</span>
                </div>
              </div>
            )}

            <Separator className="my-3" />

            {/* Controls Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => toggleVersionHistory(true)}
                  className="gap-1 md:gap-2 h-8 text-xs md:text-sm"
                  disabled={!selectedDocument}
                >
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">Versions</span>
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsNotationsPanelOpen(true)}
                  className="gap-1 md:gap-2 relative h-8 text-xs md:text-sm"
                  disabled={!selectedDocument}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Notations</span>
                  {activeNotationCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-xs">
                      {activeNotationCount}
                    </Badge>
                  )}
                </Button>

                {!isDiagram && !isMarkdown && (
                  <QADialog 
                    schema={schema}
                    documentName={selectedDocument?.name}
                    disabled={!selectedDocument}
                    selectedDocument={selectedDocument}
                  />
                )}

                {/* Styles button for diagram and markdown */}
                {supportsStyles && onOpenStyles && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onOpenStyles}
                    className="gap-1 md:gap-2 h-8 text-xs md:text-sm"
                    disabled={!selectedDocument}
                  >
                    <Palette className="h-4 w-4" />
                    <span className="hidden sm:inline">Styles</span>
                  </Button>
                )}

                {/* Diagram-specific buttons */}
                {isDiagram && (
                  <>
                    {onImportOpenApi && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={onImportOpenApi}
                        className="gap-1 md:gap-2 h-8 text-xs md:text-sm"
                        disabled={!selectedDocument}
                      >
                        <Upload className="h-4 w-4" />
                        <span className="hidden sm:inline">Import OpenAPI</span>
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsRenderDialogOpen(true)}
                      className="gap-1 md:gap-2 h-8 text-xs md:text-sm"
                      disabled={!selectedDocument}
                      title="Render diagram as PNG"
                    >
                      <Image className="h-4 w-4" />
                      <span className="hidden sm:inline">Render</span>
                    </Button>
                  </>
                )}

                {/* Markdown-specific buttons */}
                {isMarkdown && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsRenderDialogOpen(true)}
                    className="gap-1 md:gap-2 h-8 text-xs md:text-sm"
                    disabled={!selectedDocument}
                    title="Render document as PDF"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Render PDF</span>
                  </Button>
                )}

                {/* OpenAPI-specific buttons */}
                {schemaType === 'openapi' && (
                  <>
                    <RedoclyDialog 
                      schema={schema}
                      documentName={selectedDocument?.name}
                      disabled={!selectedDocument}
                    />
                    
                    <OpenAPISplitDialog
                      schema={schema}
                      documentName={selectedDocument?.name}
                      selectedDocument={selectedDocument}
                      disabled={!selectedDocument}
                      setSchema={setSchema}
                    />
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                {/* Hierarchy Depth Control */}
                <div className="flex items-center gap-2 md:gap-3">
                  <Label htmlFor="max-depth" className="text-xs text-muted-foreground whitespace-nowrap">
                    <span className="hidden md:inline">Hierarchy Depth: </span>
                    <span className="md:hidden">Depth: </span>
                    {maxDepth}
                  </Label>
                  <Slider
                    id="max-depth"
                    min={1}
                    max={10}
                    step={1}
                    value={[maxDepth]}
                    onValueChange={([value]) => {
                      debugToast('[DEBUG] Slider changed to', value);
                      updateMaxDepth(value);
                    }}
                    className="w-16 md:w-28"
                    disabled={!selectedDocument}
                  />
                </div>

                {/* Close Button */}
                {selectedDocument && onClose && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onClose}
                    className="h-8 px-2"
                    title="Close document"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <NotationsPanel
          isOpen={isNotationsPanelOpen}
          onClose={() => setIsNotationsPanelOpen(false)}
          groupedNotations={groupedNotations}
          onAddNotation={handleAddNotation}
          onReplyToNotation={handleReplyToNotation}
        />

        <UrlAuthDialog
          open={authDialogOpen}
          onOpenChange={setAuthDialogOpen}
          onAuthenticate={handleAuthenticate}
          url={pendingUrl}
        />

        {selectedDocument?.file_type === 'diagram' && (() => {
          try {
            const parsedSchema = JSON.parse(schema);
            return (
              <DiagramRenderDialog
                open={isRenderDialogOpen}
                onOpenChange={setIsRenderDialogOpen}
                documentId={selectedDocument.id}
                data={parsedSchema?.data || { lifelines: [], nodes: [] }}
                styles={parsedSchema?.styles}
                diagramRef={diagramRef}
              />
            );
          } catch (e) {
            console.error('Failed to parse diagram schema:', e);
            return null;
          }
        })()}

        {selectedDocument?.file_type === 'markdown' && (() => {
          try {
            const parsedSchema = JSON.parse(schema);
            return (
              <MarkdownRenderDialog
                open={isRenderDialogOpen}
                onOpenChange={setIsRenderDialogOpen}
                documentId={selectedDocument.id}
                document={parsedSchema}
              />
            );
          } catch (e) {
            console.error('Failed to parse markdown schema:', e);
            return null;
          }
        })()}

        {/* Document Information Dialog */}
        <DocumentInformationDialog
          isOpen={isDocInfoDialogOpen}
          onOpenChange={setIsDocInfoDialogOpen}
          document={selectedDocument}
        />
      </div>
    </TooltipProvider>
  );
};
