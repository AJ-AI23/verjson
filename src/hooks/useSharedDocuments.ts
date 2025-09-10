import { useState, useEffect, useCallback } from 'react';
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
      
      setDocuments(data.documents || []);
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

    // Listen for direct database changes to eliminate race conditions
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
          console.log('[useSharedDocuments] Document permission DELETED:', payload.old);
          // Optimistically remove the document from local state
          const deletedDocumentId = payload.old.document_id;
          setDocuments(prev => {
            const filtered = prev.filter(doc => doc.id !== deletedDocumentId);
            if (filtered.length !== prev.length) {
              console.log('[useSharedDocuments] Optimistically removed document with revoked access');
              const removedDoc = prev.find(doc => doc.id === deletedDocumentId);
              if (removedDoc) {
                toast.info(`Access to "${removedDoc.name}" was revoked`, {
                  description: 'The document has been removed from your shared documents.'
                });
              }
            }
            return filtered;
          });
          // Also refetch to ensure consistency
          fetchSharedDocuments();
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
          console.log('[useSharedDocuments] Document permission INSERTED:', payload.new);
          // Refetch to get the new document
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
      console.log('[useSharedDocuments] 🧹 Cleaning up subscription');
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