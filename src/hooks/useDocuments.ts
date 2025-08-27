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
    if (!user) return;
    
    try {
      setLoading(true);
      let query = supabase.from('documents').select('*');
      
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      
      // Enhance documents with effective content from released versions
      const documentsWithEffectiveContent = await enhanceDocumentsWithEffectiveContent((data || []) as Document[]);
      setDocuments(documentsWithEffectiveContent);
    } catch (err) {
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
      
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success('Document and all associated versions deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document';
      setError(message);
      toast.error(message);
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return;

    fetchDocuments();

    let filter = `user_id=eq.${user.id}`;
    if (workspaceId) {
      filter += `,workspace_id=eq.${workspaceId}`;
    }

    const channel = supabase
      .channel('document-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter,
        },
        () => {
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
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