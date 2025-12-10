import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Document } from '@/types/workspace';
import { getEffectiveDocumentContentForEditor } from '@/lib/documentUtils';

export function useDocumentContent(documentId?: string) {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedDocumentId, setFetchedDocumentId] = useState<string | null>(null);

  useEffect(() => {
    console.log('[useDocumentContent] 🔄 Effect triggered:', {
      documentId,
      fetchedDocumentId,
      willFetch: documentId && fetchedDocumentId !== documentId
    });

    if (!documentId) {
      console.log('[useDocumentContent] 🧹 Clearing content - no documentId');
      setContent(null);
      setLoading(false);
      setError(null);
      setFetchedDocumentId(null);
      return;
    }

    // ⚠️ CRITICAL: Only fetch if we haven't already fetched this document
    // This prevents refetching stale data on tab switches/re-renders
    if (fetchedDocumentId === documentId) {
      console.log('[useDocumentContent] ⚠️ Document already loaded, skipping refetch:', documentId);
      return;
    }

    const fetchDocumentContent = async () => {
      try {
        console.log('[useDocumentContent] 📥 Fetching content for document:', documentId);
        setLoading(true);
        setError(null);

        const { data, error } = await supabase.functions.invoke('document-content', {
          body: { action: 'fetchDocument', document_id: documentId }
        });

        if (error) throw error;

        console.log('[useDocumentContent] ✅ Content loaded successfully, content length:', JSON.stringify(data.document?.content || {}).length);
        setContent(data.document);
        setFetchedDocumentId(documentId);
      } catch (err) {
        console.error('[useDocumentContent] ❌ Error fetching content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load document content');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentContent();
  }, [documentId]); // REMOVED fetchedDocumentId from deps to prevent extra re-runs

  return {
    content,
    loading,
    error,
  };
}