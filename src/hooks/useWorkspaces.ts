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
      
      const { data, error } = await supabase.functions.invoke('workspace-management/list');
      
      if (error) throw error;

      setWorkspaces(data.workspaces || []);
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
      const { data: result, error } = await supabase.functions.invoke('workspace-management', {
        body: data
      });

      if (error) throw error;
      
      await fetchWorkspaces(); // Refresh the list
      toast.success('Workspace created successfully');
      return result.workspace;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workspace';
      setError(message);
      toast.error(message);
      return null;
    }
  };

  const updateWorkspace = async (id: string, updates: Partial<CreateWorkspaceData>) => {
    try {
      const { data, error } = await supabase.functions.invoke('workspace-management', {
        body: { id, ...updates }
      });

      if (error) throw error;
      
      await fetchWorkspaces(); // Refresh the list
      toast.success('Workspace updated successfully');
      return data.workspace;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update workspace';
      setError(message);
      toast.error(message);
      return null;
    }
  };

  const deleteWorkspace = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('workspace-management', {
        body: { id }
      });

      if (error) throw error;
      
      await fetchWorkspaces(); // Refresh the list
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