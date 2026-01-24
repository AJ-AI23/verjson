import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js';

export interface DemoSessionExpiredError {
  isDemoExpired: boolean;
  isSessionInvalid: boolean;
  originalError: any;
}

// Patterns that indicate the session/user is no longer valid
const SESSION_INVALID_PATTERNS = [
  'User from sub claim in JWT does not exist',
  'JWT expired',
  'Invalid JWT',
  'session_not_found',
  'Unauthorized',
];

/**
 * Check if an error indicates the user's session is no longer valid.
 * This handles both demo session expiration and general session invalidation
 * (e.g., when the user no longer exists in the database).
 */
export function checkDemoSessionExpired(error: any): DemoSessionExpiredError {
  if (!error) {
    return { isDemoExpired: false, isSessionInvalid: false, originalError: error };
  }

  // Convert error to string for pattern matching
  let errorStr = '';
  try {
    if (error.message && typeof error.message === 'string') {
      errorStr += error.message + ' ';
    }
    if (error.error && typeof error.error === 'string') {
      errorStr += error.error + ' ';
    }
    errorStr += JSON.stringify(error);
  } catch (e) {
    // JSON.stringify failed, use what we have
  }

  // Check for demo session expiration
  if (errorStr.includes('Demo session expired')) {
    console.log('[SessionCheck] Detected expired demo session');
    return { isDemoExpired: true, isSessionInvalid: true, originalError: error };
  }

  // Check for session invalidation patterns (user deleted, JWT issues, etc.)
  for (const pattern of SESSION_INVALID_PATTERNS) {
    if (errorStr.includes(pattern)) {
      console.log('[SessionCheck] Detected invalid session:', pattern);
      
      // Trigger redirect to login page for session invalidation
      handleSessionInvalidRedirect();
      
      return { isDemoExpired: false, isSessionInvalid: true, originalError: error };
    }
  }

  // Check if it's a FunctionsHttpError with 401 status
  if (error instanceof Error && 'context' in error) {
    const httpError = error as FunctionsHttpError;
    if (httpError.context?.status === 401) {
      console.log('[SessionCheck] Detected 401 from FunctionsHttpError');
      handleSessionInvalidRedirect();
      return { isDemoExpired: false, isSessionInvalid: true, originalError: error };
    }
  }
  
  return { isDemoExpired: false, isSessionInvalid: false, originalError: error };
}

/**
 * Redirect to login page when session is invalid.
 * Uses a debounce to prevent multiple redirects.
 */
let redirectTimeout: ReturnType<typeof setTimeout> | null = null;

function handleSessionInvalidRedirect() {
  // Debounce to prevent multiple simultaneous redirects
  if (redirectTimeout) return;
  
  // Check if we're already on the auth page
  if (window.location.pathname === '/auth') return;
  
  redirectTimeout = setTimeout(() => {
    redirectTimeout = null;
    console.log('[SessionCheck] Redirecting to login due to invalid session');
    window.location.href = '/auth?expired=true';
  }, 100);
}
