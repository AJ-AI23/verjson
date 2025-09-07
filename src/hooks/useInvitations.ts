import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeService } from './useRealtimeService';
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
  const { subscribe, unsubscribe } = useRealtimeService();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching pending workspace invitations for user:', user.id);
      
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

      console.log('Raw workspace permission data:', data);
      
      const formattedInvitations = data?.map(permission => ({
        id: permission.id,
        workspace_id: permission.workspace_id,
        workspace_name: permission.workspaces?.name || 'Unknown Workspace',
        role: permission.role,
        inviter_email: 'Unknown',
        inviter_name: 'Unknown',
        created_at: permission.created_at
      })) || [];

      console.log('Formatted invitations:', formattedInvitations);
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
    console.log('Accepting workspace invitation:', invitationId);
    
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

      console.log('Workspace invitation accepted successfully');
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
    console.log('Declining workspace invitation:', invitationId);
    
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

      console.log('Workspace invitation declined successfully');
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

  // Set up real-time subscription for workspace permission changes
  useEffect(() => {
    if (!user) return;

    console.log('Setting up workspace invitations subscription for user:', user.id);
    
    const handleInvitationUpdate = (payload: any) => {
      console.log('Workspace invitations real-time update:', payload);
      
      if (payload.eventType === 'INSERT') {
        const newPermission = payload.new;
        if (newPermission.status === 'pending' && newPermission.user_id === user.id) {
          // Refetch to get full data with workspace name and granter info
          fetchInvitations();
        }
      } else if (payload.eventType === 'UPDATE') {
        const updatedPermission = payload.new;
        if (updatedPermission.status !== 'pending') {
          // Remove accepted/declined invitations
          setInvitations(prev => prev.filter(inv => inv.id !== updatedPermission.id));
        }
      } else if (payload.eventType === 'DELETE') {
        const deletedId = payload.old.id;
        setInvitations(prev => prev.filter(invitation => invitation.id !== deletedId));
      }
    };

    subscribe('workspace-invitations', {
      table: 'workspace_permissions',
      filter: `user_id=eq.${user.id}`,
      callback: handleInvitationUpdate
    });

    return () => {
      console.log('Cleaning up workspace invitations subscription');
      unsubscribe('workspace-invitations');
    };
  }, [user, subscribe, unsubscribe, fetchInvitations]);

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