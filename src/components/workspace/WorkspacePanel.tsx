import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { CollaboratorsPanel } from './CollaboratorsPanel';
import { BulkInviteDialog } from './BulkInviteDialog';
import { BulkExportDialog } from './BulkExportDialog';
import { WorkspaceInviteDialog } from './WorkspaceInviteDialog';
import { DocumentPinSetupDialog } from './DocumentPinSetupDialog';
import { useWorkspacePermissions } from '@/hooks/useWorkspacePermissions';
import { useDocumentPinSecurity } from '@/hooks/useDocumentPinSecurity';
import { 
  Plus, 
  FolderPlus, 
  FileText, 
  Upload, 
  Download,
  Trash2,
  Edit,
  Folder,
  File,
  Users,
  UserPlus,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';

interface WorkspacePanelProps {
  onDocumentSelect: (document: any) => void;
  onDocumentDeleted: (deletedDocumentId: string) => void;
  selectedDocument?: any;
  isCollapsed?: boolean;
}

export function WorkspacePanel({ onDocumentSelect, onDocumentDeleted, selectedDocument, isCollapsed }: WorkspacePanelProps) {
  const { user } = useAuth();
  const { workspaces, createWorkspace, deleteWorkspace } = useWorkspaces();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const { documents, createDocument, deleteDocument } = useDocuments(selectedWorkspace);
  const { inviteToWorkspace, inviteBulkDocuments } = useWorkspacePermissions(selectedWorkspace);
  const { checkDocumentPinStatus } = useDocumentPinSecurity();
  
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);
  const [workspaceDeleteDialogOpen, setWorkspaceDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<any>(null);
  const [newDocumentName, setNewDocumentName] = useState('');
  const [newDocumentType, setNewDocumentType] = useState<'json-schema' | 'openapi'>('json-schema');
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  
  // New invitation dialog states
  const [showWorkspaceInviteDialog, setShowWorkspaceInviteDialog] = useState(false);
  const [showBulkInviteDialog, setShowBulkInviteDialog] = useState(false);
  const [showBulkExportDialog, setShowBulkExportDialog] = useState(false);
  
  // PIN security dialog states
  const [showPinSetupDialog, setShowPinSetupDialog] = useState(false);
  const [pinSetupDocument, setPinSetupDocument] = useState<any>(null);
  const [documentPinStatus, setDocumentPinStatus] = useState<{[key: string]: boolean}>({});

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
    console.log('🔽 Export button clicked, document:', document);
    console.log('🔽 Document content:', document?.content);
    console.log('🔽 Document name:', document?.name);
    console.log('🔽 Document ID:', document?.id);
    
    if (!document) {
      console.error('❌ Export failed: Document is null/undefined');
      toast.error('Cannot export - document is missing');
      return;
    }
    
    if (!document.content) {
      console.error('❌ Export failed: Document content is missing');
      toast.error('Cannot export - document content is missing');
      return;
    }
    
    if (!document.name) {
      console.error('❌ Export failed: Document name is missing');
      toast.error('Cannot export - document name is missing');
      return;
    }
    
    if (!document.id) {
      console.error('❌ Export failed: Document ID is missing');
      toast.error('Cannot export - document ID is missing');
      return;
    }
    
    try {
      console.log('🔽 Starting JSON stringify...');
      const dataStr = JSON.stringify(document.content, null, 2);
      console.log('🔽 JSON stringify completed, length:', dataStr.length);
      
      console.log('🔽 Creating blob...');
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      console.log('🔽 Blob created, size:', dataBlob.size);
      
      console.log('🔽 Creating object URL...');
      const url = URL.createObjectURL(dataBlob);
      console.log('🔽 Object URL created:', url);
      
      console.log('🔽 Creating download link...');
      const link = document.createElement('a');
      link.href = url;
      link.download = `${document.name}_${document.id}.json`;
      link.style.display = 'none'; // Hide the link
      
      console.log('🔽 Download filename:', link.download);
      console.log('🔽 Download href:', link.href);
      
      // Append to body to ensure it works in all browsers
      document.body.appendChild(link);
      console.log('🔽 Link appended to body');
      
      console.log('🔽 Triggering click...');
      link.click();
      console.log('🔽 Click triggered');
      
      console.log('🔽 Cleaning up...');
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('🔽 Cleanup completed');
      
      console.log('✅ Export completed successfully');
      toast.success(`Document exported: ${document.name}_${document.id}.json`);
    } catch (error) {
      console.error('❌ Export error details:', error);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error stack:', error?.stack);
      toast.error(`Failed to export document: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleConfirmDelete = () => {
    if (documentToDelete) {
      deleteDocument(documentToDelete.id);
      onDocumentDeleted(documentToDelete.id);
      setDocumentToDelete(null);
    }
  };

  const handleConfirmWorkspaceDelete = async () => {
    if (workspaceToDelete) {
      await deleteWorkspace(workspaceToDelete.id);
      setWorkspaceToDelete(null);
      // Clear selected workspace if it was the deleted one
      if (selectedWorkspace === workspaceToDelete.id) {
        setSelectedWorkspace('');
      }
    }
  };

  const isDocumentOwner = selectedDocument && user ? selectedDocument.user_id === user.id : false;
  const isWorkspaceOwner = selectedWorkspace && workspaces.find(w => w.id === selectedWorkspace)?.user_id === user?.id;

  const handleWorkspaceInvite = async (email: string, role: 'editor' | 'viewer') => {
    const workspace = workspaces.find(w => w.id === selectedWorkspace);
    if (!workspace) return false;
    return await inviteToWorkspace(email, workspace.name, role);
  };

  const handleBulkDocumentInvite = async (email: string, documentIds: string[], role: 'editor' | 'viewer') => {
    return await inviteBulkDocuments(email, documentIds, role);
  };

  const handleBulkExport = async (selectedDocuments: any[]) => {
    try {
      const zip = new JSZip();
      
      // Add each document to the ZIP file with document ID appended
      selectedDocuments.forEach(document => {
        const jsonContent = JSON.stringify(document.content, null, 2);
        const filename = `${document.name}_${document.id}.json`;
        zip.file(filename, jsonContent);
      });
      
      // Generate the ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `documents-export-${new Date().toISOString().split('T')[0]}.zip`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Exported ${selectedDocuments.length} document${selectedDocuments.length !== 1 ? 's' : ''} as ZIP file`);
    } catch (error) {
      toast.error('Failed to create ZIP file');
    }
  };

  const handlePinSetup = async (document: any) => {
    const status = await checkDocumentPinStatus(document.id);
    setDocumentPinStatus(prev => ({ ...prev, [document.id]: status.hasPin }));
    setPinSetupDocument(document);
    setShowPinSetupDialog(true);
  };

  const handlePinStatusChange = async () => {
    if (pinSetupDocument) {
      const status = await checkDocumentPinStatus(pinSetupDocument.id);
      setDocumentPinStatus(prev => ({ ...prev, [pinSetupDocument.id]: status.hasPin }));
    }
  };

  // Don't render content if collapsed
  if (isCollapsed) {
    return null;
  }

  return (
    <div className="h-full p-4 space-y-4">
      <Card className="flex-1 flex flex-col border-0 shadow-none">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <CardTitle className="text-lg">Workspaces</CardTitle>
            
            <Dialog open={showWorkspaceDialog} onOpenChange={setShowWorkspaceDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="animate-fade-in w-full">
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Workspace
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
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center min-w-0 flex-1">
                      <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{workspace.name}</span>
                    </div>
                    {workspace.user_id === user?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWorkspaceToDelete(workspace);
                          setWorkspaceDeleteDialogOpen(true);
                        }}
                        className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground flex-shrink-0 ml-2"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
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
            <div className="flex flex-col gap-2">
              <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full animate-scale-in">
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
            </div>

            {/* Document List */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Documents</Label>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild title="Import">
                    <label className="cursor-pointer">
                      <Upload className="h-3 w-3" />
                      <input
                        type="file"
                        accept=".json,.yaml,.yml"
                        onChange={handleFileImport}
                        className="hidden"
                      />
                    </label>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 w-7 p-0"
                    onClick={() => setShowBulkExportDialog(true)}
                    disabled={documents.length === 0}
                    title="Export Multiple"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-64 border rounded-md">
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
                            {documentPinStatus[document.id] && (
                              <div title="PIN Protected">
                                <Shield className="h-3 w-3 text-amber-600" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                       <div className="flex gap-0.5 flex-shrink-0">
                         <Button
                           size="sm"
                           variant="ghost"
                           onClick={(e) => {
                             e.stopPropagation();
                             console.log('🔽 Export button clicked for document:', document.name);
                             handleDocumentExport(document);
                           }}
                           className="h-6 w-6 p-0 hover:bg-accent-foreground/10 hover:text-accent-foreground transition-colors"
                           title="Export"
                         >
                           <Download className="h-3 w-3" />
                         </Button>
                         {isDocumentOwner && selectedDocument?.id === document.id && (
                           <Button
                             size="sm"
                             variant="ghost"
                             onClick={(e) => {
                               e.stopPropagation();
                               handlePinSetup(document);
                             }}
                             className="h-6 w-6 p-0 hover:bg-accent-foreground/10 hover:text-accent-foreground transition-colors"
                             title="Security Settings"
                           >
                             <Shield className="h-3 w-3" />
                           </Button>
                         )}
                         <Button
                           size="sm"
                           variant="ghost"
                           onClick={(e) => {
                             e.stopPropagation();
                             setDocumentToDelete(document);
                             setDeleteDialogOpen(true);
                           }}
                           className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                           title="Delete"
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

      {/* Workspace Actions */}
      {isWorkspaceOwner && selectedWorkspace && (
        <div className="flex justify-center mb-4">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setShowBulkInviteDialog(true)}
            disabled={documents.length === 0}
          >
            <Users className="h-4 w-4 mr-2" />
            Bulk Invite Documents
          </Button>
        </div>
      )}

      <CollaboratorsPanel 
        document={selectedDocument}
        isOwner={isDocumentOwner}
      />

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirmDelete={handleConfirmDelete}
        documentName={documentToDelete?.name || ''}
      />

      <DeleteConfirmationDialog
        open={workspaceDeleteDialogOpen}
        onOpenChange={setWorkspaceDeleteDialogOpen}
        onConfirmDelete={handleConfirmWorkspaceDelete}
        documentName={workspaceToDelete?.name || ''}
        title="Delete Workspace"
        description={`Are you sure you want to delete workspace "${workspaceToDelete?.name}"? This will also delete all documents within this workspace. This action cannot be undone.`}
      />

      <WorkspaceInviteDialog
        open={showWorkspaceInviteDialog}
        onOpenChange={setShowWorkspaceInviteDialog}
        onInvite={handleWorkspaceInvite}
        workspaceName={workspaces.find(w => w.id === selectedWorkspace)?.name || ''}
      />

      <BulkInviteDialog
        open={showBulkInviteDialog}
        onOpenChange={setShowBulkInviteDialog}
        onInvite={handleBulkDocumentInvite}
        documents={documents}
      />

      <DocumentPinSetupDialog
        open={showPinSetupDialog}
        onOpenChange={setShowPinSetupDialog}
        documentId={pinSetupDocument?.id || ''}
        documentName={pinSetupDocument?.name || ''}
        currentlyHasPin={pinSetupDocument ? (documentPinStatus[pinSetupDocument.id] || false) : false}
        onPinStatusChange={handlePinStatusChange}
      />

      <BulkExportDialog
        open={showBulkExportDialog}
        onOpenChange={setShowBulkExportDialog}
        documents={documents}
        onExport={handleBulkExport}
      />
    </div>
  );
}