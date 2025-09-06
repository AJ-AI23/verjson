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

export function useDocumentPermissions(documentId?: string) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<DocumentPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = async () => {
    if (!user || !documentId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // First get permissions
      const { data: permissionsData, error } = await supabase
        .from('document_permissions')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Then get user info for each permission
      const permissionsWithUserInfo = [];
      for (const perm of permissionsData || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name, username')
          .eq('user_id', perm.user_id)
          .single();
        
        permissionsWithUserInfo.push({
          ...perm,
          user_email: profile?.email,
          user_name: profile?.full_name,
          username: profile?.username
        });
      }
      
      setPermissions(permissionsWithUserInfo);
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
      const { error } = await supabase
        .from('document_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;

      setPermissions(prev => prev.filter(p => p.id !== permissionId));
      toast.success('Permission removed successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove permission';
      setError(message);
      toast.error(message);
    }
  };

  useEffect(() => {
    fetchPermissions();
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