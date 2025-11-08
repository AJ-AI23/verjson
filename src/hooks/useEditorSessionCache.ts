import { useEffect, useCallback, useRef } from 'react';

interface UseEditorSessionCacheProps {
  documentId?: string;
  currentSchema: string;
  isModified: boolean;
}

/**
 * Hook to cache uncommitted editor changes in sessionStorage
 * to prevent data loss when switching browser tabs
 */
export const useEditorSessionCache = ({
  documentId,
  currentSchema,
  isModified
}: UseEditorSessionCacheProps) => {
  const cacheKey = documentId ? `editor-cache-${documentId}` : null;
  const lastSavedSchema = useRef<string>('');

  // Save to sessionStorage when schema changes and is modified
  useEffect(() => {
    if (!cacheKey || !isModified) return;

    // Only save if schema actually changed
    if (currentSchema !== lastSavedSchema.current) {
      console.log('💾 Caching uncommitted changes to sessionStorage');
      sessionStorage.setItem(cacheKey, JSON.stringify({
        schema: currentSchema,
        timestamp: Date.now()
      }));
      lastSavedSchema.current = currentSchema;
    }
  }, [cacheKey, currentSchema, isModified]);

  // Load from sessionStorage
  const loadCachedSchema = useCallback((): string | null => {
    if (!cacheKey) return null;

    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (!cached) return null;

      const { schema, timestamp } = JSON.parse(cached);
      
      // Only use cache if it's less than 1 hour old
      const age = Date.now() - timestamp;
      if (age > 60 * 60 * 1000) {
        console.log('🗑️ Cached schema too old, discarding');
        sessionStorage.removeItem(cacheKey);
        return null;
      }

      console.log('📦 Found cached uncommitted changes from sessionStorage');
      return schema;
    } catch (err) {
      console.error('Failed to load cached schema:', err);
      return null;
    }
  }, [cacheKey]);

  // Clear cache (call after successful save)
  const clearCache = useCallback(() => {
    if (!cacheKey) return;
    console.log('🧹 Clearing editor cache');
    sessionStorage.removeItem(cacheKey);
    lastSavedSchema.current = '';
  }, [cacheKey]);

  // Check if cache exists
  const hasCachedChanges = useCallback((): boolean => {
    if (!cacheKey) return false;
    return sessionStorage.getItem(cacheKey) !== null;
  }, [cacheKey]);

  return {
    loadCachedSchema,
    clearCache,
    hasCachedChanges
  };
};
