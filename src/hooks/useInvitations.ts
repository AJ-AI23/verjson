import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeService } from './useRealtimeService';
import { toast } from 'sonner';

export interface Invitation {
  id: string;
  title: string;
  message: string;
  type: string;
  invitation_type: 'document' | 'workspace' | 'bulk_documents';
  invitation_data: any;
  status: 'pending' | 'accepted' | 'declined';
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
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'invitation')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInvitations((data || []) as Invitation[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invitations';
      setError(message);
      console.error('Error fetching invitations:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const acceptInvitation = useCallback(async (invitationId: string) => {
    console.log('Accepting invitation:', invitationId);
    
    try {
      // Optimistic update - remove immediately
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      const { data, error } = await supabase
        .rpc('accept_invitation', { notification_id: invitationId });

      if (error) {
        console.error('Error accepting invitation:', error);
        // Revert optimistic update on error
        await fetchInvitations();
        return false;
      }

      if (data) {
        console.log('Invitation accepted successfully');
        toast.success('Invitation accepted successfully');
        // Trigger workspace refresh by dispatching custom event
        window.dispatchEvent(new CustomEvent('workspaceUpdated'));
        return true;
      } else {
        throw new Error('Failed to accept invitation');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept invitation';
      setError(message);
      toast.error(message);
      await fetchInvitations();
      return false;
    }
  }, [fetchInvitations]);

  const declineInvitation = useCallback(async (invitationId: string) => {
    console.log('Declining invitation:', invitationId);
    
    try {
      // Optimistic update - remove immediately
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      const { data, error } = await supabase
        .rpc('decline_invitation', { notification_id: invitationId });

      if (error) {
        console.error('Error declining invitation:', error);
        // Revert optimistic update on error
        await fetchInvitations();
        return false;
      }

      if (data) {
        console.log('Invitation declined successfully');
        toast.success('Invitation declined');
        return true;
      } else {
        throw new Error('Failed to decline invitation');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to decline invitation';
      setError(message);
      toast.error(message);
      await fetchInvitations();
      return false;
    }
  }, [fetchInvitations]);

  // Set up real-time subscription for invitations
  useEffect(() => {
    if (!user) return;

    console.log('Setting up invitations subscription for user:', user.id);
    
    const handleInvitationUpdate = (payload: any) => {
      console.log('Invitations real-time update:', payload);
      
      if (payload.eventType === 'INSERT') {
        const newInvitation = payload.new as Invitation;
        if (newInvitation.type === 'invitation' && newInvitation.status === 'pending') {
          setInvitations(prev => [newInvitation, ...prev]);
        }
      } else if (payload.eventType === 'UPDATE') {
        const updatedInvitation = payload.new as Invitation;
        if (updatedInvitation.status === 'accepted' || updatedInvitation.status === 'declined') {
          // Remove accepted/declined invitations
          setInvitations(prev => prev.filter(inv => inv.id !== updatedInvitation.id));
        } else if (updatedInvitation.type === 'invitation' && updatedInvitation.status === 'pending') {
          setInvitations(prev => 
            prev.map(invitation => 
              invitation.id === updatedInvitation.id 
                ? updatedInvitation 
                : invitation
            )
          );
        }
      } else if (payload.eventType === 'DELETE') {
        const deletedId = payload.old.id;
        setInvitations(prev => prev.filter(invitation => invitation.id !== deletedId));
      }
    };

    subscribe('invitations', {
      table: 'notifications',
      filter: `user_id=eq.${user.id}`,
      callback: handleInvitationUpdate
    });

    return () => {
      console.log('Cleaning up invitations subscription');
      unsubscribe('invitations');
    };
  }, [user, subscribe, unsubscribe]);

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