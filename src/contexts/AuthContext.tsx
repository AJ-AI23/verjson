import React, { createContext, useContext, useEffect, useState } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  // Check if demo session has expired
  const checkDemoSessionExpiration = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('demo_sessions')
        .select('expires_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking demo session:', error);
        return false;
      }

      if (data && new Date(data.expires_at) < new Date()) {
        console.log('Demo session expired, logging out');
        await signOut();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error in checkDemoSessionExpiration:', error);
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
        return;
      }

      const { data, error } = await supabase.functions.invoke('user-profile', {
        body: { action: 'getUserProfile' }
      });

      if (error) throw error;
      
      if (data?.profile) {
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Fetch profile when user signs in
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session with error handling
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session retrieval error:', error);
      }
      console.log('Initial session check:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Fetch profile for existing session
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 0);
      }
    }).catch((error) => {
      console.error('Failed to get session:', error);
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    // Fallback timeout to ensure loading state resolves
    const timeout = setTimeout(() => {
      console.log('Auth timeout - forcing loading to false');
      setLoading(false);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    console.log('Attempting sign up for:', email);
    console.log('Sign up redirect URL:', redirectUrl);
    
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
      console.error('Sign up error:', error);
    } else {
      console.log('Sign up successful for:', data.user?.email);
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    console.log('Attempting sign in for:', email);
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Sign in error:', error);
    } else {
      console.log('Sign in successful for:', data.user?.email);
    }
    
    return { error };
  };

  const signInDemo = async () => {
    console.log('Creating demo session');
    
    try {
      // Create demo session via edge function
      const { data, error } = await supabase.functions.invoke('demo-session', {
        body: { action: 'createDemoSession' }
      });

      if (error) throw error;

      console.log('Demo session created, signing in:', data.email);

      // Sign in with the generated demo credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (signInError) {
        console.error('Demo sign in error:', signInError);
        return { error: signInError };
      }

      console.log('Demo session active, expires at:', data.expiresAt);
      
      // Schedule automatic logout when session expires
      const expiresIn = new Date(data.expiresAt).getTime() - Date.now();
      setTimeout(() => {
        console.log('Demo session expired, logging out');
        signOut();
      }, expiresIn);

      return { error: null };
    } catch (error) {
      console.error('Demo session creation error:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    console.log('Signing out user');
    // Set flag to prevent auto-redirect during logout
    sessionStorage.setItem('logout-in-progress', 'true');
    
    // Clear local state immediately
    setUser(null);
    setSession(null);
    setProfile(null);
    
    await supabase.auth.signOut();
    
    // Small delay to ensure auth state is cleared before redirect
    setTimeout(() => {
      window.location.href = '/auth';
    }, 100);
  };

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
    
    console.log('Attempting password reset for:', email);
    console.log('Redirect URL:', redirectUrl);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    
    if (error) {
      console.error('Password reset error:', error);
    } else {
      console.log('Password reset request sent successfully');
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

      if (error) throw error;

      if (data?.profile) {
        setProfile(data.profile);
      }

      return { error: null };
    } catch (error) {
      console.error('Error updating profile:', error);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}