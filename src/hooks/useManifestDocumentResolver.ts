import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ResolvedDocument {
  content: any;
  loading: boolean;
  error: string | null;
}

interface UseManifestDocumentResolverResult {
  resolveDocument: (documentId: string) => Promise<void>;
  getDocument: (documentId: string) => any | null;
  isLoading: (documentId: string) => boolean;
  getError: (documentId: string) => string | null;
  clearCache: () => void;
}

/**
 * Hook for resolving document:// references in manifest viewer.
 * Fetches linked documents on-demand and caches them for navigation.
 */
export const useManifestDocumentResolver = (): UseManifestDocumentResolverResult => {
  const [documents, setDocuments] = useState<Map<string, ResolvedDocument>>(new Map());
  const pendingRequestsRef = useRef<Set<string>>(new Set());

  const resolveDocument = useCallback(async (documentId: string): Promise<void> => {
    // Skip if already loaded or currently loading
    const existing = documents.get(documentId);
    if (existing?.content || existing?.loading) return;
    if (pendingRequestsRef.current.has(documentId)) return;

    // Mark as pending and loading
    pendingRequestsRef.current.add(documentId);
    setDocuments(prev => {
      const next = new Map(prev);
      next.set(documentId, { content: null, loading: true, error: null });
      return next;
    });

    try {
      // Fetch document content using the document-content edge function
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('document-content', {
        body: { 
          action: 'fetchDocument', 
          document_id: documentId 
        },
        headers: session?.access_token 
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch document');
      }

      const documentContent = response.data?.document?.content;
      if (!documentContent) {
        throw new Error('Document has no content');
      }

      setDocuments(prev => {
        const next = new Map(prev);
        next.set(documentId, { content: documentContent, loading: false, error: null });
        return next;
      });
    } catch (err: any) {
      console.error('[useManifestDocumentResolver] Failed to resolve document:', documentId, err);
      setDocuments(prev => {
        const next = new Map(prev);
        next.set(documentId, { 
          content: null, 
          loading: false, 
          error: err.message || 'Failed to load document' 
        });
        return next;
      });
    } finally {
      pendingRequestsRef.current.delete(documentId);
    }
  }, [documents]);

  const getDocument = useCallback((documentId: string): any | null => {
    return documents.get(documentId)?.content || null;
  }, [documents]);

  const isLoading = useCallback((documentId: string): boolean => {
    return documents.get(documentId)?.loading || false;
  }, [documents]);

  const getError = useCallback((documentId: string): string | null => {
    return documents.get(documentId)?.error || null;
  }, [documents]);

  const clearCache = useCallback(() => {
    setDocuments(new Map());
    pendingRequestsRef.current.clear();
  }, []);

  return {
    resolveDocument,
    getDocument,
    isLoading,
    getError,
    clearCache,
  };
};
