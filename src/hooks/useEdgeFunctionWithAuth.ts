import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, isSessionExpiredError } from '@/contexts/AuthContext';

interface EdgeFunctionOptions {
  body?: Record<string, unknown>;
}

/**
 * Hook that wraps Supabase edge function calls with automatic session expiration handling.
 * When an edge function returns a 401 with "User from sub claim in JWT does not exist",
 * it automatically redirects to the login page.
 */
export function useEdgeFunctionWithAuth() {
  const { handleSessionExpired } = useAuth();

  const invoke = useCallback(async <T = unknown>(
    functionName: string,
    options?: EdgeFunctionOptions
  ): Promise<{ data: T | null; error: Error | null }> => {
    try {
      const { data, error } = await supabase.functions.invoke<T>(functionName, options);

      if (error) {
        // Check if this is a session expiration error
        if (isSessionExpiredError(error)) {
          handleSessionExpired();
          return { data: null, error: new Error('Session expired') };
        }
        return { data: null, error };
      }

      // Also check if the response body contains an error indicating session issues
      if (data && typeof data === 'object' && 'error' in data) {
        const errorData = data as { error: string };
        if (
          errorData.error === 'Unauthorized' ||
          isSessionExpiredError(errorData.error)
        ) {
          handleSessionExpired();
          return { data: null, error: new Error('Session expired') };
        }
      }

      return { data, error: null };
    } catch (err) {
      if (isSessionExpiredError(err)) {
        handleSessionExpired();
        return { data: null, error: new Error('Session expired') };
      }
      return { data: null, error: err as Error };
    }
  }, [handleSessionExpired]);

  return { invoke };
}
