import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Document } from '@/types/workspace';
import { toast } from 'sonner';
import { registerSharedDocumentsUpdateHandler } from './useNotifications';

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

    // Register global refresh handler for notification-based updates
    registerSharedDocumentsUpdateHandler(() => {
      console.log('[useSharedDocuments] Notification-triggered refresh');
      fetchSharedDocuments();
    });

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