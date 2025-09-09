import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface WorkspacePermission {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  granted_by: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  username?: string;
}

export function useWorkspacePermissions(workspaceId?: string) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<WorkspacePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = async () => {
    if (!user || !workspaceId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.functions.invoke('permissions-management', {
        body: {
          action: 'getWorkspacePermissions',
          workspaceId
        }
      });

      if (error) throw error;

      console.log('Workspace permissions from edge function:', data.permissions);
      
      setPermissions(data.permissions || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch permissions';
      setError(message);
      console.error('Error fetching workspace permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const inviteToWorkspace = async (email: string, workspaceName: string, role: 'editor' | 'viewer' = 'editor') => {
    if (!user || !workspaceId) return false;

    try {
      const { data, error } = await supabase.functions.invoke('invite-collaborator', {
        body: {
          email,
          invitationType: 'workspace',
          resourceId: workspaceId,
          resourceName: workspaceName,
          role
        }
      });

      if (error) throw error;

      toast.success(data.message || 'Workspace invitation sent successfully');
      await fetchPermissions(); // Refresh permissions
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send workspace invitation';
      setError(message);
      toast.error(message);
      return false;
    }
  };

  const inviteBulkDocuments = async (email: string, documentIds: string[], role: 'editor' | 'viewer' = 'editor') => {
    if (!user || !documentIds.length) return false;

    try {
      const { data, error } = await supabase.functions.invoke('invite-collaborator', {
        body: {
          email,
          invitationType: 'bulk_documents',
          resourceIds: documentIds,
          resourceName: `${documentIds.length} documents`,
          role
        }
      });

      if (error) throw error;

      toast.success(data.message || 'Bulk document invitation sent successfully');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send bulk document invitation';
      setError(message);
      toast.error(message);
      console.error('Bulk invite error:', err);
      return false;
    }
  };

  const updatePermission = async (permissionId: string, role: 'editor' | 'viewer') => {
    try {
      const { data, error } = await supabase.functions.invoke('permissions-management', {
        body: {
          action: 'updateWorkspacePermission',
          permissionId,
          role
        }
      });

      if (error) throw error;

      setPermissions(prev => prev.map(p => 
        p.id === permissionId ? { ...p, role } : p
      ));
      toast.success(data.message || 'Permission updated successfully');
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

      // Get workspace name for the notification
      const { data: workspaceData } = await supabase.functions.invoke('permissions-management', {
        body: {
          action: 'getWorkspaceForPermission',
          workspaceId
        }
      });

      const { data, error } = await supabase.functions.invoke('permissions-management', {
        body: {
          action: 'removeWorkspacePermission',
          permissionId,
          userEmail: permissionToRemove.user_email,
          userName: permissionToRemove.user_name || permissionToRemove.username,
          resourceName: workspaceData?.workspace?.name || 'Unknown Workspace'
        }
      });

      if (error) throw error;

      setPermissions(prev => prev.filter(p => p.id !== permissionId));
      toast.success(data.message || 'Permission removed successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove permission';
      setError(message);
      toast.error(message);
    }
  };

  // Set up real-time subscription for permission changes
  useEffect(() => {
    if (!user || !workspaceId) return;

    fetchPermissions();

    const channel = supabase
      .channel('workspace-permission-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_permissions',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          console.log('Workspace permission change detected:', payload);
          fetchPermissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, workspaceId]);

  return {
    permissions,
    loading,
    error,
    inviteToWorkspace,
    inviteBulkDocuments,
    updatePermission,
    removePermission,
    refetch: fetchPermissions,
  };
}