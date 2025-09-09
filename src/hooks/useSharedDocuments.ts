import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Document } from '@/types/workspace';
import { toast } from 'sonner';

export interface SharedDocument extends Document {
  workspace_name: string;
  shared_role: 'editor' | 'viewer';
  is_shared: true;
}

export function useSharedDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSharedDocuments = async () => {
    if (!user) {
      console.log('[useSharedDocuments] No user, skipping fetch');
      setDocuments([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('[useSharedDocuments] Fetching shared documents');
      
      const { data, error } = await supabase.functions.invoke('document-management', {
        body: { action: 'listSharedDocuments' }
      });

      if (error) {
        console.error('[useSharedDocuments] Fetch error:', error);
        throw error;
      }
      
      console.log('[useSharedDocuments] Shared documents fetched:', data.documents?.length || 0);
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('[useSharedDocuments] Error in fetchSharedDocuments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch shared documents');
      toast.error('Failed to load shared documents');
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscription for document permission changes
  useEffect(() => {
    if (!user) {
      console.log('[useSharedDocuments] No user, clearing documents');
      setDocuments([]);
      return;
    }

    fetchSharedDocuments();

    // Listen for changes in document permissions that might affect shared documents
    const channel = supabase
      .channel('shared-document-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_permissions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useSharedDocuments] Permission change detected:', payload.eventType);
          fetchSharedDocuments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_permissions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useSharedDocuments] Workspace permission change detected:', payload.eventType);
          fetchSharedDocuments();
        }
      )
      .subscribe();

    return () => {
      console.log('[useSharedDocuments] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    documents,
    loading,
    error,
    refetch: fetchSharedDocuments,
  };
}