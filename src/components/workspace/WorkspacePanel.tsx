import React, { useState } from 'react';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useDocuments } from '@/hooks/useDocuments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  FolderPlus, 
  FileText, 
  Upload, 
  Download,
  Trash2,
  Edit,
  Folder,
  File
} from 'lucide-react';
import { toast } from 'sonner';

interface WorkspacePanelProps {
  onDocumentSelect: (document: any) => void;
  selectedDocument?: any;
  isCollapsed?: boolean;
}

export function WorkspacePanel({ onDocumentSelect, selectedDocument, isCollapsed }: WorkspacePanelProps) {
  const { workspaces, createWorkspace, deleteWorkspace } = useWorkspaces();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const { documents, createDocument, deleteDocument } = useDocuments(selectedWorkspace);
  
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
  const [newDocumentName, setNewDocumentName] = useState('');
  const [newDocumentType, setNewDocumentType] = useState<'json-schema' | 'openapi'>('json-schema');
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    
    const workspace = await createWorkspace({
      name: newWorkspaceName,
      description: newWorkspaceDesc,
    });
    
    if (workspace) {
      setNewWorkspaceName('');
      setNewWorkspaceDesc('');
      setShowWorkspaceDialog(false);
      setSelectedWorkspace(workspace.id);
    }
  };

  const handleCreateDocument = async () => {
    if (!newDocumentName.trim() || !selectedWorkspace) return;
    
    const defaultContent = newDocumentType === 'openapi' 
      ? {
          openapi: '3.1.0',
          info: { title: 'API', version: '1.0.0' },
          paths: {}
        }
      : {
          type: 'object',
          properties: {}
        };

    const document = await createDocument({
      workspace_id: selectedWorkspace,
      name: newDocumentName,
      content: defaultContent,
      file_type: newDocumentType,
    });
    
    if (document) {
      setNewDocumentName('');
      setShowDocumentDialog(false);
      onDocumentSelect(document);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedWorkspace) return;

    try {
      const text = await file.text();
      const content = JSON.parse(text);
      
      // Detect file type
      const fileType = content.openapi || content.swagger ? 'openapi' : 'json-schema';
      
      const document = await createDocument({
        workspace_id: selectedWorkspace,
        name: file.name.replace(/\.(json|yaml|yml)$/, ''),
        content,
        file_type: fileType,
      });
      
      if (document) {
        onDocumentSelect(document);
      }
    } catch (err) {
      toast.error('Failed to import file - invalid JSON');
    }
    
    // Reset file input
    event.target.value = '';
  };

  const handleDocumentExport = (document: any) => {
    const dataStr = JSON.stringify(document.content, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${document.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Don't render content if collapsed
  if (isCollapsed) {
    return null;
  }

  return (
    <div className="h-full p-4">
      <Card className="h-full flex flex-col border-0 shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Workspaces</CardTitle>
            <Dialog open={showWorkspaceDialog} onOpenChange={setShowWorkspaceDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="animate-fade-in">
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Workspace</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="workspace-name">Name</Label>
                    <Input
                      id="workspace-name"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      placeholder="My Workspace"
                    />
                  </div>
                  <div>
                    <Label htmlFor="workspace-desc">Description (optional)</Label>
                    <Textarea
                      id="workspace-desc"
                      value={newWorkspaceDesc}
                      onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                      placeholder="Workspace description..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowWorkspaceDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateWorkspace}>Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Workspace Selection */}
        <div className="space-y-2">
          <Label>Select Workspace</Label>
          <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a workspace..." />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  <div className="flex items-center">
                    <Folder className="h-4 w-4 mr-2" />
                    {workspace.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedWorkspace && (
          <>
            <Separator />
            
            {/* Document Actions */}
            <div className="flex gap-2">
                <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="flex-1 animate-scale-in">
                      <Plus className="h-4 w-4 mr-2" />
                      New Document
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Document</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="document-name">Name</Label>
                      <Input
                        id="document-name"
                        value={newDocumentName}
                        onChange={(e) => setNewDocumentName(e.target.value)}
                        placeholder="My Schema"
                      />
                    </div>
                    <div>
                      <Label htmlFor="document-type">Type</Label>
                      <Select value={newDocumentType} onValueChange={(value: 'json-schema' | 'openapi') => setNewDocumentType(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="json-schema">JSON Schema</SelectItem>
                          <SelectItem value="openapi">OpenAPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowDocumentDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateDocument}>Create</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button size="sm" variant="outline" asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                  <input
                    type="file"
                    accept=".json,.yaml,.yml"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>

            {/* Document List */}
            <div className="flex-1">
              <Label className="text-sm font-medium">Documents</Label>
              <ScrollArea className="h-64 mt-2 border rounded-md">
                <div className="p-2 space-y-1">
                  {documents.map((document) => (
                    <div
                      key={document.id}
                      className={`flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer transition-all duration-200 hover-scale ${
                        selectedDocument?.id === document.id ? 'bg-accent animate-fade-in' : ''
                      }`}
                      onClick={() => onDocumentSelect(document)}
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        <File className="h-4 w-4 mr-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {document.name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {document.file_type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDocumentExport(document);
                          }}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDocument(document.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No documents yet</p>
                      <p className="text-xs">Create or import your first document</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
        </CardContent>
      </Card>
    </div>
  );
}