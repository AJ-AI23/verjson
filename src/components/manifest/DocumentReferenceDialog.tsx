import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Link2, ExternalLink, Search, Loader2 } from 'lucide-react';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useDocuments } from '@/hooks/useDocuments';
import { cn } from '@/lib/utils';

export type ReferenceMode = 'embed' | 'link';

interface DocumentReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ReferenceMode;
  onSelect: (reference: string, documentName?: string) => void;
}

export const DocumentReferenceDialog: React.FC<DocumentReferenceDialogProps> = ({
  open,
  onOpenChange,
  mode,
  onSelect,
}) => {
  const [activeTab, setActiveTab] = useState<'workspace' | 'url'>('workspace');
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocumentName, setSelectedDocumentName] = useState<string>('');

  const { workspaces, loading: loadingWorkspaces } = useWorkspaces();
  const { documents, loading: loadingDocuments } = useDocuments(selectedWorkspaceId || undefined);

  // Auto-select first workspace
  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setUrlInput('');
      setSearchQuery('');
      setSelectedDocumentId(null);
      setSelectedDocumentName('');
    }
  }, [open]);

  const filteredDocuments = documents.filter(doc => {
    if (!searchQuery) return true;
    return doc.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleConfirm = () => {
    if (activeTab === 'workspace' && selectedDocumentId) {
      const ref = mode === 'embed' 
        ? `embed://${selectedDocumentId}`
        : `document://${selectedDocumentId}`;
      onSelect(ref, selectedDocumentName);
      onOpenChange(false);
    } else if (activeTab === 'url' && urlInput.trim()) {
      onSelect(urlInput.trim());
      onOpenChange(false);
    }
  };

  const isConfirmDisabled = activeTab === 'workspace' 
    ? !selectedDocumentId 
    : !urlInput.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'embed' ? (
              <>
                <FileText className="h-5 w-5" />
                Embed Document
              </>
            ) : (
              <>
                <Link2 className="h-5 w-5" />
                Link Document
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'embed' 
              ? 'Select a document to embed its content inline'
              : 'Select a document to create a reference link'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'workspace' | 'url')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="workspace">From Workspace</TabsTrigger>
            <TabsTrigger value="url">From URL</TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="space-y-4 mt-4">
            {/* Workspace selector */}
            {workspaces.length > 1 && (
              <div className="space-y-2">
                <Label>Workspace</Label>
                <select
                  value={selectedWorkspaceId || ''}
                  onChange={(e) => {
                    setSelectedWorkspaceId(e.target.value);
                    setSelectedDocumentId(null);
                    setSelectedDocumentName('');
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Document list */}
            <ScrollArea className="h-[200px] border rounded-md">
              {loadingWorkspaces || loadingDocuments ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No documents found</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredDocuments.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setSelectedDocumentId(doc.id);
                        setSelectedDocumentName(doc.name);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                        selectedDocumentId === doc.id
                          ? "bg-primary/10 border border-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {doc.file_type}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {selectedDocumentId && (
              <div className="p-2 bg-muted/50 rounded-md text-xs text-muted-foreground">
                Reference: <code className="bg-muted px-1 py-0.5 rounded">
                  {mode === 'embed' ? 'embed://' : 'document://'}{selectedDocumentId}
                </code>
              </div>
            )}
          </TabsContent>

          <TabsContent value="url" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="url-input">Document URL</Label>
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  id="url-input"
                  placeholder="https://example.com/document.json"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isConfirmDisabled) {
                      handleConfirm();
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the URL of a markdown or VerjSON document
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isConfirmDisabled}>
            {mode === 'embed' ? 'Embed' : 'Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
