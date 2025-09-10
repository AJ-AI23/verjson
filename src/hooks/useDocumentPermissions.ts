import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { triggerSequentialRefresh } from '@/lib/workspaceRefreshUtils';

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
  email_notifications_enabled?: boolean;
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
      
      const { data, error } = await supabase.functions.invoke('permissions-management', {
        body: {
          action: 'getDocumentPermissions',
          documentId
        }
      });

      if (error) throw error;

      console.log('Document permissions from edge function:', data.permissions);
      
      setPermissions(data.permissions || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch permissions';
      setError(message);
      console.error('Error fetching permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const inviteCollaborator = async (email: string, documentName: string, role: 'editor' | 'viewer' = 'editor', emailNotifications: boolean = true) => {
    if (!user || !documentId) return false;
    
    console.log('🔔 useDocumentPermissions - inviteCollaborator called with:', {
      email,
      documentName,
      role,
      emailNotifications,
      emailNotificationsType: typeof emailNotifications
    });

    try {
      const requestBody = {
        action: 'inviteToDocument',
        email,
        resourceId: documentId,
        resourceName: documentName,
        role,
        emailNotificationsEnabled: emailNotifications
      };
      
      console.log('🔔 useDocumentPermissions - Request body being sent:', requestBody);

      const { data, error } = await supabase.functions.invoke('permissions-management', {
        body: requestBody
      });

      if (error) throw error;

      toast.success(data.message || 'Invitation sent successfully');
      await fetchPermissions(); // Refresh permissions
      await triggerSequentialRefresh(); // Refresh both workspace and shared documents sequentially
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
      const { data, error } = await supabase.functions.invoke('permissions-management', {
        body: {
          action: 'updateDocumentPermission',
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

      const { data, error } = await supabase.functions.invoke('permissions-management', {
        body: {
          action: 'removeDocumentPermission',
          permissionId,
          userEmail: permissionToRemove.user_email,
          userName: permissionToRemove.user_name || permissionToRemove.username,
          resourceName: document?.name || 'Unknown Document',
          emailNotificationsEnabled: permissionToRemove.email_notifications_enabled
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