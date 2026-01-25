import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEdgeFunctionWithAuth } from './useEdgeFunctionWithAuth';

export interface UserPermissionDetails {
  id: string;
  type: 'workspace' | 'document';
  resource_id: string;
  resource_name: string;
  workspace_name: string;
  role: 'owner' | 'editor' | 'viewer';
  granted_by: string;
  created_at: string;
  updated_at: string;
  status: string;
}

export function useUserPermissions(userId?: string) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissionDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { invoke } = useEdgeFunctionWithAuth();

  const fetchUserPermissions = async () => {
    if (!user?.id || !userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get the session to ensure we have a valid token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      
      // Use the permissions-management edge function
      const { data, error: fetchError, status } = await invoke<{ permissions: any[] }>('permissions-management', {
        body: {
          action: 'getUserAllPermissions',
          targetUserId: userId
        }
      });

      // 401 is already handled
      if (status === 401) {
        setLoading(false);
        return;
      }

      if (fetchError) throw fetchError;

      setPermissions((data?.permissions || []).map(item => ({
        ...item,
        type: item.type as 'workspace' | 'document'
      })));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch user permissions';
      setError(message);
      console.error('Error fetching user permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const revokePermission = async (permissionId: string, type: 'workspace' | 'document', resourceName: string, userEmail?: string, userName?: string) => {
    try {
      // Use the revoke-access edge function for proper notifications
      const { data, error } = await supabase.functions.invoke('revoke-access', {
        body: {
          permissionId,
          type,
          revokedUserEmail: userEmail,
          revokedUserName: userName,
          resourceName,
          revokerName: user?.email
        }
      });

      if (error) throw error;

      setPermissions(prev => prev.filter(p => p.id !== permissionId));
      toast.success(data?.message || 'Permission revoked successfully');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke permission';
      setError(message);
      toast.error(message);
      return false;
    }
  };

  useEffect(() => {
    fetchUserPermissions();
  }, [user, userId]);

  return {
    permissions,
    loading,
    error,
    revokePermission,
    refetch: fetchUserPermissions,
  };
}