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

      const { data, error } = await supabase.functions.invoke('document-content', {
        body: { action: 'fetchDocumentWithContent', document_id: documentId }
      });

      if (error) throw error;

      setContent(data.document);
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