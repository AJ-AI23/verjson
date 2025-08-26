import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  UserPlus, 
  Users, 
  Crown, 
  Edit3, 
  Eye, 
  MoreHorizontal,
  Trash2 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDocumentPermissions, DocumentPermission } from '@/hooks/useDocumentPermissions';
import { InviteCollaboratorDialog } from './InviteCollaboratorDialog';
import { Document } from '@/types/workspace';

interface CollaboratorsPanelProps {
  document: Document | null;
  isOwner: boolean;
}

export function CollaboratorsPanel({ document, isOwner }: CollaboratorsPanelProps) {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const { 
    permissions, 
    loading, 
    inviteCollaborator, 
    updatePermission, 
    removePermission 
  } = useDocumentPermissions(document?.id);

  if (!document) {
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

  const handleInvite = async (email: string, role: 'editor' | 'viewer') => {
    return await inviteCollaborator(email, document.name, role);
  };

  const handleRoleChange = async (permission: DocumentPermission, newRole: 'editor' | 'viewer') => {
    await updatePermission(permission.id, newRole);
  };

  const handleRemoveCollaborator = async (permission: DocumentPermission) => {
    await removePermission(permission.id);
  };

  return (
    <>
      <Accordion type="single" collapsible className="w-full" defaultValue="collaborators">
        <AccordionItem value="collaborators" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full mr-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Collaborators
                <Badge variant="secondary" className="ml-2">
                  {permissions.length + 1}
                </Badge>
              </div>
              {isOwner && (
                <Button 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInviteDialog(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Invite
                </Button>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading collaborators...</p>
              ) : (
                <>
                  {/* Owner */}
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium">Owner</span>
                      </div>
                      <Badge className={getRoleColor('owner')}>
                        Owner
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">You</span>
                  </div>

                  {/* Collaborators */}
                  {permissions.map((permission) => (
                    <div key={permission.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {getRoleIcon(permission.role)}
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">
                              {permission.user_name || permission.user_email}
                            </span>
                            {permission.user_name && (
                              <span className="text-xs text-muted-foreground truncate">
                                {permission.user_email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isOwner ? (
                          <>
                            <Select
                              value={permission.role}
                              onValueChange={(value: 'editor' | 'viewer') => 
                                handleRoleChange(permission, value)
                              }
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => handleRemoveCollaborator(permission)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove Access
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        ) : (
                          <Badge className={getRoleColor(permission.role)}>
                            {permission.role}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}

                  {permissions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No collaborators yet. {isOwner ? 'Invite someone to get started!' : ''}
                    </p>
                  )}
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <InviteCollaboratorDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onInvite={handleInvite}
        documentName={document.name}
      />
    </>
  );
}