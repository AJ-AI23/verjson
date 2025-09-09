import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export const useUserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile
  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('user-profile', {
        body: {
          action: 'getUserProfile'
        }
      });

      if (error) throw error;

      setProfile(data.profile);
    } catch (error) {
      console.error('Error fetching/creating profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Update profile
  const updateProfile = async (updates: Partial<Pick<UserProfile, 'full_name' | 'username' | 'avatar_url'>>) => {
    if (!user || !profile) return;

    try {
      const { data, error } = await supabase.functions.invoke('user-profile', {
        body: {
          action: 'updateUserProfile',
          updates
        }
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error);
        return false;
      }

      // Update local state
      setProfile(data.profile);
      toast.success(data.message || 'Profile updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
      return false;
    }
  };

  // Get display name (prioritize full_name, fallback to username, then email)
  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name;
    if (profile?.username) return profile.username;
    if (profile?.email) return profile.email;
    return 'Unknown User';
  };

  // Get username for notations (prioritize username, fallback to email prefix)
  const getNotationUsername = () => {
    if (profile?.username) return profile.username;
    if (profile?.email) return profile.email.split('@')[0];
    return 'anonymous';
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  return {
    profile,
    loading,
    fetchProfile,
    updateProfile,
    getDisplayName,
    getNotationUsername,
  };
};