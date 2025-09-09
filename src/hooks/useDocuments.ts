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
      
      const query = supabase
        .from('documents')
        .select('id, name, workspace_id, user_id, file_type, created_at, updated_at') // Only metadata, no content
        .eq('workspace_id', workspaceId);
      
      console.log('[useDocuments] Applied workspace filter:', workspaceId);
      
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
      
      // Store documents with metadata only - content will be loaded when document is selected
      console.log('[useDocuments] Documents metadata fetched:', data?.length || 0);
      setDocuments((data || []) as Document[]);
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
      
      // Create initial version if content is not empty
      if (data.content && typeof data.content === 'object' && Object.keys(data.content).length > 0) {
        try {
          console.log('[useDocuments] Creating initial version for document:', document.id);
          await supabase.rpc('create_initial_version_safe', {
            p_document_id: document.id,
            p_user_id: user.id,
            p_content: data.content
          });
          console.log('[useDocuments] Initial version created successfully');
        } catch (versionError) {
          console.error('[useDocuments] Failed to create initial version:', versionError);
          // Don't fail document creation if version creation fails
        }
      }
      
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