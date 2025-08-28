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
    try {
      const { data, error } = await supabase
        .rpc('accept_invitation', { notification_id: invitationId });

      if (error) throw error;

      if (data) {
        toast.success('Invitation accepted successfully');
        await fetchInvitations(); // Refresh invitations
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
    try {
      const { data, error } = await supabase
        .rpc('decline_invitation', { notification_id: invitationId });

      if (error) throw error;

      if (data) {
        toast.success('Invitation declined');
        await fetchInvitations(); // Refresh invitations
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

  useEffect(() => {
    fetchInvitations();
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