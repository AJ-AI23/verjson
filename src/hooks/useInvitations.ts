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
      
      // Fetch workspace invitations
      const { data: workspaceData, error: workspaceError } = await supabase
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

      if (workspaceError) throw workspaceError;

      // Fetch document invitations
      const { data: documentData, error: documentError } = await supabase
        .from('document_permissions')
        .select(`
          id,
          document_id,
          role,
          created_at,
          granted_by,
          documents:document_id (
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (documentError) throw documentError;

      // Format workspace invitations
      const formattedWorkspaceInvitations = workspaceData?.map(permission => ({
        id: permission.id,
        workspace_id: permission.workspace_id,
        workspace_name: permission.workspaces?.name || 'Unknown Workspace',
        role: permission.role,
        inviter_email: 'Unknown',
        inviter_name: 'Unknown',
        created_at: permission.created_at,
        type: 'workspace' as const
      })) || [];

      // Format document invitations
      const formattedDocumentInvitations = documentData?.map(permission => ({
        id: permission.id,
        document_id: permission.document_id,
        document_name: permission.documents?.name || 'Unknown Document',
        role: permission.role,
        inviter_email: 'Unknown',
        inviter_name: 'Unknown',
        created_at: permission.created_at,
        type: 'document' as const
      })) || [];

      // Combine and sort by creation date
      const allInvitations = [...formattedWorkspaceInvitations, ...formattedDocumentInvitations]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setInvitations(allInvitations);
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
      const removedInvitation = invitations.find(inv => inv.id === invitationId);
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      if (!removedInvitation) {
        toast.error('Invitation not found');
        return false;
      }

      // Choose the correct table based on invitation type
      const tableName = removedInvitation.type === 'workspace' ? 'workspace_permissions' : 'document_permissions';
      
      const { error } = await supabase
        .from(tableName)
        .update({ status: 'accepted' })
        .eq('id', invitationId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error accepting invitation:', error);
        // Revert optimistic update on error
        setInvitations(prev => [...prev, removedInvitation]);
        toast.error('Failed to accept invitation');
        return false;
      }

      toast.success('Invitation accepted successfully');
      // Trigger refresh events
      if (removedInvitation.type === 'workspace') {
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
  }, [invitations, user?.id]);

  const declineInvitation = useCallback(async (invitationId: string) => {
    try {
      // Optimistic update - remove immediately
      const removedInvitation = invitations.find(inv => inv.id === invitationId);
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      if (!removedInvitation) {
        toast.error('Invitation not found');
        return false;
      }

      // Choose the correct table based on invitation type
      const tableName = removedInvitation.type === 'workspace' ? 'workspace_permissions' : 'document_permissions';
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', invitationId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error declining invitation:', error);
        // Revert optimistic update on error
        setInvitations(prev => [...prev, removedInvitation]);
        toast.error('Failed to decline invitation');
        return false;
      }

      toast.success('Invitation declined');
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
  }, [invitations, user?.id]);

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