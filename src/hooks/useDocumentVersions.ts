import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { SchemaPatch, Version, VersionTier } from '@/lib/versionUtils';
import { useDebug } from '@/contexts/DebugContext';

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
  const { debugToast } = useDebug();
  const { user } = useAuth();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = async () => {
    if (!user || !documentId) {
      debugToast('🔔 fetchVersions: No user or documentId, clearing versions');
      setVersions([]);
      setLoading(false);
      return;
    }

    try {
      debugToast('🔔 fetchVersions: Fetching versions for document', documentId);
      setLoading(true);
      const { data, error } = await supabase
        .from('document_versions')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      debugToast('🔔 fetchVersions: Retrieved versions', {
        count: data?.length || 0,
        versions: data?.map(v => ({ 
          id: v.id, 
          description: v.description, 
          isSelected: v.is_selected,
          isReleased: v.is_released 
        })) || []
      });
      
      setVersions(data as DocumentVersion[] || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch versions';
      setError(message);
      console.error('🔔 fetchVersions: Error fetching document versions:', err);
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
      debugToast('🗑️ deleteVersion: Attempting to delete version', versionId);
      const { error } = await supabase
        .from('document_versions')
        .delete()
        .eq('id', versionId)
        .eq('user_id', user.id);

      if (error) throw error;

      debugToast('🗑️ deleteVersion: Successfully deleted from database, updating local state');
      setVersions(prev => {
        const updated = prev.filter(v => v.id !== versionId);
        debugToast('🗑️ deleteVersion: Local versions updated', {
          before: prev.length,
          after: updated.length,
          deletedId: versionId
        });
        return updated;
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete version';
      setError(message);
      console.error('🗑️ deleteVersion: Error deleting document version:', err);
      toast.error(message);
      return false;
    }
  };

  // Memoized conversion function to prevent recreation on every render
  const convertToSchemaPatches = useMemo(() => {
    return (dbVersions: DocumentVersion[]): SchemaPatch[] => {
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
  }, []); // Empty dependency array since the function logic is static

  // Memoized schema patches to prevent recalculation on every getSchemaPatches call
  const schemaPatches = useMemo(() => {
    return convertToSchemaPatches(versions);
  }, [versions, convertToSchemaPatches]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user || !documentId) return;

    debugToast('🔔 Setting up real-time subscription for document', documentId);
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
        (payload) => {
          debugToast('🔔 Real-time event received', {
            eventType: payload.eventType,
            table: payload.table,
            documentId: documentId,
          });
          fetchVersions();
        }
      )
      .subscribe((status) => {
        debugToast('🔔 Subscription status', { status, documentId });
      });

    return () => {
      debugToast('🔔 Cleaning up subscription for document', documentId);
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
    // Memoized helper to get patches in the expected format
    getSchemaPatches: useCallback(() => {
      return schemaPatches;
    }, [schemaPatches]),
  };
}