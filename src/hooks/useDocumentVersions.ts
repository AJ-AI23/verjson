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
      
      const { data, error } = await supabase.functions.invoke('document-versions', {
        body: {
          action: 'listDocumentVersions',
          documentId
        }
      });

      if (error) throw error;
      
      debugToast('🔔 fetchVersions: Retrieved versions', {
        count: data.versions?.length || 0,
        versions: data.versions?.map(v => ({ 
          id: v.id, 
          description: v.description, 
          isSelected: v.is_selected,
          isReleased: v.is_released 
        })) || []
      });
      
      setVersions(data.versions || []);
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
      const { data, error } = await supabase.functions.invoke('document-versions', {
        body: {
          action: 'createDocumentVersion',
          documentId,
          patch
        }
      });

      if (error) throw error;

      const newVersion = data.version as DocumentVersion;
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

  const createInitialVersionSafe = async (content: any): Promise<DocumentVersion | null> => {
    if (!user || !documentId) return null;

    try {
      const { data, error } = await supabase.functions.invoke('document-versions', {
        body: {
          action: 'createInitialDocumentVersion',
          documentId,
          content
        }
      });

      if (error) throw error;

      const version = data.version as DocumentVersion;
      setVersions(prev => {
        const exists = prev.find(v => v.id === version.id);
        return exists ? prev : [...prev, version];
      });
      
      return version;
    } catch (err) {
      console.error('Error creating initial version:', err);
      return null;
    }
  };

  const updateVersion = async (versionId: string, updates: Partial<DocumentVersion>): Promise<DocumentVersion | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.functions.invoke('document-versions', {
        body: {
          action: 'updateDocumentVersion',
          versionId,
          updates
        }
      });

      if (error) throw error;

      const updatedVersion = data.version as DocumentVersion;
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
      
      const { data, error } = await supabase.functions.invoke('document-versions', {
        body: {
          action: 'deleteDocumentVersion',
          versionId
        }
      });

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
      
      toast.success(data.message || 'Version deleted successfully');
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
    createInitialVersionSafe,
    updateVersion,
    deleteVersion,
    refetch: fetchVersions,
    // Memoized helper to get patches in the expected format
    getSchemaPatches: useCallback(() => {
      return schemaPatches;
    }, [schemaPatches]),
  };
}