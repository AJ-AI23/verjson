import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
      
      // Trigger sign out and redirect to login page
      handleSessionInvalidRedirect();
      
      return { isDemoExpired: false, isSessionInvalid: true, originalError: error };
    }
  }

  // Check if it's a FunctionsHttpError with 401 status and contains session-related error
  if (error instanceof Error && 'context' in error) {
    const httpError = error as FunctionsHttpError;
    if (httpError.context?.status === 401) {
      // Only auto-redirect for session invalidation, not for general auth errors
      // Check if any session pattern matches
      for (const pattern of SESSION_INVALID_PATTERNS) {
        if (errorStr.includes(pattern)) {
          console.log('[SessionCheck] Detected 401 with session pattern:', pattern);
          handleSessionInvalidRedirect();
          return { isDemoExpired: false, isSessionInvalid: true, originalError: error };
        }
      }
    }
  }
  
  return { isDemoExpired: false, isSessionInvalid: false, originalError: error };
}

/**
 * Sign out and redirect to login page when session is invalid.
 * Uses a flag to prevent multiple simultaneous redirects.
 */
let isRedirecting = false;

async function handleSessionInvalidRedirect() {
  // Prevent multiple simultaneous redirects
  if (isRedirecting) return;
  
  // Check if we're already on the auth page
  if (window.location.pathname === '/auth') return;
  
  isRedirecting = true;
  console.log('[SessionCheck] Signing out and redirecting to login due to invalid session');
  
  // Set flag to prevent Auth page from auto-redirecting
  sessionStorage.setItem('logout-in-progress', 'true');
  
  try {
    // Sign out to clear the local session state
    await supabase.auth.signOut();
  } catch (e) {
    console.error('[SessionCheck] Error signing out:', e);
  }
  
  // Redirect to login page
  window.location.href = '/auth?expired=true';
}
