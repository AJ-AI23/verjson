import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Document, CreateDocumentData } from '@/types/workspace';
import { toast } from 'sonner';
import { enhanceDocumentsWithEffectiveContent } from '@/lib/documentUtils';

export function useDocuments(workspaceId?: string) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    if (!user) {
      console.log('[useDocuments] No user, skipping fetch');
      return;
    }
    
    try {
      setLoading(true);
      console.log('[useDocuments] Fetching documents for workspace:', workspaceId || 'ALL');
      
      let query = supabase.from('documents').select('*');
      
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
        console.log('[useDocuments] Applied workspace filter:', workspaceId);
      } else {
        console.log('[useDocuments] No workspace filter applied - fetching all user documents');
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('[useDocuments] Fetch error:', error);
        throw error;
      }
      
      console.log('[useDocuments] Raw documents fetched:', data?.length || 0);
      console.log('[useDocuments] Documents details:', data?.map(d => ({ 
        id: d.id, 
        name: d.name, 
        workspace_id: d.workspace_id 
      })));
      
      // Enhance documents with effective content from released versions
      const documentsWithEffectiveContent = await enhanceDocumentsWithEffectiveContent((data || []) as Document[]);
      
      console.log('[useDocuments] Enhanced documents:', documentsWithEffectiveContent.length);
      setDocuments(documentsWithEffectiveContent);
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
      const { data: document, error } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          workspace_id: data.workspace_id,
          name: data.name,
          content: data.content,
          file_type: data.file_type,
        })
        .select()
        .single();

      if (error) throw error;
      
      console.log('[useDocuments] Document created:', document);
      setDocuments(prev => [document as Document, ...prev]);
      toast.success('Document created successfully');
      return document as Document;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create document';
      setError(message);
      toast.error(message);
      return null;
    }
  };

  const updateDocument = async (id: string, updates: Partial<Pick<Document, 'name' | 'content' | 'file_type'>>) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      console.log('[useDocuments] Document updated:', data);
      setDocuments(prev => prev.map(d => d.id === id ? data as Document : d));
      return data as Document;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update document';
      setError(message);
      toast.error(message);
      return null;
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      console.log('[useDocuments] Document deleted:', id);
      setDocuments(prev => prev.filter(d => d.id !== id));
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

    // Create proper filter based on workspace selection
    // The real-time subscription should only listen to changes for the current workspace
    let channelFilter;
    let channelName;
    
    if (workspaceId) {
      channelFilter = `workspace_id=eq.${workspaceId}`;
      channelName = `document-changes-workspace-${workspaceId}`;
    } else {
      // When no workspace is selected, listen to all documents the user owns directly
      // This ensures we don't get updates from workspace documents when no workspace is selected
      channelFilter = `user_id=eq.${user.id}`;
      channelName = `document-changes-user-${user.id}`;
    }

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