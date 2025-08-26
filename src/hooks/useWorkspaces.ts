import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Workspace, CreateWorkspaceData } from '@/types/workspace';
import { toast } from 'sonner';

export function useWorkspaces() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkspaces(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workspaces');
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

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

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return;

    fetchWorkspaces();

    const channel = supabase
      .channel('workspace-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspaces',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchWorkspaces();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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