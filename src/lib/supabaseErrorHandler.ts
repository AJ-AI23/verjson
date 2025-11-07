import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js';

export interface DemoSessionExpiredError {
  isDemoExpired: boolean;
  originalError: any;
}

export function checkDemoSessionExpired(error: any): DemoSessionExpiredError {
  // Check if it's a 401 error with "Demo session expired" message
  if (error) {
    // Check FunctionsHttpError (status 401)
    if (error instanceof Error && 'context' in error) {
      const httpError = error as FunctionsHttpError;
      if (httpError.context?.status === 401) {
        // Check if the error message or body contains "Demo session expired"
        const errorStr = JSON.stringify(error);
        if (errorStr.includes('Demo session expired')) {
          return { isDemoExpired: true, originalError: error };
        }
      }
    }
    
    // Check error message directly
    const errorMessage = error?.message || error?.error || '';
    if (typeof errorMessage === 'string' && errorMessage.includes('Demo session expired')) {
      return { isDemoExpired: true, originalError: error };
    }
    
    // Check if error has a status property
    if (error?.status === 401) {
      const errorStr = JSON.stringify(error);
      if (errorStr.includes('Demo session expired')) {
        return { isDemoExpired: true, originalError: error };
      }
    }
  }
  
  return { isDemoExpired: false, originalError: error };
}
