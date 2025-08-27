import { supabase } from '@/integrations/supabase/client';

/**
 * Gets the effective content for a document, prioritizing the latest released version
 * over the base document content.
 */
export async function getEffectiveDocumentContent(documentId: string, baseContent: any): Promise<any> {
  try {
    // Fetch the latest released version
    const { data: latestReleasedVersion, error } = await supabase
      .from('document_versions')
      .select('full_document, version_major, version_minor, version_patch, created_at')
      .eq('document_id', documentId)
      .eq('is_released', true)
      .order('version_major', { ascending: false })
      .order('version_minor', { ascending: false })
      .order('version_patch', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // If we have a released version with full_document, use it
    if (!error && latestReleasedVersion?.full_document) {
      return latestReleasedVersion.full_document;
    }

    // Otherwise, fall back to the base document content
    return baseContent;
  } catch (error) {
    console.error('Error fetching effective document content:', error);
    // On error, fall back to base content
    return baseContent;
  }
}

/**
 * Enhances documents with their effective content from released versions
 */
export async function enhanceDocumentsWithEffectiveContent<T extends { id: string; content: any }>(
  documents: T[]
): Promise<T[]> {
  const enhancedDocuments = await Promise.all(
    documents.map(async (document) => {
      const effectiveContent = await getEffectiveDocumentContent(document.id, document.content);
      return {
        ...document,
        content: effectiveContent,
      };
    })
  );

  return enhancedDocuments;
}
