import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  sessionValidated: boolean;
  updateProfile: (updates: Partial<Pick<UserProfile, 'full_name' | 'username' | 'avatar_url'>>) => Promise<{ error: Error | null }>;
  getDisplayName: () => string;
  getNotationUsername: () => string;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInDemo: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  handleSessionExpired: () => void;
  forceLocalSignOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Local storage key for Supabase auth token
const AUTH_STORAGE_KEY = 'sb-swghcmyqracwifpdfyap-auth-token';

// Check if an error indicates an expired/invalid session
export function isSessionExpiredError(error: unknown): boolean {
  if (!error) return false;
  
  const errorMessage = error instanceof Error 
    ? error.message 
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  
  return (
    errorMessage.includes('User from sub claim in JWT does not exist') ||
    errorMessage.includes('JWT expired') ||
    errorMessage.includes('Invalid JWT') ||
    errorMessage.includes('session_not_found')
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [sessionValidated, setSessionValidated] = useState(false);
  
  // Prevent multiple simultaneous session expiration handlers
  const isHandlingSessionExpired = useRef(false);

  /**
   * Force local sign out - clears all local auth state regardless of network.
   * Use this when we know the session is invalid server-side.
   */
  const forceLocalSignOut = useCallback(async () => {
    console.log('[Auth] Force local sign out triggered');
    
    // Set flag to prevent Auth page from auto-redirecting
    sessionStorage.setItem('logout-in-progress', Date.now().toString());
    
    // Clear React state immediately
    setUser(null);
    setSession(null);
    setProfile(null);
    setSessionValidated(false);
    
    // Clear localStorage directly as a safety net
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.error('[Auth] Failed to clear localStorage:', e);
    }
    
    // Sign out locally (doesn't require network)
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('[Auth] Error during local sign out:', e);
    }
    
    console.log('[Auth] Force local sign out complete');
  }, []);

  /**
   * Validate session against the server using getUser().
   * Returns true if session is valid, false otherwise.
   */
  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[Auth] Validating session against server...');
      const { data, error } = await supabase.auth.getUser();
      
      if (error) {
        console.log('[Auth] Session validation failed:', error.message);
        if (isSessionExpiredError(error)) {
          await forceLocalSignOut();
          return false;
        }
        return false;
      }
      
      if (!data.user) {
        console.log('[Auth] Session validation: no user returned');
        await forceLocalSignOut();
        return false;
      }
      
      console.log('[Auth] Session validated successfully for:', data.user.email);
      return true;
    } catch (e) {
      console.error('[Auth] Session validation error:', e);
      return false;
    }
  }, [forceLocalSignOut]);

  // Check if demo session has expired
  const checkDemoSessionExpiration = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('demo_sessions')
        .select('expires_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        // If we get an auth error here, the session is invalid
        if (isSessionExpiredError(error)) {
          console.log('[Auth] Demo session check failed - session invalid');
          return true; // Treat as expired
        }
        console.error('[Auth] Error checking demo session:', error);
        return false;
      }

      if (data && new Date(data.expires_at) < new Date()) {
        console.log('[Auth] Demo session expired');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Auth] Error in checkDemoSessionExpiration:', error);
      return false;
    }
  };

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    setProfileLoading(true);
    try {
      // First check if demo session has expired
      const isExpired = await checkDemoSessionExpiration(userId);
      if (isExpired) {
        setProfileLoading(false);
        await forceLocalSignOut();
        return;
      }

      const { data, error } = await supabase.functions.invoke('user-profile', {
        body: { action: 'getUserProfile' }
      });

      if (error) {
        if (isSessionExpiredError(error)) {
          await forceLocalSignOut();
          return;
        }
        throw error;
      }
      
      if (data?.profile) {
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('[Auth] Error fetching profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        
        console.log('[Auth] Auth state change:', event, newSession?.user?.email);
        
        // On SIGNED_OUT event, clear everything
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setSessionValidated(false);
          return;
        }
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // Fetch profile when user signs in (deferred to avoid deadlock)
        if (newSession?.user) {
          // Validate session and fetch profile outside the callback
          setTimeout(async () => {
            if (!mounted) return;
            const isValid = await validateSession();
            if (!mounted) return;
            
            if (isValid) {
              setSessionValidated(true);
              fetchProfile(newSession.user.id);
            } else {
              // Session invalid - state already cleared by validateSession
              console.log('[Auth] Session invalid after auth state change');
            }
          }, 0);
        } else {
          setProfile(null);
          setSessionValidated(false);
        }
      }
    );

    // THEN check for existing session with error handling
    const initializeSession = async () => {
      try {
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('[Auth] Session retrieval error:', error);
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        
        console.log('[Auth] Initial session check:', existingSession?.user?.email);
        
        if (existingSession?.user) {
          // Validate the session against the server
          const isValid = await validateSession();
          if (!mounted) return;
          
          if (isValid) {
            setSession(existingSession);
            setUser(existingSession.user);
            setSessionValidated(true);
            // Fetch profile for existing session
            setTimeout(() => {
              if (mounted) fetchProfile(existingSession.user.id);
            }, 0);
          } else {
            // Session was invalid, already cleared by validateSession
            console.log('[Auth] Initial session was invalid');
          }
        } else {
          setSession(null);
          setUser(null);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('[Auth] Failed to get session:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    };

    initializeSession();

    // Fallback timeout to ensure loading state resolves
    const timeout = setTimeout(() => {
      if (mounted) {
        console.log('[Auth] Auth timeout - forcing loading to false');
        setLoading(false);
      }
    }, 5000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [validateSession]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    console.log('[Auth] Attempting sign up for:', email);
    
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    if (error) {
      console.error('[Auth] Sign up error:', error);
    } else {
      console.log('[Auth] Sign up successful for:', data.user?.email);
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    console.log('[Auth] Attempting sign in for:', email);
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('[Auth] Sign in error:', error);
    } else {
      console.log('[Auth] Sign in successful for:', data.user?.email);
      setSessionValidated(true);
    }
    
    return { error };
  };

  const signInDemo = async () => {
    console.log('[Auth] Creating demo session');
    
    try {
      // Create demo session via edge function
      const { data, error } = await supabase.functions.invoke('demo-session', {
        body: { action: 'createDemoSession' }
      });

      if (error) throw error;

      console.log('[Auth] Demo session created, signing in:', data.email);

      // Sign in with the generated demo credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (signInError) {
        console.error('[Auth] Demo sign in error:', signInError);
        return { error: signInError };
      }

      console.log('[Auth] Demo session active, expires at:', data.expiresAt);
      setSessionValidated(true);
      
      // Schedule automatic logout when session expires
      const expiresIn = new Date(data.expiresAt).getTime() - Date.now();
      setTimeout(() => {
        console.log('[Auth] Demo session expired, logging out');
        forceLocalSignOut().then(() => {
          window.location.replace('/auth?expired=true');
        });
      }, expiresIn);

      return { error: null };
    } catch (error) {
      console.error('[Auth] Demo session creation error:', error);
      return { error: error as Error };
    }
  };

  const signOut = useCallback(async () => {
    console.log('[Auth] Signing out user');
    
    // Set flag to prevent Auth page from auto-redirecting
    sessionStorage.setItem('logout-in-progress', Date.now().toString());
    
    // Clear local state immediately
    setUser(null);
    setSession(null);
    setProfile(null);
    setSessionValidated(false);
    
    // Clear localStorage directly as a safety net
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.error('[Auth] Failed to clear localStorage:', e);
    }
    
    // Sign out (try full signout, fall back to local)
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Auth] Sign out error, trying local:', e);
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (e2) {
        console.error('[Auth] Local sign out also failed:', e2);
      }
    }
    
    // Use replace to prevent back-button loops
    window.location.replace('/auth');
  }, []);

  // Handle expired/invalid session - call this when edge functions return 401 with user not found
  const handleSessionExpired = useCallback(() => {
    // Prevent multiple simultaneous handlers
    if (isHandlingSessionExpired.current) {
      console.log('[Auth] Session expiration already being handled');
      return;
    }
    
    // Don't redirect if already on auth page
    if (window.location.pathname === '/auth') {
      console.log('[Auth] Already on auth page, skipping redirect');
      return;
    }
    
    isHandlingSessionExpired.current = true;
    console.log('[Auth] Session expired or user no longer exists, redirecting to login');
    
    forceLocalSignOut().then(() => {
      window.location.replace('/auth?expired=true');
    }).finally(() => {
      // Reset the flag after a delay to allow for page navigation
      setTimeout(() => {
        isHandlingSessionExpired.current = false;
      }, 2000);
    });
  }, [forceLocalSignOut]);

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { error };
  };

  const updateEmail = async (newEmail: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { error } = await supabase.auth.updateUser({
      email: newEmail
    }, {
      emailRedirectTo: redirectUrl
    });
    return { error };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    console.log('[Auth] Attempting password reset for:', email);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    
    if (error) {
      console.error('[Auth] Password reset error:', error);
    } else {
      console.log('[Auth] Password reset request sent successfully');
    }
    
    return { error };
  };

  const updateProfile = async (updates: Partial<Pick<UserProfile, 'full_name' | 'username' | 'avatar_url'>>) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { data, error } = await supabase.functions.invoke('user-profile', {
        body: {
          action: 'updateUserProfile',
          updates
        }
      });

      if (error) {
        if (isSessionExpiredError(error)) {
          handleSessionExpired();
          return { error: new Error('Session expired') };
        }
        throw error;
      }

      if (data?.profile) {
        setProfile(data.profile);
      }

      return { error: null };
    } catch (error) {
      console.error('[Auth] Error updating profile:', error);
      return { error: error as Error };
    }
  };

  const getDisplayName = () => {
    if (profile?.username) return profile.username;
    if (profile?.full_name) return profile.full_name;
    if (profile?.email) return profile.email.split('@')[0];
    if (user?.email) return user.email.split('@')[0];
    return 'User';
  };

  const getNotationUsername = () => {
    if (profile?.username) return profile.username;
    if (user?.email) return user.email.split('@')[0];
    return 'anonymous';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profile,
        profileLoading,
        sessionValidated,
        updateProfile,
        getDisplayName,
        getNotationUsername,
        signUp,
        signIn,
        signInDemo,
        signOut,
        updatePassword,
        updateEmail,
        resetPassword,
        handleSessionExpired,
        forceLocalSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
