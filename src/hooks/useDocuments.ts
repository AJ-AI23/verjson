import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Document, CreateDocumentData } from '@/types/workspace';
import { toast } from 'sonner';
import { enhanceDocumentsWithEffectiveContent } from '@/lib/documentUtils';
import { useSharedDocuments } from './useSharedDocuments';

const VIRTUAL_SHARED_WORKSPACE_ID = '__shared_with_me__';

export function useDocuments(workspaceId?: string) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use shared documents hook for the virtual workspace
  const sharedDocuments = useSharedDocuments();
  const isVirtualSharedWorkspace = workspaceId === VIRTUAL_SHARED_WORKSPACE_ID;
  
  // If virtual shared workspace, return shared documents state directly
  if (isVirtualSharedWorkspace) {
    return {
      documents: sharedDocuments.documents,
      loading: sharedDocuments.loading,
      error: sharedDocuments.error,
      createDocument: async () => null, // Not supported for shared workspace
      updateDocument: async () => null, // Not supported for shared workspace
      deleteDocument: async () => {}, // Not supported for shared workspace
      refetch: sharedDocuments.refetch,
    };
  }

  const fetchDocuments = async () => {
    if (!user) {
      console.log('[useDocuments] No user, skipping fetch');
      return;
    }
    
    // Don't fetch anything if no workspace is selected
    if (!workspaceId) {
      console.log('[useDocuments] No workspace selected, skipping document fetch');
      setDocuments([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('[useDocuments] Fetching documents for workspace:', workspaceId);
      
      const { data, error } = await supabase.functions.invoke('document-management', {
        body: { action: 'listDocumentsByWorkspace', workspace_id: workspaceId }
      });

      if (error) {
        console.error('[useDocuments] Fetch error:', error);
        throw error;
      }
      
      console.log('[useDocuments] Documents fetched:', data.documents?.length || 0);
      console.log('[useDocuments] Sample document with integration:', data.documents?.[0] ? {
        id: data.documents[0].id,
        name: data.documents[0].name,
        crowdin_integration_id: data.documents[0].crowdin_integration_id,
        crowdin_integration: data.documents[0].crowdin_integration
      } : 'No documents');
      
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('[useDocuments] Error in fetchDocuments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async (data: CreateDocumentData): Promise<Document | null> => {
    if (!user) return null;

    try {
      console.log('[useDocuments] Creating document:', data);
      
      const { data: result, error } = await supabase.functions.invoke('document-management', {
        body: { action: 'createDocument', ...data }
      });

      if (error) throw error;
      
      console.log('[useDocuments] Document created:', result.document);
      
      await fetchDocuments(); // Refresh the list
      toast.success('Document created successfully');
      return result.document;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create document';
      setError(message);
      toast.error(message);
      return null;
    }
  };

  const updateDocument = async (id: string, updates: Partial<Pick<Document, 'name' | 'content' | 'file_type'>>) => {
    try {
      console.log('[useDocuments] Updating document:', id, updates);
      
      const { data, error } = await supabase.functions.invoke('document-management', {
        body: { action: 'updateDocument', id, ...updates }
      });

      if (error) throw error;
      
      console.log('[useDocuments] Document updated');
      await fetchDocuments(); // Refresh the list
      return data.document;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update document';
      setError(message);
      toast.error(message);
      return null;
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      console.log('[useDocuments] Deleting document:', id);
      
      const { data, error } = await supabase.functions.invoke('document-management', {
        body: { action: 'deleteDocument', id }
      });

      if (error) throw error;
      
      console.log('[useDocuments] Document deleted');
      await fetchDocuments(); // Refresh the list
      toast.success('Document and all associated versions deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document';
      setError(message);
      toast.error(message);
    }
  };

  // Set up real-time subscription and clear documents when workspace changes
  useEffect(() => {
    if (!user) {
      console.log('[useDocuments] No user, clearing documents');
      setDocuments([]);
      return;
    }

    // Clear documents immediately when workspace changes
    console.log('[useDocuments] Workspace changed to:', workspaceId || 'ALL');
    setDocuments([]);
    setError(null);
    
    fetchDocuments();

    // Only set up real-time subscription if workspace is selected
    if (!workspaceId) {
      console.log('[useDocuments] No workspace selected, skipping real-time subscription');
      return;
    }
    
    const channelFilter = `workspace_id=eq.${workspaceId}`;
    const channelName = `document-changes-workspace-${workspaceId}`;

    console.log('[useDocuments] Setting up real-time subscription:', {
      channelName,
      filter: channelFilter,
      workspaceId
    });

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: channelFilter,
        },
        (payload) => {
          console.log('[useDocuments] Real-time update received:', {
            event: payload.eventType,
            document: payload.new || payload.old,
            workspaceContext: workspaceId
          });
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
      console.log('[useDocuments] Cleaning up subscription:', channelName, 'for workspace:', workspaceId || 'ALL');
      supabase.removeChannel(channel);
    };
  }, [user, workspaceId]);

  return {
    documents,
    loading,
    error,
    createDocument,
    updateDocument,
    deleteDocument,
    refetch: fetchDocuments,
  };
}

// Export the virtual workspace ID for use in other components
export { VIRTUAL_SHARED_WORKSPACE_ID };