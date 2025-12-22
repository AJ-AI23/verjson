import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ResolvedDocument {
  id: string;
  name: string;
  content: any;
  loading: boolean;
  error: string | null;
}

interface DocumentRefResolverResult {
  resolvedDocuments: Map<string, ResolvedDocument>;
  resolveRef: (ref: string) => void;
  getResolvedContent: (ref: string) => any | null;
  isLoading: (ref: string) => boolean;
  getAllResolvedSchemas: () => Record<string, any>;
}

/**
 * Hook to resolve document:// references to actual document content.
 * Used for sideloading referenced schema documents in the OpenAPI editor.
 */
export const useDocumentRefResolver = (schema: any): DocumentRefResolverResult => {
  const [resolvedDocuments, setResolvedDocuments] = useState<Map<string, ResolvedDocument>>(new Map());

  // Extract all document:// refs from the schema
  const documentRefs = useMemo(() => {
    const refs = new Set<string>();
    
    const findRefs = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.$ref && typeof obj.$ref === 'string' && obj.$ref.startsWith('document://')) {
        refs.add(obj.$ref);
      }
      
      if (Array.isArray(obj)) {
        obj.forEach(item => findRefs(item));
      } else {
        Object.values(obj).forEach(value => findRefs(value));
      }
    };
    
    findRefs(schema);
    return Array.from(refs);
  }, [schema]);

  // Load documents that haven't been loaded yet
  useEffect(() => {
    const loadDocuments = async () => {
      for (const ref of documentRefs) {
        const documentId = ref.replace('document://', '');
        
        // Skip if already loaded or loading
        const existing = resolvedDocuments.get(ref);
        if (existing && (existing.content || existing.loading)) continue;

        // Mark as loading
        setResolvedDocuments(prev => {
          const next = new Map(prev);
          next.set(ref, {
            id: documentId,
            name: '',
            content: null,
            loading: true,
            error: null
          });
          return next;
        });

        try {
          const { data, error } = await supabase
            .from('documents')
            .select('id, name, content')
            .eq('id', documentId)
            .single();

          if (error) throw error;

          setResolvedDocuments(prev => {
            const next = new Map(prev);
            next.set(ref, {
              id: documentId,
              name: data.name,
              content: data.content,
              loading: false,
              error: null
            });
            return next;
          });
        } catch (err: any) {
          setResolvedDocuments(prev => {
            const next = new Map(prev);
            next.set(ref, {
              id: documentId,
              name: '',
              content: null,
              loading: false,
              error: err.message || 'Failed to load document'
            });
            return next;
          });
        }
      }
    };

    if (documentRefs.length > 0) {
      loadDocuments();
    }
  }, [documentRefs]);

  const resolveRef = useCallback((ref: string) => {
    if (!ref.startsWith('document://')) return;
    
    const documentId = ref.replace('document://', '');
    const existing = resolvedDocuments.get(ref);
    
    if (existing && (existing.content || existing.loading)) return;

    // Trigger load
    setResolvedDocuments(prev => {
      const next = new Map(prev);
      next.set(ref, {
        id: documentId,
        name: '',
        content: null,
        loading: true,
        error: null
      });
      return next;
    });
  }, [resolvedDocuments]);

  const getResolvedContent = useCallback((ref: string): any | null => {
    const resolved = resolvedDocuments.get(ref);
    return resolved?.content || null;
  }, [resolvedDocuments]);

  const isLoading = useCallback((ref: string): boolean => {
    const resolved = resolvedDocuments.get(ref);
    return resolved?.loading || false;
  }, [resolvedDocuments]);

  // Get all resolved schemas merged with original schemas
  const getAllResolvedSchemas = useCallback((): Record<string, any> => {
    const schemas: Record<string, any> = {};
    
    // Extract component schemas from the main schema
    const componentSchemas = schema?.components?.schemas || {};
    
    for (const [name, componentSchema] of Object.entries(componentSchemas)) {
      const schemaObj = componentSchema as any;
      
      if (schemaObj?.$ref && schemaObj.$ref.startsWith('document://')) {
        // This is a document reference - try to get resolved content
        const resolved = resolvedDocuments.get(schemaObj.$ref);
        if (resolved?.content) {
          schemas[name] = resolved.content;
        } else {
          // Keep the reference with metadata for display
          schemas[name] = {
            ...schemaObj,
            'x-loading': resolved?.loading || false,
            'x-error': resolved?.error || null
          };
        }
      } else {
        schemas[name] = schemaObj;
      }
    }
    
    return schemas;
  }, [schema, resolvedDocuments]);

  return {
    resolvedDocuments,
    resolveRef,
    getResolvedContent,
    isLoading,
    getAllResolvedSchemas
  };
};

