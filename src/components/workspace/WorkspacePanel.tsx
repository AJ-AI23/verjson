import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useDocuments } from '@/hooks/useDocuments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { CollaboratorsPanel } from './CollaboratorsPanel';
import { BulkInviteDialog } from './BulkInviteDialog';
import { BulkExportDialog } from './BulkExportDialog';
import { ImportDialog } from './ImportDialog';
import { WorkspaceInviteDialog } from './WorkspaceInviteDialog';
import { DocumentPinSetupDialog } from './DocumentPinSetupDialog';
import { DocumentMergeDialog } from './DocumentMergeDialog';
import { useWorkspacePermissions } from '@/hooks/useWorkspacePermissions';
import { useDocumentPinSecurity } from '@/hooks/useDocumentPinSecurity';
import { useSharedDocuments } from '@/hooks/useSharedDocuments';
import { VIRTUAL_SHARED_WORKSPACE_ID } from '@/hooks/useDocuments';
import { useDebug } from '@/contexts/DebugContext';
import { supabase } from '@/integrations/supabase/client';
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
  Shield,
  GitMerge,
  Share
 } from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { defaultSchema } from '@/lib/defaultSchema';
import { defaultOasSchema } from '@/lib/defaultOasSchema';

interface WorkspacePanelProps {
  onDocumentSelect: (document: any) => void;
  onDocumentDeleted: (deletedDocumentId: string) => void;
  selectedDocument?: any;
  isCollapsed?: boolean;
}

