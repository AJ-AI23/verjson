
import React, { useState } from 'react';
import { Save, MessageCircle, FileText, Calendar, Clock, Copy, X, Share, Download, RefreshCw, Palette } from 'lucide-react';
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
import { DebugToggle } from '@/components/DebugToggle';
import { QADialog } from '@/components/QADialog';
import { OpenAPISplitDialog } from '@/components/OpenAPISplitDialog';
import { DocumentConfigDialog } from '@/components/DocumentConfigDialog';
import { UrlAuthDialog } from '@/components/workspace/UrlAuthDialog';
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
}) => {
  const { debugToast } = useDebug();
  const { updateMaxDepth } = useEditorSettings();
  const [isNotationsPanelOpen, setIsNotationsPanelOpen] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string>('');
  
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
    return fileType === 'openapi' ? 'OpenAPI' : 'JSON Schema';
  };

  const isDiagram = selectedDocument?.file_type === 'diagram';

  return (
    <TooltipProvider>
      <div className="mb-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3">
            {/* Document Information Section */}
            {selectedDocument ? (
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <DocumentConfigDialog 
                        document={selectedDocument}
                        onDocumentUpdate={onDocumentUpdate || (() => {})}
                        disabled={!selectedDocument}
                      />
                      {getFileTypeIcon(selectedDocument.file_type)}
                      <h3 className="font-semibold text-foreground truncate">
                        {selectedDocument.name}
                      </h3>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopyId(selectedDocument.id)}
                          >
                            <Copy className="h-3 w-3" />
                            ID
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
                            URL
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy public JSON URL</p>
                        </TooltipContent>
                      </Tooltip>
                      
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
                              Reload
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Reload document from original URL</p>
                            <p className="text-xs text-muted-foreground">{selectedDocument.import_url}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      <Badge variant="secondary" className="text-xs">
                        {getFileTypeLabel(selectedDocument.file_type)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                  <span className="text-xs text-muted-foreground">— Select a document from the workspace panel</span>
                </div>
              </div>
            )}

            <Separator className="my-3" />

            {/* Controls Section */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => toggleVersionHistory(true)}
                  className="gap-2 h-8"
                  disabled={!selectedDocument}
                >
                  <Save className="h-4 w-4" />
                  <span>History</span>
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsNotationsPanelOpen(true)}
                  className="gap-2 relative h-8"
                  disabled={!selectedDocument}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Notations</span>
                  {activeNotationCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-xs">
                      {activeNotationCount}
                    </Badge>
                  )}
                </Button>

                {!isDiagram && (
                  <QADialog 
                    schema={schema}
                    documentName={selectedDocument?.name}
                    disabled={!selectedDocument}
                    selectedDocument={selectedDocument}
                  />
                )}

                {/* Diagram-specific buttons */}
                {isDiagram && onOpenStyles && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onOpenStyles}
                    className="gap-2 h-8"
                    disabled={!selectedDocument}
                  >
                    <Palette className="h-4 w-4" />
                    <span>Styles</span>
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

              <div className="flex items-center gap-3">
                {/* Hierarchy Depth Control */}
                <div className="flex items-center gap-3">
                  <Label htmlFor="max-depth" className="text-xs text-muted-foreground whitespace-nowrap">
                    Hierarchy Depth: {maxDepth}
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
                    className="w-28"
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
      </div>
    </TooltipProvider>
  );
};
