import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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

  const fetchUserPermissions = async () => {
    if (!user || !userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .rpc('get_user_all_permissions', { target_user_id: userId });

      if (error) throw error;

      setPermissions((data || []).map(item => ({
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

  const revokePermission = async (permissionId: string, type: 'workspace' | 'document') => {
    try {
      const table = type === 'workspace' ? 'workspace_permissions' : 'document_permissions';
      
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', permissionId);

      if (error) throw error;

      setPermissions(prev => prev.filter(p => p.id !== permissionId));
      toast.success('Permission revoked successfully');
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