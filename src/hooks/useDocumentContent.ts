import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Document } from '@/types/workspace';
import { getEffectiveDocumentContentForEditor } from '@/lib/documentUtils';

export function useDocumentContent(documentId?: string) {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      setContent(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchDocumentContent = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('[useDocumentContent] Fetching content for document:', documentId);

        // First get the basic document info with Crowdin integration
        const { data: document, error: docError } = await supabase
          .from('documents')
          .select(`
            *,
            crowdin_integration:document_crowdin_integrations (
              id,
              file_id,
              file_ids,
              filename,
              filenames,
              project_id,
              split_by_paths
            )
          `)
          .eq('id', documentId)
          .single();

        if (docError) throw docError;
        if (!document) throw new Error('Document not found');

        // Get effective content with versioning
        const effectiveContent = await getEffectiveDocumentContentForEditor(
          documentId,
          document.content
        );

        console.log('[useDocumentContent] Content loaded for document:', documentId, {
          hasCrowdinIntegration: !!document.crowdin_integration_id,
          crowdinIntegration: document.crowdin_integration
        });
        setContent(effectiveContent);
      } catch (err) {
        console.error('[useDocumentContent] Error fetching content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load document content');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentContent();
  }, [documentId]);

  return {
    content,
    loading,
    error,
  };
}