import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { registerInvitationUpdateHandler } from './useNotifications';
import { toast } from 'sonner';

export interface Invitation {
  id: string;
  workspace_id: string;
  workspace_name: string;
  role: string;
  inviter_email: string;
  inviter_name: string;
  created_at: string;
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
      
      
      
      const { data, error } = await supabase
        .from('workspace_permissions')
        .select(`
          id,
          workspace_id,
          role,
          created_at,
          granted_by,
          workspaces:workspace_id (
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedInvitations = data?.map(permission => ({
        id: permission.id,
        workspace_id: permission.workspace_id,
        workspace_name: permission.workspaces?.name || 'Unknown Workspace',
        role: permission.role,
        inviter_email: 'Unknown',
        inviter_name: 'Unknown',
        created_at: permission.created_at
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
      // Optimistic update - remove immediately
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      const { error } = await supabase
        .from('workspace_permissions')
        .update({ status: 'accepted' })
        .eq('id', invitationId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error accepting invitation:', error);
        // Revert optimistic update on error
        await fetchInvitations();
        return false;
      }

      toast.success('Invitation accepted successfully');
      // Trigger workspace refresh by dispatching custom event
      window.dispatchEvent(new CustomEvent('workspaceUpdated'));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept invitation';
      setError(message);
      toast.error(message);
      await fetchInvitations();
      return false;
    }
  }, [fetchInvitations, user?.id]);

  const declineInvitation = useCallback(async (invitationId: string) => {
    try {
      // Optimistic update - remove immediately
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      const { error } = await supabase
        .from('workspace_permissions')
        .delete()
        .eq('id', invitationId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error declining invitation:', error);
        // Revert optimistic update on error
        await fetchInvitations();
        return false;
      }

      toast.success('Invitation declined');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to decline invitation';
      setError(message);
      toast.error(message);
      await fetchInvitations();
      return false;
    }
  }, [fetchInvitations, user?.id]);

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