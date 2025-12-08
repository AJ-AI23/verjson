import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  is_active: boolean;
  key?: string; // Only present when key is first created
}

export interface CreateApiKeyParams {
  name: string;
  scopes: string[];
  expiresAt?: string | null;
}

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('api-keys', {
        body: { action: 'listApiKeys' }
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setApiKeys(data.apiKeys || []);
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  const createApiKey = useCallback(async (params: CreateApiKeyParams): Promise<{ apiKey?: ApiKey; error?: string }> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('api-keys', {
        body: { 
          action: 'createApiKey',
          name: params.name,
          scopes: params.scopes,
          expiresAt: params.expiresAt
        }
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Refresh the list
      await fetchApiKeys();
      
      return { apiKey: data.apiKey };
    } catch (err) {
      console.error('Failed to create API key:', err);
      return { error: err instanceof Error ? err.message : 'Failed to create API key' };
    }
  }, [fetchApiKeys]);

  const updateApiKey = useCallback(async (keyId: string, updates: Partial<CreateApiKeyParams>): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('api-keys', {
        body: { 
          action: 'updateApiKey',
          keyId,
          ...updates
        }
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Refresh the list
      await fetchApiKeys();
      
      return { success: true };
    } catch (err) {
      console.error('Failed to update API key:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update API key' };
    }
  }, [fetchApiKeys]);

  const revokeApiKey = useCallback(async (keyId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('api-keys', {
        body: { 
          action: 'revokeApiKey',
          keyId
        }
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Refresh the list
      await fetchApiKeys();
      
      return { success: true };
    } catch (err) {
      console.error('Failed to revoke API key:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to revoke API key' };
    }
  }, [fetchApiKeys]);

  const deleteApiKey = useCallback(async (keyId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('api-keys', {
        body: { 
          action: 'deleteApiKey',
          keyId
        }
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Refresh the list
      await fetchApiKeys();
      
      return { success: true };
    } catch (err) {
      console.error('Failed to delete API key:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete API key' };
    }
  }, [fetchApiKeys]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  return {
    apiKeys,
    loading,
    error,
    fetchApiKeys,
    createApiKey,
    updateApiKey,
    revokeApiKey,
    deleteApiKey
  };
}
