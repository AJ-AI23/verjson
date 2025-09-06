import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CollaborationUser {
  id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  cursor_position?: any;
  last_seen: string;
}

interface UseCollaborationProps {
  documentId: string | null;
}

interface UseCollaborationResult {
  activeUsers: CollaborationUser[];
  isLoading: boolean;
  error: string | null;
}

export const useCollaboration = ({
  documentId
}: UseCollaborationProps): UseCollaborationResult => {
  const [activeUsers, setActiveUsers] = useState<CollaborationUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveUsers = useCallback(async () => {
    if (!documentId) {
      setActiveUsers([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('collaboration_sessions')
        .select('*')
        .eq('document_id', documentId)
        .gt('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Active in last 5 minutes
        .order('last_seen', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setActiveUsers(data || []);
    } catch (err) {
      console.error('Error fetching active users:', err);
      setError('Failed to load collaboration info');
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  // Subscribe to real-time collaboration session changes
  useEffect(() => {
    if (!documentId) return;

    fetchActiveUsers();

    const channel = supabase
      .channel(`collaboration-${documentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collaboration_sessions',
          filter: `document_id=eq.${documentId}`
        },
        () => {
          fetchActiveUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId, fetchActiveUsers]);

  return {
    activeUsers,
    isLoading,
    error
  };
};