export function WorkspacePanel({ onDocumentSelect, onDocumentDeleted, selectedDocument, isCollapsed }: WorkspacePanelProps) {
  const { debugToast } = useDebug();
  const { user } = useAuth();
  const { workspaces, createWorkspace, updateWorkspace, deleteWorkspace } = useWorkspaces();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  
  console.log('[WorkspacePanel] Selected workspace:', selectedWorkspace);
  const { documents, createDocument, deleteDocument } = useDocuments(selectedWorkspace);
  console.log('[WorkspacePanel] Documents for workspace:', selectedWorkspace, 'count:', documents.length);
  console.log('[WorkspacePanel] Document details:', documents.map(d => ({ id: d.id, name: d.name, workspace_id: d.workspace_id })));
  
  // Get shared documents count for virtual workspace visibility
  const { documents: sharedDocuments } = useSharedDocuments();
  const hasSharedDocuments = sharedDocuments.length > 0;
  const isVirtualSharedWorkspace = selectedWorkspace === VIRTUAL_SHARED_WORKSPACE_ID;
  
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
  const [showCreateDocumentDialog, setShowCreateDocumentDialog] = useState(false);
  
  // New invitation dialog states
  const [showWorkspaceInviteDialog, setShowWorkspaceInviteDialog] = useState(false);
  const [showBulkInviteDialog, setShowBulkInviteDialog] = useState(false);
  const [showBulkExportDialog, setShowBulkExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  
  // Workspace edit dialog state
  const [showWorkspaceEditDialog, setShowWorkspaceEditDialog] = useState(false);
  const [workspaceToEdit, setWorkspaceToEdit] = useState<any>(null);
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [editWorkspaceDesc, setEditWorkspaceDesc] = useState('');
  
  // PIN security dialog states
  const [showPinSetupDialog, setShowPinSetupDialog] = useState(false);
  const [pinSetupDocument, setPinSetupDocument] = useState<any>(null);
  const [documentPinStatus, setDocumentPinStatus] = useState<{[key: string]: boolean}>({});
  const [documentPermissions, setDocumentPermissions] = useState<Record<string, any[]>>({});

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
      ? JSON.parse(defaultOasSchema)
      : JSON.parse(defaultSchema);

    const document = await createDocument({
      workspace_id: selectedWorkspace,
      name: newDocumentName,
      content: defaultContent,
      file_type: newDocumentType,
    });
    
    if (document) {
      setNewDocumentName('');
      setShowCreateDocumentDialog(false);
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

  const handleDocumentExport = (doc: any) => {
    debugToast('🔽 Export button clicked, document', doc);
    debugToast('🔽 Document content', doc?.content);
    debugToast('🔽 Document name', doc?.name);
    debugToast('🔽 Document ID', doc?.id);
    
    if (!doc) {
      console.error('❌ Export failed: Document is null/undefined');
      toast.error('Cannot export - document is missing');
      return;
    }
    
    if (!doc.content) {
      console.error('❌ Export failed: Document content is missing');
      toast.error('Cannot export - document content is missing');
      return;
    }
    
    if (!doc.name) {
      console.error('❌ Export failed: Document name is missing');
      toast.error('Cannot export - document name is missing');
      return;
    }
    
    if (!doc.id) {
      console.error('❌ Export failed: Document ID is missing');
      toast.error('Cannot export - document ID is missing');
      return;
    }
    
    try {
      debugToast('🔽 Starting JSON stringify...');
      const dataStr = JSON.stringify(doc.content, null, 2);
      debugToast('🔽 JSON stringify completed, length', dataStr.length);
      
      debugToast('🔽 Creating blob...');
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      debugToast('🔽 Blob created, size', dataBlob.size);
      
      debugToast('🔽 Creating object URL...');
      const url = URL.createObjectURL(dataBlob);
      debugToast('🔽 Object URL created', url);
      
      debugToast('🔽 Creating download link...');
      const link = document.createElement('a');
      link.href = url;
      link.download = `${doc.name}_${doc.id}.json`;
      link.style.display = 'none'; // Hide the link
      
      debugToast('🔽 Download filename', link.download);
      debugToast('🔽 Download href', link.href);
      
      // Append to body to ensure it works in all browsers
      document.body.appendChild(link);
      debugToast('🔽 Link appended to body');
      
      debugToast('🔽 Triggering click...');
      link.click();
      debugToast('🔽 Click triggered');
      
      debugToast('🔽 Cleaning up...');
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      debugToast('🔽 Cleanup completed');
      
      debugToast('✅ Export completed successfully');
      toast.success(`Document exported: ${doc.name}_${doc.id}.json`);
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

  const handleImportFiles = async (filesToImport: any[]) => {
    try {
      for (const file of filesToImport) {
        await createDocument({
          workspace_id: selectedWorkspace,
          name: file.name,
          content: file.content,
          file_type: file.fileType,
        });
      }
      toast.success(`Imported ${filesToImport.length} document${filesToImport.length !== 1 ? 's' : ''} successfully`);
    } catch (error) {
      toast.error('Failed to import some files');
    }
  };

  const handlePinStatusChange = async () => {
    if (pinSetupDocument) {
      const status = await checkDocumentPinStatus(pinSetupDocument.id);
      setDocumentPinStatus(prev => ({ ...prev, [pinSetupDocument.id]: status.hasPin }));
    }
  };

  const handleDocumentMerge = async (mergedSchema: any, resultName: string) => {
    if (!selectedWorkspace) return;
    
    // Detect file type from merged schema
    const fileType = mergedSchema.openapi || mergedSchema.swagger ? 'openapi' : 'json-schema';
    
    const document = await createDocument({
      workspace_id: selectedWorkspace,
      name: resultName,
      content: mergedSchema,
      file_type: fileType,
    });
    
    if (document) {
      onDocumentSelect(document);
      toast.success(`Merged document created: ${resultName}`);
    }
  };

  const handleEditWorkspace = async () => {
    if (!editWorkspaceName.trim() || !workspaceToEdit) return;
    
    const updated = await updateWorkspace(workspaceToEdit.id, {
      name: editWorkspaceName,
      description: editWorkspaceDesc,
    });
    
    if (updated) {
      setShowWorkspaceEditDialog(false);
      setWorkspaceToEdit(null);
      setEditWorkspaceName('');
      setEditWorkspaceDesc('');
      toast.success('Workspace updated successfully');
    }
  };

  // Fetch document permissions for sharing indicators
  useEffect(() => {
    const fetchDocumentPermissions = async () => {
      if (!documents.length) {
        setDocumentPermissions({});
        return;
      }
      
      try {
        // Use the permissions-management edge function for bulk operations
        const { data, error } = await supabase.functions.invoke('permissions-management', {
          body: {
            action: 'getBulkDocumentPermissions',
            documentIds: documents.map(doc => doc.id)
          }
        });

        if (error) throw error;

        setDocumentPermissions(data?.permissionsMap || {});
      } catch (error) {
        console.error('Error fetching bulk document permissions:', error);
        setDocumentPermissions({});
      }
    };

    fetchDocumentPermissions();
  }, [documents]);

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
          <Select value={selectedWorkspace} onValueChange={(value) => {
            console.log('[WorkspacePanel] Workspace selection changed from', selectedWorkspace, 'to', value);
            setSelectedWorkspace(value);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a workspace..." />
            </SelectTrigger>
            <SelectContent>
              {/* Virtual "Shared with me" workspace */}
              {hasSharedDocuments && (
                <SelectItem key={VIRTUAL_SHARED_WORKSPACE_ID} value={VIRTUAL_SHARED_WORKSPACE_ID}>
                  <div className="flex items-center justify-between min-w-0 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <Share className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">Shared with me</span>
                    </div>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {sharedDocuments.length}
                    </Badge>
                  </div>
                </SelectItem>
              )}
              
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  <div className="flex items-center justify-between min-w-0 w-full">
                    <div className="flex items-center min-w-0">
                      <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{workspace.name}</span>
                    </div>
                     {workspace.isOwner ? (
                       workspace.collaboratorCount > 0 && (
                         <Badge variant="secondary" className="ml-2 text-xs">
                           Shared
                         </Badge>
                       )
                     ) : (
                       <Badge variant="secondary" className="ml-2 text-xs">
                         Invited
                       </Badge>
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
                    <DialogTitle>New Document</DialogTitle>
                    <DialogDescription>
                      Choose how you want to create your document
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        className="h-24 flex flex-col gap-2"
                        onClick={() => {
                          setShowDocumentDialog(false);
                          setShowImportDialog(true);
                        }}
                      >
                        <Upload className="h-6 w-6" />
                        <span className="text-sm">Upload Documents</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-24 flex flex-col gap-2"
                        onClick={() => {
                          // Switch to create mode - show the original form
                          setShowDocumentDialog(false);
                          setShowCreateDocumentDialog(true);
                        }}
                      >
                        <FileText className="h-6 w-6" />
                        <span className="text-sm">Create Document</span>
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Workspace Management Actions */}
            {isWorkspaceOwner && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const workspace = workspaces.find(w => w.id === selectedWorkspace);
                    if (workspace) {
                      setWorkspaceToEdit(workspace);
                      setEditWorkspaceName(workspace.name);
                      setEditWorkspaceDesc(workspace.description || '');
                      setShowWorkspaceEditDialog(true);
                    }
                  }}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Workspace
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const workspace = workspaces.find(w => w.id === selectedWorkspace);
                    if (workspace) {
                      setWorkspaceToDelete(workspace);
                      setWorkspaceDeleteDialogOpen(true);
                    }
                  }}
                  className="hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Document List */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Documents</Label>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 w-7 p-0"
                    onClick={() => setShowBulkInviteDialog(true)}
                    disabled={documents.length === 0}
                    title="Bulk Invite to Documents"
                  >
                    <UserPlus className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 w-7 p-0" 
                    onClick={() => setShowImportDialog(true)}
                    title="Import Files"
                  >
                    <Upload className="h-3 w-3" />
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
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 w-7 p-0"
                    onClick={() => setShowMergeDialog(true)}
                    disabled={documents.length < 2}
                    title="Merge Documents"
                  >
                    <GitMerge className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-64 border rounded-md">
                 <div className="p-2 space-y-1">
                   {documents.map((doc) => (
                     <div
                       key={doc.id}
                       className={`flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer transition-all duration-200 hover-scale ${
                         selectedDocument?.id === doc.id ? 'bg-accent animate-fade-in' : ''
                       }`}
                       onClick={() => onDocumentSelect(doc)}
                     >
                       <div className="flex items-center flex-1 min-w-0">
                         <File className="h-4 w-4 mr-2 flex-shrink-0" />
                         <div className="flex-1 min-w-0">
                           <div className="text-sm font-medium truncate">
                             {doc.name}
                           </div>
                           {/* Show workspace context for shared documents */}
                           {(doc as any).is_shared && (doc as any).workspace_name && (
                             <div className="text-xs text-muted-foreground truncate">
                               from {(doc as any).workspace_name}
                             </div>
                           )}
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="text-xs">
                                {doc.file_type}
                              </Badge>
                              {/* Show shared role badge for shared documents */}
                              {(doc as any).is_shared && (
                                <Badge variant="outline" className="text-xs">
                                  {(doc as any).shared_role}
                                </Badge>
                              )}
                              {doc.user_id === user?.id ? (
                                documentPermissions[doc.id]?.length > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    Shared
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  Invited
                                </Badge>
                              )}
                              {documentPinStatus[doc.id] && (
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
                               debugToast('🔽 Export button clicked for document', doc.name);
                               handleDocumentExport(doc);
                             }}
                            className="h-6 w-6 p-0 hover:bg-accent-foreground/10 hover:text-accent-foreground transition-colors"
                            title="Export"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          {/* Hide PIN setup for shared documents */}
                          {!isVirtualSharedWorkspace && isDocumentOwner && selectedDocument?.id === doc.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePinSetup(doc);
                              }}
                              className="h-6 w-6 p-0 hover:bg-accent-foreground/10 hover:text-accent-foreground transition-colors"
                              title="Security Settings"
                            >
                              <Shield className="h-3 w-3" />
                            </Button>
                          )}
                          {/* Hide delete action for shared documents in virtual workspace */}
                          {(!isVirtualSharedWorkspace || !(doc as any).is_shared) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDocumentToDelete(doc);
                                setDeleteDialogOpen(true);
                              }}
                              className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                    </div>
                  ))}
                   {documents.length === 0 && (
                     <div className="text-center py-8 text-muted-foreground">
                       <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                       <p className="text-sm">
                         {isVirtualSharedWorkspace ? "No documents have been shared with you" : "No documents yet"}
                       </p>
                       <p className="text-xs">
                         {isVirtualSharedWorkspace ? "" : "Create or import your first document"}
                       </p>
                     </div>
                   )}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
        </CardContent>
      </Card>


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

      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImportFiles}
      />

      <DocumentMergeDialog
        isOpen={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        documents={documents}
        onMergeConfirm={handleDocumentMerge}
        workspaceName={workspaces.find(w => w.id === selectedWorkspace)?.name}
      />

      <Dialog open={showCreateDocumentDialog} onOpenChange={setShowCreateDocumentDialog}>
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
              <Button variant="outline" onClick={() => setShowCreateDocumentDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateDocument}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showWorkspaceEditDialog} onOpenChange={setShowWorkspaceEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              <div>
                <Label htmlFor="edit-workspace-name">Name</Label>
                <Input
                  id="edit-workspace-name"
                  value={editWorkspaceName}
                  onChange={(e) => setEditWorkspaceName(e.target.value)}
                  placeholder="Workspace name"
                />
              </div>
              <div>
                <Label htmlFor="edit-workspace-desc">Description (optional)</Label>
                <Textarea
                  id="edit-workspace-desc"
                  value={editWorkspaceDesc}
                  onChange={(e) => setEditWorkspaceDesc(e.target.value)}
                  placeholder="Workspace description..."
                />
              </div>
            </div>

            <Separator />

            {/* Collaborator Management */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Collaborators</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowWorkspaceEditDialog(false);
                    setShowWorkspaceInviteDialog(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Collaborator
                </Button>
              </div>
              
              {/* Existing Collaborators */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Workspace collaborators will have access to all documents in this workspace.
                </Label>
                <CollaboratorsPanel 
                  document={null} 
                  workspaceId={selectedWorkspace}
                  isOwner={isWorkspaceOwner}
                  showWorkspaceCollaborators={true}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowWorkspaceEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditWorkspace} disabled={!editWorkspaceName.trim()}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}