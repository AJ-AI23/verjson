import { useState, useEffect, useCallback } from 'react';
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

export function useSharedDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debug: Track when documents state changes
  useEffect(() => {
    console.log('[useSharedDocuments] 📊 DOCUMENTS STATE CHANGED:', documents.length, 'documents');
    console.log('[useSharedDocuments] 📊 Documents:', documents.map(d => d.name));
  }, [documents]);

  const fetchSharedDocuments = useCallback(async (): Promise<void> => {
    if (!user) {
      console.log('[useSharedDocuments] 🚫 No user, skipping fetch');
      setDocuments([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('[useSharedDocuments] 🔄 Fetching shared documents for user:', user.id, user.email);
      
      const { data, error } = await supabase.functions.invoke('document-management', {
        body: { action: 'listSharedDocuments' }
      });

      if (error) {
        console.error('[useSharedDocuments] ❌ Fetch error:', error);
        throw error;
      }
      
      console.log('[useSharedDocuments] 📋 Raw response from backend:', data);
      console.log('[useSharedDocuments] ✅ Shared documents fetched:', data.documents?.length || 0);
      if (data.documents?.length > 0) {
        console.log('[useSharedDocuments] 📄 First shared document:', data.documents[0]);
      } else {
        console.log('[useSharedDocuments] 🚫 No shared documents found - virtual workspace should be hidden');
      }
      
      console.log('[useSharedDocuments] 🔄 About to call setDocuments with:', data.documents?.length || 0, 'documents');
      console.log('[useSharedDocuments] 🔄 Current documents state before update:', documents.length);
      setDocuments(data.documents || []);
      console.log('[useSharedDocuments] ✅ setDocuments called - should trigger re-render');
    } catch (err) {
      console.error('[useSharedDocuments] ❌ Error in fetchSharedDocuments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch shared documents');
      toast.error('Failed to load shared documents');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Set up real-time subscription for document permission changes
  useEffect(() => {
    if (!user) {
      console.log('[useSharedDocuments] No user, clearing documents');
      setDocuments([]);
      return;
    }

    fetchSharedDocuments();

    // Register global refresh handler for immediate updates
    registerSharedDocumentsRefreshHandler(fetchSharedDocuments);

    // Listen for workspace updates (from invitation acceptance)
    const handleWorkspaceUpdate = (event: CustomEvent) => {
      console.log('[useSharedDocuments] 🔄 WorkspaceUpdated event received:', event.detail);
      fetchSharedDocuments();
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
            fetchSharedDocuments();
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
          fetchSharedDocuments();
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
          fetchSharedDocuments();
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
          fetchSharedDocuments();
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
  }, [user]);

  return {
    documents,
    loading,
    error,
    refetch: fetchSharedDocuments,
  };
}