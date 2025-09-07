import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { registerInvitationUpdateHandler } from './useNotifications';
import { toast } from 'sonner';

export interface Invitation {
  id: string;
  workspace_id?: string;
  document_id?: string;
  workspace_name?: string;
  document_name?: string;
  role: string;
  inviter_email: string;
  inviter_name: string;
  created_at: string;
  type: 'workspace' | 'document';
}

export function useInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Use the database function to get all invitations
      const { data, error } = await supabase
        .rpc('get_user_invitations', { target_user_id: user.id });

      if (error) throw error;

      // Format the data to match our interface
      const formattedInvitations = data?.map(invitation => ({
        id: invitation.id,
        workspace_id: invitation.workspace_id,
        document_id: invitation.document_id,
        workspace_name: invitation.workspace_name,
        document_name: invitation.document_name,
        role: invitation.role,
        inviter_email: invitation.inviter_email || 'Unknown',
        inviter_name: invitation.inviter_name || 'Unknown',
        created_at: invitation.created_at,
        type: invitation.type as 'workspace' | 'document'
      })) || [];

      setInvitations(formattedInvitations);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invitations';
      setError(message);
      console.error('Error fetching invitations:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const acceptInvitation = useCallback(async (invitationId: string) => {
    try {
      // Find the invitation to get its type
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (!invitation) {
        toast.error('Invitation not found');
        return false;
      }

      // Optimistic update - remove immediately
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      // Use the database function to accept the invitation
      const { data, error } = await supabase
        .rpc('accept_invitation', { 
          invitation_id: invitationId, 
          invitation_type: invitation.type 
        });

      if (error) {
        console.error('Error accepting invitation:', error);
        // Revert optimistic update on error
        setInvitations(prev => [...prev, invitation]);
        toast.error('Failed to accept invitation');
        return false;
      }

      const result = data?.[0];
      if (!result?.success) {
        // Revert optimistic update on error
        setInvitations(prev => [...prev, invitation]);
        toast.error(result?.message || 'Failed to accept invitation');
        return false;
      }

      toast.success(result.message);
      // Trigger refresh events
      if (invitation.type === 'workspace') {
        window.dispatchEvent(new CustomEvent('workspaceUpdated'));
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept invitation';
      // Revert optimistic update on error
      const removedInvitation = invitations.find(inv => inv.id === invitationId);
      if (removedInvitation) {
        setInvitations(prev => [...prev, removedInvitation]);
      }
      setError(message);
      toast.error(message);
      return false;
    }
  }, [invitations]);

  const declineInvitation = useCallback(async (invitationId: string) => {
    try {
      // Find the invitation to get its type
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (!invitation) {
        toast.error('Invitation not found');
        return false;
      }

      // Optimistic update - remove immediately
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      // Use the database function to decline the invitation
      const { data, error } = await supabase
        .rpc('decline_invitation', { 
          invitation_id: invitationId, 
          invitation_type: invitation.type 
        });

      if (error) {
        console.error('Error declining invitation:', error);
        // Revert optimistic update on error
        setInvitations(prev => [...prev, invitation]);
        toast.error('Failed to decline invitation');
        return false;
      }

      const result = data?.[0];
      if (!result?.success) {
        // Revert optimistic update on error
        setInvitations(prev => [...prev, invitation]);
        toast.error(result?.message || 'Failed to decline invitation');
        return false;
      }

      toast.success(result.message);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to decline invitation';
      // Revert optimistic update on error
      const removedInvitation = invitations.find(inv => inv.id === invitationId);
      if (removedInvitation) {
        setInvitations(prev => [...prev, removedInvitation]);
      }
      setError(message);
      toast.error(message);
      return false;
    }
  }, [invitations]);

  // Register for notification-based updates
  useEffect(() => {
    if (!user) return;

    registerInvitationUpdateHandler(fetchInvitations);
    
    return () => {
      registerInvitationUpdateHandler(() => {});
    };
  }, [user, fetchInvitations]);

  // Initial fetch
  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  return {
    invitations,
    loading,
    error,
    acceptInvitation,
    declineInvitation,
    refetch: fetchInvitations,
  };
}