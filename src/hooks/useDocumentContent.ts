import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DocumentVersion {
  id: string;
  version_major: number;
  version_minor: number;
  version_patch: number;
  description: string;
  is_released: boolean;
  created_at: string;
}

export interface DocumentWithContent {
  id: string;
  name: string;
  workspace_id: string;
  user_id: string;
  file_type: string;
  created_at: string;
  updated_at: string;
  import_url?: string;
  is_public?: boolean;
  crowdin_integration_id?: string;
  content: any;
}

export function useDocumentContent(documentId?: string, documentVersionId?: string) {
  const [document, setDocument] = useState<DocumentWithContent | null>(null);
  const [version, setVersion] = useState<DocumentVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedDocumentId, setFetchedDocumentId] = useState<string | null>(null);
  const [fetchedVersionId, setFetchedVersionId] = useState<string | null | undefined>(null);

  const fetchDocument = useCallback(async (docId: string, versionId?: string) => {
    try {
      console.log('[useDocumentContent] 📥 Fetching document with versions applied:', { docId, versionId });
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('document-management', {
        body: { 
          action: 'fetchDocument', 
          id: docId,
          document_version_id: versionId
        }
      });

      if (error) throw error;

      console.log('[useDocumentContent] ✅ Document loaded with content applied:', {
        docId: data.document?.id,
        contentKeys: data.document?.content ? Object.keys(data.document.content).length : 0,
        version: data.version ? `${data.version.version_major}.${data.version.version_minor}.${data.version.version_patch}` : null
      });
      
      setDocument(data.document);
      setVersion(data.version);
      setFetchedDocumentId(docId);
      setFetchedVersionId(versionId);
    } catch (err) {
      console.error('[useDocumentContent] ❌ Error fetching document:', err);
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('[useDocumentContent] 🔄 Effect triggered:', {
      documentId,
      documentVersionId,
      fetchedDocumentId,
      fetchedVersionId,
      willFetch: documentId && (fetchedDocumentId !== documentId || fetchedVersionId !== documentVersionId)
    });

    if (!documentId) {
      console.log('[useDocumentContent] 🧹 Clearing content - no documentId');
      setDocument(null);
      setVersion(null);
      setLoading(false);
      setError(null);
      setFetchedDocumentId(null);
      setFetchedVersionId(null);
      return;
    }

    // Only fetch if document ID or version ID changed
    if (fetchedDocumentId === documentId && fetchedVersionId === documentVersionId) {
      console.log('[useDocumentContent] ⚠️ Document already loaded, skipping refetch:', documentId);
      return;
    }

    fetchDocument(documentId, documentVersionId);
  }, [documentId, documentVersionId, fetchedDocumentId, fetchedVersionId, fetchDocument]);

  // Expose refetch function for manual refresh
  const refetch = useCallback(() => {
    if (documentId) {
      setFetchedDocumentId(null);
      setFetchedVersionId(null);
      fetchDocument(documentId, documentVersionId);
    }
  }, [documentId, documentVersionId, fetchDocument]);

  return {
    document,
    content: document?.content ?? null,
    version,
    loading,
    error,
    refetch,
  };
}
