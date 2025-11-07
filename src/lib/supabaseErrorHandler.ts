import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js';

export interface DemoSessionExpiredError {
  isDemoExpired: boolean;
  originalError: any;
}

export function checkDemoSessionExpired(error: any): DemoSessionExpiredError {
  if (!error) {
    return { isDemoExpired: false, originalError: error };
  }

  // Check if it's a FunctionsHttpError with 401 status
  if (error instanceof Error && 'context' in error) {
    const httpError = error as FunctionsHttpError;
    if (httpError.context?.status === 401) {
      const errorStr = JSON.stringify(error);
      if (errorStr.includes('Demo session expired')) {
        console.log('[DemoSession] Detected expired session from FunctionsHttpError');
        return { isDemoExpired: true, originalError: error };
      }
    }
  }
  
  // Check error.message for "Demo session expired"
  if (error.message && typeof error.message === 'string') {
    if (error.message.includes('Demo session expired')) {
      console.log('[DemoSession] Detected expired session from error.message');
      return { isDemoExpired: true, originalError: error };
    }
  }
  
  // Check error.error for "Demo session expired"
  if (error.error) {
    const errorValue = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
    if (errorValue.includes('Demo session expired')) {
      console.log('[DemoSession] Detected expired session from error.error');
      return { isDemoExpired: true, originalError: error };
    }
  }

  // Check entire error object as string
  try {
    const errorStr = JSON.stringify(error);
    if (errorStr.includes('Demo session expired')) {
      console.log('[DemoSession] Detected expired session from JSON.stringify');
      return { isDemoExpired: true, originalError: error };
    }
  } catch (e) {
    // JSON.stringify failed, skip this check
  }
  
  return { isDemoExpired: false, originalError: error };
}
