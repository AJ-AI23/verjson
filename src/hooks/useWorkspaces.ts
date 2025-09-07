import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { registerWorkspaceUpdateHandler } from './useNotifications';
import { Workspace, CreateWorkspaceData } from '@/types/workspace';
import { toast } from 'sonner';

export function useWorkspaces() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Fetch owned workspaces with collaborator counts
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from('workspaces')
        .select(`
          *,
          workspace_permissions(role, status)
        `)
        .eq('user_id', user.id);

      if (ownedError) throw ownedError;

      // Fetch workspaces user has permissions for
      const { data: invitedWorkspaces, error: invitedError } = await supabase
        .from('workspaces')
        .select(`
          *,
          workspace_permissions!inner(role, status)
        `)
        .eq('workspace_permissions.user_id', user.id)
        .eq('workspace_permissions.status', 'accepted')
        .neq('user_id', user.id); // Exclude owned workspaces to avoid duplicates

      if (invitedError) throw invitedError;
      
      // Combine and transform the data
      const allWorkspaces = [
        ...(ownedWorkspaces || []).map(ws => {
          // Count accepted collaborators (excluding owner)
          const permissions = ws.workspace_permissions || [];
          const collaboratorCount = Array.isArray(permissions) 
            ? permissions.filter((p: any) => p.status === 'accepted' && p.role !== 'owner').length 
            : 0;
          return { 
            ...ws, 
            isOwner: true, 
            role: 'owner',
            collaboratorCount,
            workspace_permissions: undefined
          };
        }),
        ...(invitedWorkspaces || []).map((ws: any) => ({
          ...ws,
          isOwner: false,
          role: ws.workspace_permissions?.role || 'viewer',
          collaboratorCount: 0,
          workspace_permissions: undefined // Clean up the nested object
        }))
      ];
      
      // Sort by created_at descending
      allWorkspaces.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setWorkspaces(allWorkspaces);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workspaces');
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createWorkspace = async (data: CreateWorkspaceData): Promise<Workspace | null> => {
    if (!user) return null;

    try {
      const { data: workspace, error } = await supabase
        .from('workspaces')
        .insert({
          user_id: user.id,
          name: data.name,
          description: data.description,
        })
        .select()
        .single();

      if (error) throw error;
      
      setWorkspaces(prev => [workspace, ...prev]);
      toast.success('Workspace created successfully');
      return workspace;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workspace';
      setError(message);
      toast.error(message);
      return null;
    }
  };

  const updateWorkspace = async (id: string, updates: Partial<CreateWorkspaceData>) => {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setWorkspaces(prev => prev.map(w => w.id === id ? data : w));
      toast.success('Workspace updated successfully');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update workspace';
      setError(message);
      toast.error(message);
      return null;
    }
  };

  const deleteWorkspace = async (id: string) => {
    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setWorkspaces(prev => prev.filter(w => w.id !== id));
      toast.success('Workspace deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete workspace';
      setError(message);
      toast.error(message);
    }
  };

  // Register for notification-based updates and custom events
  useEffect(() => {
    if (!user) return;

    fetchWorkspaces();

    registerWorkspaceUpdateHandler(fetchWorkspaces);

    // Listen for custom workspace update events (from invitation acceptance)
    const handleCustomWorkspaceUpdate = () => {
      fetchWorkspaces();
    };

    window.addEventListener('workspaceUpdated', handleCustomWorkspaceUpdate);

    return () => {
      registerWorkspaceUpdateHandler(() => {});
      window.removeEventListener('workspaceUpdated', handleCustomWorkspaceUpdate);
    };
  }, [user, fetchWorkspaces]);

  return {
    workspaces,
    loading,
    error,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    refetch: fetchWorkspaces,
  };
}