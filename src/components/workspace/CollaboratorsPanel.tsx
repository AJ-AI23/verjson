import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  UserPlus, 
  Users, 
  Crown, 
  Edit3, 
  Eye, 
  MoreHorizontal,
  Trash2,
  Settings,
  Folder
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDocumentPermissions, DocumentPermission } from '@/hooks/useDocumentPermissions';
import { useWorkspacePermissions, WorkspacePermission } from '@/hooks/useWorkspacePermissions';

// Extended type for display purposes
type CollaboratorPermission = (DocumentPermission | WorkspacePermission) & {
  isWorkspaceLevel?: boolean;
  hasWorkspaceAccess?: boolean;
  inherited_from?: 'document' | 'workspace';
};
import { InviteCollaboratorDialog } from './InviteCollaboratorDialog';
import { ChangeAccessDialog } from './ChangeAccessDialog';
import { Document } from '@/types/workspace';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface CollaboratorsPanelProps {
  document: Document | null;
  isOwner: boolean;
  workspaceId?: string;
  showWorkspaceCollaborators?: boolean;
}

export function CollaboratorsPanel({ document, isOwner, workspaceId, showWorkspaceCollaborators }: CollaboratorsPanelProps) {
  const { user } = useAuth();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showChangeAccessDialog, setShowChangeAccessDialog] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<CollaboratorPermission | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<{email?: string, full_name?: string, username?: string} | null>(null);
  
  // Use document permissions by default, workspace permissions when specified
  const documentPermissions = useDocumentPermissions(document?.id, document);
  const workspacePermissions = useWorkspacePermissions(workspaceId);
  
  // Use document permissions (which now include inherited workspace permissions)
  const allPermissions = useMemo((): CollaboratorPermission[] => {
    if (showWorkspaceCollaborators) {
      return workspacePermissions.permissions;
    }
    
    // Document permissions now include inheritance, so no need to manually merge
    return documentPermissions.permissions;
  }, [documentPermissions.permissions, workspacePermissions.permissions, showWorkspaceCollaborators]);

  const permissions = showWorkspaceCollaborators ? workspacePermissions : documentPermissions;
  const loading = showWorkspaceCollaborators ? workspacePermissions.loading : (documentPermissions.loading || workspacePermissions.loading);
  
  // Filter out the current user from collaborators since they're shown as owner
  const collaboratorPermissions = allPermissions.filter(permission => permission.user_id !== user?.id);

  // Fetch owner profile information
  React.useEffect(() => {
    const fetchOwnerProfile = async () => {
      // Find owner permission or determine owner
      const ownerPermission = allPermissions.find(p => p.role === 'owner');
      let ownerId = ownerPermission?.user_id;
      
      // If no owner permission found, use document/workspace owner
      if (!ownerId && document?.user_id) {
        ownerId = document.user_id;
      } else if (!ownerId && showWorkspaceCollaborators) {
        // For workspace, we might need to fetch workspace details
        return;
      }
      
      if (ownerId && ownerId !== user?.id) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('full_name, username')
            .eq('user_id', ownerId)
            .maybeSingle();
          
          if (profileError) {
            console.error('Error fetching owner profile:', profileError);
          } else {
            setOwnerProfile(profile);
          }
        } catch (error) {
          console.error('Failed to fetch owner profile:', error);
        }
      }
    };

    fetchOwnerProfile();
  }, [allPermissions, document?.user_id, user?.id, showWorkspaceCollaborators]);

  if (!document && !showWorkspaceCollaborators) {
    return (
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="collaborators" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Collaborators
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <p className="text-sm text-muted-foreground">
              Select a document to manage collaborators
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4" />;
      case 'editor':
        return <Edit3 className="h-4 w-4" />;
      case 'viewer':
        return <Eye className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'editor':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const handleInvite = async (email: string, role: 'editor' | 'viewer', emailNotifications: boolean) => {
    if (showWorkspaceCollaborators && workspaceId) {
      return await workspacePermissions.inviteToWorkspace(email, 'Workspace', role, emailNotifications);
    } else if (document) {
      return await documentPermissions.inviteCollaborator(email, document.name, role, emailNotifications);
    }
    return false;
  };

  const handleChangeAccess = (permission: CollaboratorPermission) => {
    setSelectedPermission(permission);
    setShowChangeAccessDialog(true);
  };

  const handleUpdateRole = async (newRole: 'editor' | 'viewer') => {
    if (selectedPermission) {
      await permissions.updatePermission(selectedPermission.id, newRole);
    }
  };

  const handleRemoveCollaborator = async (permission: CollaboratorPermission) => {
    await permissions.removePermission(permission.id);
  };

  return (
    <>
      <Accordion type="single" collapsible className="w-full" defaultValue="collaborators">
        <AccordionItem value="collaborators" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Collaborators
              <Badge variant="secondary" className="ml-2">
                {collaboratorPermissions.length + 1}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading collaborators...</p>
              ) : (
                <>
                  {/* Owner or Current User Status */}
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {isOwner ? (
                          <>
                            <Crown className="h-4 w-4 text-yellow-600" />
                            <div className="flex flex-col">
                              <span className="font-medium">You</span>
                            </div>
                            <Badge className={getRoleColor('owner')}>
                              Owner
                            </Badge>
                          </>
                        ) : (
                          <>
                            <div className="flex flex-col">
                              <span className="font-medium">Invited</span>
                              <span className="text-xs text-muted-foreground">
                                You have access to this {showWorkspaceCollaborators ? 'workspace' : 'document'}
                              </span>
                            </div>
                            <Badge className={getRoleColor(allPermissions.find(p => p.user_id === user?.id)?.role || 'viewer')}>
                              {allPermissions.find(p => p.user_id === user?.id)?.role || 'Viewer'}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Collaborators */}
                  {collaboratorPermissions.map((permission) => (
                    <div key={permission.id} className="flex items-start justify-between p-3 border rounded-lg gap-3">
                       <div className="flex items-center gap-3 min-w-0 flex-1">
                         <div className="flex items-center gap-2 min-w-0">
                            {getRoleIcon(permission.role)}
                            {permission.inherited_from === 'workspace' && (
                              <Folder className="h-4 w-4 text-muted-foreground" />
                            )}
                           <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">
                                {permission.username ? `@${permission.username}` : (permission.user_name || 'Unknown User')}
                              </span>
                              {(permission.username && permission.user_name) && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {permission.user_name}
                                </span>
                              )}
                           </div>
                         </div>
                       </div>
                      
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <Badge className={getRoleColor(permission.role)}>
                            {permission.role}
                          </Badge>
                           {permission.inherited_from === 'workspace' && (
                             <Badge variant="secondary" className="text-xs">
                               Workspace
                             </Badge>
                           )}
                          
                           {isOwner && permission.inherited_from !== 'workspace' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleChangeAccess(permission)}>
                                  <Settings className="h-4 w-4 mr-2" />
                                  Change Access
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleRemoveCollaborator(permission)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove Access
                                </DropdownMenuItem>
                               </DropdownMenuContent>
                             </DropdownMenu>
                           )}
                           {isOwner && permission.inherited_from === 'workspace' && (
                             <Badge variant="outline" className="text-xs text-muted-foreground">
                               Managed at workspace level
                             </Badge>
                           )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {collaboratorPermissions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No collaborators yet. {isOwner ? 'Invite someone to get started!' : ''}
                    </p>
                  )}
                </>
              )}
              
              {isOwner && (
                <div className="pt-3 border-t">
                  <Button 
                    size="sm" 
                    onClick={() => setShowInviteDialog(true)}
                    className="flex items-center gap-2 w-full"
                  >
                    <UserPlus className="h-4 w-4" />
                    Invite Collaborator
                  </Button>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <InviteCollaboratorDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onInvite={handleInvite}
        documentName={showWorkspaceCollaborators ? 'Workspace' : (document?.name || '')}
      />
      
      <ChangeAccessDialog
        open={showChangeAccessDialog}
        onOpenChange={setShowChangeAccessDialog}
        onUpdateRole={handleUpdateRole}
        permission={selectedPermission}
      />
    </>
  );
}