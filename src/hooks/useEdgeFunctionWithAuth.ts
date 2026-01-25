import { useCallback } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, isSessionExpiredError } from '@/contexts/AuthContext';

interface EdgeFunctionOptions {
  body?: Record<string, unknown>;
}

interface EdgeFunctionResult<T> {
  data: T | null;
  error: Error | null;
  status?: number;
}

/**
 * Hook that wraps Supabase edge function calls with automatic session expiration handling.
 * 
 * Behavior:
 * - 401 Unauthorized: Triggers session expiration flow (clear local + redirect to /auth)
 * - 403 Forbidden: Returns error to caller (user stays authenticated)
 * - Other errors: Returns error to caller
 */
export function useEdgeFunctionWithAuth() {
  const { handleSessionExpired } = useAuth();

  const invoke = useCallback(async <T = unknown>(
    functionName: string,
    options?: EdgeFunctionOptions
  ): Promise<EdgeFunctionResult<T>> => {
    try {
      const { data, error } = await supabase.functions.invoke<T>(functionName, options);

      if (error) {
        // Check HTTP status first (most reliable)
        if (error instanceof FunctionsHttpError) {
          const status = error.context?.status;
          
          if (status === 401) {
            console.log(`[EdgeFunction] ${functionName}: 401 Unauthorized - triggering session expiration`);
            handleSessionExpired();
            return { data: null, error: new Error('Session expired'), status: 401 };
          }
          
          if (status === 403) {
            console.log(`[EdgeFunction] ${functionName}: 403 Forbidden - permission denied`);
            return { data: null, error: new Error('Permission denied'), status: 403 };
          }
        }
        
        // Fall back to checking error message for session-related issues
        if (isSessionExpiredError(error)) {
          console.log(`[EdgeFunction] ${functionName}: Session expired error detected`);
          handleSessionExpired();
          return { data: null, error: new Error('Session expired'), status: 401 };
        }
        
        return { data: null, error };
      }

      // Also check if the response body contains an error indicating session issues
      // (some edge functions return 200 with error in body)
      if (data && typeof data === 'object' && 'error' in data) {
        const errorData = data as { error: string };
        if (isSessionExpiredError(errorData.error)) {
          console.log(`[EdgeFunction] ${functionName}: Session expired in response body`);
          handleSessionExpired();
          return { data: null, error: new Error('Session expired'), status: 401 };
        }
      }

      return { data, error: null };
    } catch (err) {
      // Check if the caught error indicates session expiration
      if (isSessionExpiredError(err)) {
        console.log(`[EdgeFunction] ${functionName}: Session expired exception`);
        handleSessionExpired();
        return { data: null, error: new Error('Session expired'), status: 401 };
      }
      
      return { data: null, error: err as Error };
    }
  }, [handleSessionExpired]);

  return { invoke };
}
