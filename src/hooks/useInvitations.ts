import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { registerInvitationUpdateHandler } from './useNotifications';
import { useRealtimeService } from './useRealtimeService';
import { toast } from 'sonner';
import { triggerSequentialRefresh } from '@/lib/workspaceRefreshUtils';

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
  const { subscribe, unsubscribe } = useRealtimeService();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Use the permissions-management edge function
      const { data, error } = await supabase.functions.invoke('permissions-management', {
        body: {
          action: 'getUserInvitations'
        }
      });

      if (error) throw error;

      // Format the data to match our interface
      const formattedInvitations = data?.invitations?.map(invitation => ({
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
      
      // Use the permissions-management edge function
      const { data, error } = await supabase.functions.invoke('permissions-management', {
        body: {
          action: 'acceptInvitation',
          invitationId: invitationId,
          invitationType: invitation.type
        }
      });

      if (error) {
        console.error('Error accepting invitation:', error);
        // Revert optimistic update on error
        setInvitations(prev => [...prev, invitation]);
        toast.error('Failed to accept invitation');
        return false;
      }

      if (!data?.success) {
        // Revert optimistic update on error
        setInvitations(prev => [...prev, invitation]);
        toast.error(data?.message || 'Failed to accept invitation');
        return false;
      }

      toast.success(data.message);
      
      // Trigger sequential refresh to ensure proper timing
      console.log('[useInvitations] Invitation accepted, triggering sequential refresh for type:', invitation.type);
      await triggerSequentialRefresh();

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
      
      // Use the permissions-management edge function
      const { data, error } = await supabase.functions.invoke('permissions-management', {
        body: {
          action: 'declineInvitation',
          invitationId: invitationId,
          invitationType: invitation.type
        }
      });

      if (error) {
        console.error('Error declining invitation:', error);
        // Revert optimistic update on error
        setInvitations(prev => [...prev, invitation]);
        toast.error('Failed to decline invitation');
        return false;
      }

      if (!data?.success) {
        // Revert optimistic update on error
        setInvitations(prev => [...prev, invitation]);
        toast.error(data?.message || 'Failed to decline invitation');
        return false;
      }

      toast.success(data.message);
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

  // Register for notification-based updates and real-time subscription
  useEffect(() => {
    if (!user) return;

    registerInvitationUpdateHandler(fetchInvitations);

    // Listen for revoke access notifications to remove cancelled invitations
    const handleNotificationUpdate = (payload: any) => {
      if (payload.eventType === 'INSERT') {
        const notification = payload.new;
        console.log('Received notification update:', notification);
        if (notification.type === 'access_revoked' && notification.title?.toLowerCase().includes('invitation cancelled')) {
          console.log('Detected cancelled invitation notification, refetching invitations...');
          // Refetch invitations to ensure consistency
          fetchInvitations();
        }
      }
    };

    subscribe('invitation-revoke-notifications', {
      table: 'notifications',
      filter: `user_id=eq.${user.id}`,
      event: 'INSERT',
      callback: handleNotificationUpdate
    });
    
    return () => {
      registerInvitationUpdateHandler(() => {});
      unsubscribe('invitation-revoke-notifications');
    };
  }, [user, fetchInvitations, subscribe, unsubscribe]);

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