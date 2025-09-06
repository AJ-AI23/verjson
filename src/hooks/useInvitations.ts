import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Invitation {
  id: string;
  title: string;
  message: string;
  invitation_type: 'document' | 'workspace' | 'bulk_documents';
  invitation_data: any;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export function useInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = async () => {
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
  };

  const acceptInvitation = async (invitationId: string) => {
    console.log('Accepting invitation:', invitationId);
    
    try {
      const { data, error } = await supabase
        .rpc('accept_invitation', { notification_id: invitationId });

      if (error) throw error;

      if (data) {
        console.log('Invitation accepted successfully');
        toast.success('Invitation accepted successfully');
        
        // Update local state immediately - remove the accepted invitation
        setInvitations(prev => {
          const updated = prev.filter(inv => inv.id !== invitationId);
          console.log('Updated invitations count after acceptance:', updated.length);
          return updated;
        });
        
        return true;
      } else {
        throw new Error('Failed to accept invitation');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept invitation';
      setError(message);
      toast.error(message);
      return false;
    }
  };

  const declineInvitation = async (invitationId: string) => {
    console.log('Declining invitation:', invitationId);
    
    try {
      const { data, error } = await supabase
        .rpc('decline_invitation', { notification_id: invitationId });

      if (error) throw error;

      if (data) {
        console.log('Invitation declined successfully');
        toast.success('Invitation declined');
        
        // Update local state immediately - remove the declined invitation
        setInvitations(prev => {
          const updated = prev.filter(inv => inv.id !== invitationId);
          console.log('Updated invitations count after decline:', updated.length);
          return updated;
        });
        
        return true;
      } else {
        throw new Error('Failed to decline invitation');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to decline invitation';
      setError(message);
      toast.error(message);
      return false;
    }
  };

  // Set up real-time subscription for invitation changes
  useEffect(() => {
    if (!user) return;

    console.log('Setting up invitations real-time subscription for user:', user.id);
    fetchInvitations();

    const channel = supabase
      .channel(`user-invitations-${user.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: user.id }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time: New notification detected for invitations:', payload);
          const newNotification = payload.new as any;
          // Only refetch if it's an invitation type notification
          if (newNotification?.type === 'invitation' && newNotification?.status === 'pending') {
            console.log('Real-time: New invitation received, refreshing invitations list');
            fetchInvitations();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time: Notification updated for invitations:', payload);
          const newNotification = payload.new as any;
          const oldNotification = payload.old as any;
          // Refresh if it's an invitation type notification and status changed
          if ((newNotification?.type === 'invitation' || oldNotification?.type === 'invitation') &&
              newNotification?.status !== oldNotification?.status) {
            console.log('Real-time: Invitation status changed, refreshing invitations list');
            fetchInvitations();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time: Notification deleted for invitations:', payload);
          const deletedNotification = payload.old as any;
          // Refresh if it was an invitation type notification
          if (deletedNotification?.type === 'invitation') {
            console.log('Real-time: Invitation deleted, refreshing invitations list');
            fetchInvitations();
          }
        }
      )
      .subscribe((status, err) => {
        console.log('Invitations subscription status:', status);
        if (err) {
          console.error('Invitations subscription error:', err);
        }
      });

    return () => {
      console.log('Cleaning up invitations subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    invitations,
    loading,
    error,
    acceptInvitation,
    declineInvitation,
    refetch: fetchInvitations,
  };
}