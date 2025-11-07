import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDemoSession } from '@/contexts/DemoSessionContext';
import { registerWorkspaceUpdateHandler } from './useNotifications';
import { Workspace, CreateWorkspaceData } from '@/types/workspace';
import { toast } from 'sonner';
import { registerWorkspaceRefreshHandler } from '@/lib/workspaceRefreshUtils';
import { checkDemoSessionExpired } from '@/lib/supabaseErrorHandler';

const WORKSPACE_QUERY_KEY = 'workspaces';

export function useWorkspaces() {
  const { user } = useAuth();
  const { handleDemoExpiration } = useDemoSession();
  const queryClient = useQueryClient();

  const { data: workspaces = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: [WORKSPACE_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      console.log('[useWorkspaces] 🔄 Fetching workspaces for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('workspace-management', {
        body: { action: 'listUserWorkspaces' }
      });
      
      if (error) {
        const { isDemoExpired } = checkDemoSessionExpired(error);
        if (isDemoExpired) {
          handleDemoExpiration();
          throw new Error('Demo session expired');
        }
        throw error;
      }

      console.log('[useWorkspaces] ✅ Fetched workspaces:', data.workspaces?.length || 0);
      return data.workspaces || [];
    },
    enabled: !!user,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch workspaces') : null;

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [WORKSPACE_QUERY_KEY, user?.id] });
  }, [queryClient, user?.id]);

  const createWorkspace = async (data: CreateWorkspaceData): Promise<Workspace | null> => {
    if (!user) return null;

    try {
      const { data: result, error } = await supabase.functions.invoke('workspace-management', {
        body: { action: 'createWorkspace', ...data }
      });

      if (error) {
        const { isDemoExpired } = checkDemoSessionExpired(error);
        if (isDemoExpired) {
          handleDemoExpiration();
          return null;
        }
        throw error;
      }
      
      refetch();
      toast.success('Workspace created successfully');
      return result.workspace;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workspace';
      toast.error(message);
      return null;
    }
  };

  const updateWorkspace = async (id: string, updates: Partial<CreateWorkspaceData>) => {
    try {
      const { data, error } = await supabase.functions.invoke('workspace-management', {
        body: { action: 'updateWorkspace', id, ...updates }
      });

      if (error) {
        const { isDemoExpired } = checkDemoSessionExpired(error);
        if (isDemoExpired) {
          handleDemoExpiration();
          return null;
        }
        throw error;
      }
      
      refetch();
      toast.success('Workspace updated successfully');
      return data.workspace;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update workspace';
      toast.error(message);
      return null;
    }
  };

  const deleteWorkspace = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('workspace-management', {
        body: { action: 'deleteWorkspace', id }
      });

      if (error) {
        const { isDemoExpired } = checkDemoSessionExpired(error);
        if (isDemoExpired) {
          handleDemoExpiration();
          return;
        }
        throw error;
      }
      
      refetch();
      toast.success('Workspace deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete workspace';
      toast.error(message);
    }
  };

  // Register for notification-based updates and custom events
  useEffect(() => {
    if (!user) return;

    const asyncRefetch = async () => refetch();
    registerWorkspaceUpdateHandler(asyncRefetch);
    registerWorkspaceRefreshHandler(asyncRefetch);

    // Listen for custom workspace update events (from invitation acceptance)
    const handleCustomWorkspaceUpdate = () => {
      console.log('[useWorkspaces] 🎯 Received workspaceUpdated event - refetching workspaces');
      refetch();
    };

    window.addEventListener('workspaceUpdated', handleCustomWorkspaceUpdate);

    return () => {
      registerWorkspaceUpdateHandler(null);
      registerWorkspaceRefreshHandler(null);
      window.removeEventListener('workspaceUpdated', handleCustomWorkspaceUpdate);
    };
  }, [user, refetch]);

  return {
    workspaces,
    loading,
    error,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    refetch,
  };
}