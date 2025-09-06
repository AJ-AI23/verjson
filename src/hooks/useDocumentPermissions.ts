import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface DocumentPermission {
  id: string;
  document_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  granted_by: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  username?: string;
}

export function useDocumentPermissions(documentId?: string, document?: any) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<DocumentPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = async () => {
    if (!user || !documentId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Use the database function that already handles the JOIN correctly
      const { data: permissionsData, error } = await supabase
        .rpc('get_document_permissions', { doc_id: documentId });

      if (error) throw error;

      console.log('Document permissions from function:', permissionsData);
      
      setPermissions(permissionsData || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch permissions';
      setError(message);
      console.error('Error fetching permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const inviteCollaborator = async (email: string, documentName: string, role: 'editor' | 'viewer' = 'editor') => {
    if (!user || !documentId) return false;

    try {
      const { data, error } = await supabase.functions.invoke('invite-collaborator', {
        body: {
          email,
          invitationType: 'document',
          resourceId: documentId,
          resourceName: documentName,
          role
        }
      });

      if (error) throw error;

      toast.success(data.message || 'Invitation sent successfully');
      await fetchPermissions(); // Refresh permissions
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(message);
      toast.error(message);
      return false;
    }
  };

  const updatePermission = async (permissionId: string, role: 'editor' | 'viewer') => {
    try {
      const { error } = await supabase
        .from('document_permissions')
        .update({ role })
        .eq('id', permissionId);

      if (error) throw error;

      setPermissions(prev => prev.map(p => 
        p.id === permissionId ? { ...p, role } : p
      ));
      toast.success('Permission updated successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update permission';
      setError(message);
      toast.error(message);
    }
  };

  const removePermission = async (permissionId: string) => {
    try {
      // Get permission details before deletion for notification
      const permissionToRemove = permissions.find(p => p.id === permissionId);
      if (!permissionToRemove) {
        throw new Error('Permission not found');
      }

      console.log('Permission to remove:', permissionToRemove);

      // Only send notification if we have user email
      if (permissionToRemove.user_email) {
        try {
          await supabase.functions.invoke('revoke-access', {
            body: {
              permissionId,
              type: 'document',
              revokedUserEmail: permissionToRemove.user_email,
              revokedUserName: permissionToRemove.user_name || permissionToRemove.username,
              resourceName: document?.name || 'Unknown Document',
              revokerName: user?.email
            }
          });
        } catch (notificationError) {
          console.error('Failed to send revocation notification:', notificationError);
          // Continue with removal even if notification fails
        }
      } else {
        console.warn('No user email found for permission, skipping notification');
      }

      // Remove the permission
      const { error } = await supabase
        .from('document_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;

      setPermissions(prev => prev.filter(p => p.id !== permissionId));
      toast.success('Permission removed and user notified');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove permission';
      setError(message);
      toast.error(message);
    }
  };

  // Set up real-time subscription for permission changes
  useEffect(() => {
    if (!user || !documentId) return;

    fetchPermissions();

    const channel = supabase
      .channel('document-permission-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_permissions',
          filter: `document_id=eq.${documentId}`,
        },
        (payload) => {
          console.log('Document permission change detected:', payload);
          fetchPermissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, documentId]);

  return {
    permissions,
    loading,
    error,
    inviteCollaborator,
    updatePermission,
    removePermission,
    refetch: fetchPermissions,
  };
}