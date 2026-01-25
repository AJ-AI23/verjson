import { useState, useEffect, useRef } from 'react';
import { useEdgeFunctionWithAuth } from './useEdgeFunctionWithAuth';
import { useAuth } from '@/contexts/AuthContext';

export function useDocumentContent(documentId?: string) {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedDocumentId, setFetchedDocumentId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const { invoke } = useEdgeFunctionWithAuth();
  const { user } = useAuth();

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
      const requestId = ++requestIdRef.current;
      try {
        console.log('[useDocumentContent] 📥 Fetching content for document:', documentId);
        // Clear stale content immediately so we never show previous doc while loading the next one
        setContent(null);
        setLoading(true);
        setError(null);

        const { data, error: fetchError, status } = await invoke<{ document: any }>('document-content', {
          body: { action: 'fetchDocument', document_id: documentId }
        });

        // 401 is already handled by useEdgeFunctionWithAuth (redirects to /auth)
        if (status === 401) {
          return;
        }

        if (fetchError) throw fetchError;

        // Ignore stale responses (user switched documents while request was in flight)
        if (requestId !== requestIdRef.current) {
          console.log('[useDocumentContent] ⏭️ Ignoring stale response for document:', documentId);
          return;
        }

        console.log('[useDocumentContent] ✅ Content loaded successfully, content length:', JSON.stringify(data?.document?.content || {}).length);
        setContent(data?.document);
        setFetchedDocumentId(documentId);
      } catch (err) {
        console.error('[useDocumentContent] ❌ Error fetching content:', err);
        // Ignore stale errors
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load document content');
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
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