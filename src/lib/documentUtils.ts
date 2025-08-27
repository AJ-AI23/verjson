import { supabase } from '@/integrations/supabase/client';
import { applySelectedPatches, SchemaPatch, VersionTier } from '@/lib/versionUtils';
import { Operation } from 'fast-json-patch';

/**
 * Gets the effective content for import comparison - only the latest released version
 * without any newer patches applied.
 */
export async function getEffectiveDocumentContentForImport(documentId: string, baseContent: any): Promise<any> {
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
    console.error('Error fetching effective document content for import:', error);
    // On error, fall back to base content
    return baseContent;
  }
}

/**
 * Gets the effective content for the editor - latest released version + newer selected patches
 */
export async function getEffectiveDocumentContentForEditor(documentId: string, baseContent: any): Promise<any> {
  try {
    // Fetch all document versions for this document
    const { data: versions, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching document versions:', error);
      return baseContent;
    }

    if (!versions || versions.length === 0) {
      return baseContent;
    }

    // Convert to schema patches format and apply selected patches
    const schemaPatches: SchemaPatch[] = versions.map(version => ({
      id: version.id,
      timestamp: new Date(version.created_at).getTime(),
      version: {
        major: version.version_major,
        minor: version.version_minor,
        patch: version.version_patch
      },
      description: version.description,
      patches: (version.patches as unknown) as Operation[] | undefined,
      tier: version.tier as VersionTier,
      isReleased: version.is_released,
      isSelected: version.is_selected,
      fullDocument: version.full_document
    }));

    // Apply selected patches starting from base content
    return applySelectedPatches(schemaPatches, undefined);
  } catch (error) {
    console.error('Error getting effective document content for editor:', error);
    return baseContent;
  }
}

/**
 * Enhances documents with their effective content for the editor (released version + newer patches)
 */
export async function enhanceDocumentsWithEffectiveContent<T extends { id: string; content: any }>(
  documents: T[]
): Promise<T[]> {
  const enhancedDocuments = await Promise.all(
    documents.map(async (document) => {
      const effectiveContent = await getEffectiveDocumentContentForEditor(document.id, document.content);
      return {
        ...document,
        content: effectiveContent,
      };
    })
  );

  return enhancedDocuments;
}
