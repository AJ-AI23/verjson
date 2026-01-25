import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { registerInvitationUpdateHandler } from './useNotifications';
import { toast } from 'sonner';
import { useEdgeFunctionWithAuth } from './useEdgeFunctionWithAuth';

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

const INVITATIONS_QUERY_KEY = 'invitations';

export function useInvitations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { invoke } = useEdgeFunctionWithAuth();

  const { data: invitations = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: [INVITATIONS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error, status } = await invoke<{ invitations: any[] }>('permissions-management', {
        body: {
          action: 'getUserInvitations'
        }
      });

      // 401 is already handled by useEdgeFunctionWithAuth
      if (status === 401) {
        throw new Error('Session expired');
      }

      if (error) throw error;

      return data?.invitations?.map(invitation => ({
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
    },
    enabled: !!user,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch invitations') : null;

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [INVITATIONS_QUERY_KEY, user?.id] });
  }, [queryClient, user?.id]);

  const acceptInvitation = useCallback(async (invitationId: string) => {
    try {
      // Find the invitation to get its type
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (!invitation) {
        console.error('[useInvitations] Invitation not found:', invitationId);
        toast.error('Invitation not found');
        return false;
      }

      // Optimistic update
      queryClient.setQueryData([INVITATIONS_QUERY_KEY, user?.id], (old: Invitation[] = []) => 
        old.filter(inv => inv.id !== invitationId)
      );
      
      // Use the permissions-management edge function
      const { data, error, status } = await invoke<{ success: boolean; message: string }>('permissions-management', {
        body: {
          action: 'acceptInvitation',
          invitationId: invitationId,
          invitationType: invitation.type
        }
      });

      // 401 is already handled
      if (status === 401) {
        return false;
      }

      if (error) {
        console.error('[useInvitations] Error accepting invitation:', error);
        refetch();
        toast.error('Failed to accept invitation');
        return false;
      }

      if (!data?.success) {
        console.error('[useInvitations] Acceptance failed:', data?.message);
        refetch();
        toast.error(data?.message || 'Failed to accept invitation');
        return false;
      }

      toast.success(data.message);
      
      // Dispatch custom event to update workspace dropdown
      window.dispatchEvent(new CustomEvent('workspaceUpdated', { 
        detail: { type: 'invitation_accepted', invitationType: invitation.type } 
      }));

      return true;
    } catch (err) {
      console.error('[useInvitations] Exception during invitation acceptance:', err);
      const message = err instanceof Error ? err.message : 'Failed to accept invitation';
      refetch();
      toast.error(message);
      return false;
    }
  }, [invitations, queryClient, user?.id, refetch, invoke]);

  const declineInvitation = useCallback(async (invitationId: string) => {
    try {
      // Find the invitation to get its type
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (!invitation) {
        toast.error('Invitation not found');
        return false;
      }

      // Optimistic update
      queryClient.setQueryData([INVITATIONS_QUERY_KEY, user?.id], (old: Invitation[] = []) => 
        old.filter(inv => inv.id !== invitationId)
      );
      
      // Use the permissions-management edge function
      const { data, error, status } = await invoke<{ success: boolean; message: string }>('permissions-management', {
        body: {
          action: 'declineInvitation',
          invitationId: invitationId,
          invitationType: invitation.type
        }
      });

      // 401 is already handled
      if (status === 401) {
        return false;
      }

      if (error) {
        console.error('Error declining invitation:', error);
        refetch();
        toast.error('Failed to decline invitation');
        return false;
      }

      if (!data?.success) {
        refetch();
        toast.error(data?.message || 'Failed to decline invitation');
        return false;
      }

      toast.success(data.message);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to decline invitation';
      refetch();
      toast.error(message);
      return false;
    }
  }, [invitations, queryClient, user?.id, refetch, invoke]);

  // Register for notification-based updates
  useEffect(() => {
    if (!user) return;

    registerInvitationUpdateHandler(refetch);
    
    return () => {
      registerInvitationUpdateHandler(() => {});
    };
  }, [user, refetch]);

  return {
    invitations,
    loading,
    error,
    acceptInvitation,
    declineInvitation,
    refetch,
  };
}