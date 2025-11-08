import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  FileText, 
  Folder, 
  Files, 
  Check, 
  X, 
  Clock,
  User
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationsContext';
import { Invitation } from '@/hooks/useInvitations';

interface InvitationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvitationsDialog({ open, onOpenChange }: InvitationsDialogProps) {
  const { invitations, invitationsLoading, acceptInvitation, declineInvitation } = useNotifications();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getInvitationIcon = (invitation: Invitation) => {
    return invitation.type === 'workspace' ? <Folder className="h-5 w-5" /> : <FileText className="h-5 w-5" />;
  };

  const getInvitationTypeLabel = (invitation: Invitation) => {
    return invitation.type === 'workspace' ? 'Workspace' : 'Document';
  };

  const getInvitationDescription = (invitation: Invitation) => {
    return invitation.type === 'workspace' 
      ? `Workspace: ${invitation.workspace_name}` 
      : `Document: ${invitation.document_name}`;
  };

  const handleAccept = async (invitationId: string) => {
    setActionLoading(invitationId);
    try {
      await acceptInvitation(invitationId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setActionLoading(invitationId);
    try {
      await declineInvitation(invitationId);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Pending Invitations
          </DialogTitle>
          <DialogDescription>
            Manage your collaboration invitations. Accept or decline access to workspaces and documents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {invitationsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              Loading invitations...
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No pending invitations</h3>
              <p className="text-sm">You're all caught up! Any new collaboration invitations will appear here.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-4">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="border rounded-lg p-4 space-y-3">
                     {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                         <div className="flex-shrink-0">
                           {getInvitationIcon(invitation)}
                         </div>
                         <div className="min-w-0 flex-1">
                           <h3 className="font-medium truncate">
                             {invitation.type === 'workspace' ? 'Workspace Invitation' : 'Document Invitation'}
                           </h3>
                           <p className="text-sm text-muted-foreground">
                             {getInvitationDescription(invitation)}
                           </p>
                         </div>
                       </div>
                       <Badge variant="secondary" className="flex-shrink-0">
                         {getInvitationTypeLabel(invitation)}
                       </Badge>
                     </div>

                     {/* Message */}
                     <p className="text-sm text-muted-foreground leading-relaxed">
                       You've been invited to collaborate on this {invitation.type}.
                     </p>

                    {/* Invitation Details */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>From: {invitation.inviter_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(invitation.created_at).toLocaleDateString()}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {invitation.role}
                      </Badge>
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDecline(invitation.id)}
                        disabled={actionLoading === invitation.id}
                        className="hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAccept(invitation.id)}
                        disabled={actionLoading === invitation.id}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}