import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Document } from '@/types/workspace';
import { toast } from 'sonner';
import { registerSharedDocumentsUpdateHandler } from './useNotifications';
import { registerSharedDocumentsRefreshHandler } from '@/lib/workspaceRefreshUtils';

export interface SharedDocument extends Document {
  workspace_name: string;
  shared_role: 'editor' | 'viewer';
  is_shared: true;
}

const SHARED_DOCUMENTS_QUERY_KEY = 'shared-documents';

export function useSharedDocuments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [documents, setDocuments] = useState<SharedDocument[]>([]);

  const { data: queryData, isLoading: loading, error: queryError } = useQuery({
    queryKey: [SHARED_DOCUMENTS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) {
        console.log('[useSharedDocuments] 🚫 No user, skipping fetch');
        return [];
      }
      
      console.log('[useSharedDocuments] 🔄 Fetching shared documents for user:', user.id, user.email);
      
      const { data, error } = await supabase.functions.invoke('document-management', {
        body: { action: 'listSharedDocuments' }
      });

      if (error) {
        console.error('[useSharedDocuments] ❌ Fetch error:', error);
        throw error;
      }
      
      console.log('[useSharedDocuments] ✅ Shared documents fetched:', data.documents?.length || 0);
      return data.documents || [];
    },
    enabled: !!user,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch shared documents') : null;

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [SHARED_DOCUMENTS_QUERY_KEY, user?.id] });
  }, [queryClient, user?.id]);

  // Sync query data to local state for real-time updates
  useEffect(() => {
    if (queryData) {
      console.log('[useSharedDocuments] 📊 Updating documents state:', queryData.length, 'documents');
      setDocuments(queryData);
    }
  }, [queryData]);

  // Set up real-time subscription for document permission changes
  useEffect(() => {
    if (!user) {
      console.log('[useSharedDocuments] No user, clearing documents');
      setDocuments([]);
      return;
    }

    // Register global refresh handler for immediate updates
    const asyncRefetch = async () => refetch();
    registerSharedDocumentsRefreshHandler(asyncRefetch);

    // Listen for workspace updates (from invitation acceptance)
    const handleWorkspaceUpdate = (event: CustomEvent) => {
      console.log('[useSharedDocuments] 🔄 WorkspaceUpdated event received:', event.detail);
      refetch();
    };
    
    window.addEventListener('workspaceUpdated', handleWorkspaceUpdate as EventListener);

    // Listen for changes in document permissions that might affect shared documents
    const channel = supabase
      .channel('shared-document-changes')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'document_permissions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useSharedDocuments] 🔥 Document permission DELETED:', payload.old);
          
          // Optimistic removal: immediately remove from state
          setDocuments(prev => {
            const filtered = prev.filter(doc => doc.id !== payload.old.document_id);
            if (filtered.length !== prev.length) {
              console.log('[useSharedDocuments] 🔥 Optimistically removed document from shared list');
              toast.info('Document access removed', {
                description: 'Your access to the document has been revoked.'
              });
            }
            return filtered;
          });
          
          // Also fetch latest data for consistency (with small delay)
          setTimeout(() => {
            console.log('[useSharedDocuments] 🔄 Fetching latest data after permission deletion');
            refetch();
          }, 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'document_permissions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useSharedDocuments] 📄 Document permission ADDED:', payload.new);
          // Only refresh for new permissions
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'workspace_permissions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useSharedDocuments] Workspace permission DELETED:', payload.old);
          // When workspace permission is removed, refresh shared documents
          // as documents may now appear in "Shared with me" if they have individual permissions
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspace_permissions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useSharedDocuments] Workspace permission UPDATED:', payload.eventType, payload.new);
          // Status changes (accepted/pending/declined) should trigger refresh
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'documents',
        },
        (payload) => {
          console.log('[useSharedDocuments] Document deletion detected:', payload.old.id);
          // Check if the deleted document was in our shared documents list
          setDocuments(prev => {
            const filtered = prev.filter(doc => doc.id !== payload.old.id);
            if (filtered.length !== prev.length) {
              console.log('[useSharedDocuments] Removed deleted document from shared list');
              // Show a toast notification that the document was deleted
              const deletedDoc = prev.find(doc => doc.id === payload.old.id);
              if (deletedDoc) {
                toast.info(`Document "${deletedDoc.name}" was deleted`, {
                  description: 'The document has been removed from your shared documents.'
                });
              }
            }
            return filtered;
          });
        }
      )
      .subscribe();

    return () => {
      console.log('[useSharedDocuments] 🧹 Cleaning up subscription and handlers');
      supabase.removeChannel(channel);
      registerSharedDocumentsRefreshHandler(null);
      window.removeEventListener('workspaceUpdated', handleWorkspaceUpdate as EventListener);
    };
  }, [user, refetch]);

  return {
    documents,
    loading,
    error,
    refetch,
  };
}