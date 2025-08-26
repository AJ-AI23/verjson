import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { SchemaPatch, Version, VersionTier } from '@/lib/versionUtils';

interface DocumentVersion {
  id: string;
  document_id: string;
  user_id: string;
  version_major: number;
  version_minor: number;
  version_patch: number;
  description: string;
  tier: VersionTier;
  is_released: boolean;
  is_selected: boolean;
  patches: any | null;
  full_document: any | null;
  created_at: string;
  updated_at: string;
}

export function useDocumentVersions(documentId?: string) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = async () => {
    if (!user || !documentId) {
      setVersions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('document_versions')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setVersions(data as DocumentVersion[] || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch versions';
      setError(message);
      console.error('Error fetching document versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const createVersion = async (patch: SchemaPatch): Promise<DocumentVersion | null> => {
    if (!user || !documentId) return null;

    try {
      const { data, error } = await supabase
        .from('document_versions')
        .insert({
          document_id: documentId,
          user_id: user.id,
          version_major: patch.version.major,
          version_minor: patch.version.minor,
          version_patch: patch.version.patch,
          description: patch.description,
          tier: patch.tier,
          is_released: patch.isReleased || false,
          is_selected: patch.isSelected !== false,
          patches: patch.patches ? JSON.stringify(patch.patches) : null,
          full_document: patch.fullDocument || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newVersion = data as DocumentVersion;
      setVersions(prev => [...prev, newVersion]);
      return newVersion;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create version';
      setError(message);
      console.error('Error creating document version:', err);
      toast.error(message);
      return null;
    }
  };

  const updateVersion = async (versionId: string, updates: Partial<DocumentVersion>): Promise<DocumentVersion | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('document_versions')
        .update(updates)
        .eq('id', versionId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      const updatedVersion = data as DocumentVersion;
      setVersions(prev => prev.map(v => v.id === versionId ? updatedVersion : v));
      return updatedVersion;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update version';
      setError(message);
      console.error('Error updating document version:', err);
      toast.error(message);
      return null;
    }
  };

  const deleteVersion = async (versionId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('document_versions')
        .delete()
        .eq('id', versionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setVersions(prev => prev.filter(v => v.id !== versionId));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete version';
      setError(message);
      console.error('Error deleting document version:', err);
      toast.error(message);
      return false;
    }
  };

  // Convert database versions to SchemaPatch format
  const convertToSchemaPatches = (dbVersions: DocumentVersion[]): SchemaPatch[] => {
    return dbVersions.map(version => ({
      id: version.id,
      timestamp: new Date(version.created_at).getTime(),
      version: {
        major: version.version_major,
        minor: version.version_minor,
        patch: version.version_patch,
      },
      description: version.description,
      patches: (() => {
        try {
          return version.patches && typeof version.patches === 'string' 
            ? JSON.parse(version.patches) 
            : version.patches || undefined;
        } catch (e) {
          console.warn('Failed to parse patches for version', version.id, e);
          return undefined;
        }
      })(),
      tier: version.tier,
      isReleased: version.is_released,
      fullDocument: version.full_document || undefined,
      isSelected: version.is_selected,
    }));
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!user || !documentId) return;

    fetchVersions();

    const channel = supabase
      .channel('document-version-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_versions',
          filter: `document_id=eq.${documentId}`,
        },
        () => {
          fetchVersions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, documentId]);

  return {
    versions,
    loading,
    error,
    createVersion,
    updateVersion,
    deleteVersion,
    refetch: fetchVersions,
    // Helper to get patches in the expected format
    getSchemaPatches: () => convertToSchemaPatches(versions),
  };
}