import { supabase } from '@/integrations/supabase/client';
import { getEffectiveDocumentContentForEditor } from '@/lib/documentUtils';

export interface DocumentVersionInfo {
  documentId: string;
  latestVersionTimestamp: number;
  effectiveContentHash: string;
  hasVersionMismatch: boolean;
}

/**
 * Generate a simple hash of content for comparison
 */
export function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Get version information for a document
 */
export async function getDocumentVersionInfo(
  documentId: string,
  baseContent: any
): Promise<DocumentVersionInfo> {
  try {
    // Get the latest version timestamp
    const { data: latestVersion, error } = await supabase
      .from('document_versions')
      .select('created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const latestVersionTimestamp = latestVersion?.created_at 
      ? new Date(latestVersion.created_at).getTime()
      : 0;

    // Get the effective content and generate hash
    const effectiveContent = await getEffectiveDocumentContentForEditor(documentId, baseContent);
    const effectiveContentHash = generateContentHash(JSON.stringify(effectiveContent));

    return {
      documentId,
      latestVersionTimestamp,
      effectiveContentHash,
      hasVersionMismatch: false // Will be determined when comparing with cached data
    };
  } catch (error) {
    console.error('Error getting document version info:', error);
    
    // Fallback to base content
    const effectiveContentHash = generateContentHash(JSON.stringify(baseContent));
    
    return {
      documentId,
      latestVersionTimestamp: Date.now(),
      effectiveContentHash,
      hasVersionMismatch: false
    };
  }
}

/**
 * Compare cached version info with current document state
 */
export function compareVersionInfo(
  cached: DocumentVersionInfo | null,
  current: DocumentVersionInfo
): boolean {
  if (!cached) return false;
  
  // Check if there's a newer version or content hash mismatch
  return (
    current.latestVersionTimestamp > cached.latestVersionTimestamp ||
    current.effectiveContentHash !== cached.effectiveContentHash
  );
}