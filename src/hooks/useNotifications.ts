import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeService } from './useRealtimeService';
import { toast } from 'sonner';

// Global event handlers for triggering updates in other hooks
let globalInvitationUpdateHandler: (() => void) | null = null;
let globalWorkspaceUpdateHandler: (() => void) | null = null;

export const registerInvitationUpdateHandler = (handler: () => void) => {
  globalInvitationUpdateHandler = handler;
};

export const registerWorkspaceUpdateHandler = (handler: () => void) => {
  globalWorkspaceUpdateHandler = handler;
};

export interface Notification {
  id: string;
  user_id: string;
  document_id?: string;
  workspace_id?: string;
  type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

// Helper function to compute unread count considering optimistic updates
const computeUnreadCount = (notifications: Notification[], optimisticReadIds: Set<string>) => {
  return notifications.filter(n => {
    // If it's already read in DB, it's read
    if (n.read_at) return false;
    
    // If it's optimistically marked as read, consider it read
    if (optimisticReadIds.has(n.id)) return false;
    
    // Otherwise it's unread
    return true;
  }).length;
};

export const useNotifications = () => {
  const { user } = useAuth();
  const { subscribe, unsubscribe, connectionState } = useRealtimeService();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  
  // Track optimistic updates to prevent real-time conflicts
  const optimisticUpdatesRef = useRef<Set<string>>(new Set());
  
  // Compute unread count from notifications + optimistic cache
  const unreadCount = useMemo(() => {
    return computeUnreadCount(notifications, optimisticUpdatesRef.current);
  }, [notifications, optimisticUpdatesRef.current]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      // Get the notification being marked as read
      const notificationToUpdate = notifications.find(n => n.id === notificationId);
      const wasUnread = notificationToUpdate?.read_at === null;

      // Track this as optimistic update to prevent real-time conflicts
      optimisticUpdatesRef.current.add(notificationId);

      // Optimistic update
      setNotifications(prev => {
        const updated = prev.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        );
        return updated;
      });
      
      // No need to manually update unreadCount - useMemo will handle it

      const updateTimestamp = new Date().toISOString();

      const { error } = await supabase
        .from('notifications')
        .update({ read_at: updateTimestamp })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error marking notification as read:', error);
        // Revert optimistic update on error
        optimisticUpdatesRef.current.delete(notificationId);
        await fetchNotifications();
      } else {
        // Remove from optimistic tracking on success
        setTimeout(() => {
          optimisticUpdatesRef.current.delete(notificationId);
        }, 100); // Small delay to ensure real-time event is handled
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      optimisticUpdatesRef.current.delete(notificationId);
      await fetchNotifications();
    }
  }, [user, fetchNotifications, notifications]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const unreadNotifications = notifications.filter(n => !n.read_at);
      
      // Track all unread notifications as optimistic updates
      unreadNotifications.forEach(n => optimisticUpdatesRef.current.add(n.id));

      // Optimistic update
      const currentTime = new Date().toISOString();
      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: n.read_at || currentTime }))
      );

      const { error } = await supabase
        .from('notifications')
        .update({ read_at: currentTime })
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        // Revert optimistic update on error
        unreadNotifications.forEach(n => optimisticUpdatesRef.current.delete(n.id));
        await fetchNotifications();
      } else {
        toast.success('All notifications marked as read');
        // Remove from optimistic tracking on success
        setTimeout(() => {
          unreadNotifications.forEach(n => optimisticUpdatesRef.current.delete(n.id));
        }, 100);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      const unreadNotifications = notifications.filter(n => !n.read_at);
      unreadNotifications.forEach(n => optimisticUpdatesRef.current.delete(n.id));
      await fetchNotifications();
    }
  }, [user, fetchNotifications, notifications]);

  // Create a notification (for testing or manual creation)
  const createNotification = useCallback(async (documentId: string, title: string, message: string, workspaceId?: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          document_id: documentId,
          workspace_id: workspaceId, // Include workspace_id if provided
          type: 'notation',
          title,
          message
        });

      if (error) throw error;
      
      // No need to manually refresh - real-time will handle it
    } catch (error) {
      console.error('Error creating notification:', error);
      toast.error('Failed to create notification');
    }
  }, [user, fetchNotifications]);

  // Polling fallback when realtime fails
  useEffect(() => {
    if (connectionState.status === 'error' && connectionState.retryCount >= 5) {
      console.log('Realtime failed, falling back to polling');
      const interval = setInterval(() => {
        fetchNotifications();
      }, 10000); // Poll every 10 seconds

      return () => clearInterval(interval);
    }
  }, [connectionState, fetchNotifications]);

  // Handle notification type-based updates
  const handleNotificationTypeUpdate = useCallback((notification: Notification) => {
    switch (notification.type) {
      case 'invitation':
        // Trigger invitation refresh
        if (globalInvitationUpdateHandler) {
          globalInvitationUpdateHandler();
        }
        break;
      case 'workspace_member_added':
      case 'workspace_updated':
      case 'workspace_member_removed':
        // Trigger workspace refresh
        if (globalWorkspaceUpdateHandler) {
          globalWorkspaceUpdateHandler();
        }
        break;
      case 'document_shared':
      case 'document_updated':
        // Could trigger document refresh in the future
        break;
      default:
        // Generic notification, no special handling needed
        break;
    }
  }, []);


  // Set up real-time subscription for notifications
  useEffect(() => {
    if (!user) return;

    setLastFetch(new Date());
    
    const handleNotificationUpdate = (payload: any) => {
      console.log('🔄 Real-time notification event received:', payload.eventType, payload);
      setLastFetch(new Date());
      
      if (payload.eventType === 'INSERT') {
        const newNotification = payload.new as Notification;
        console.log('📨 New notification received:', newNotification);
        
        setNotifications(prev => {
          console.log('📋 Current notifications count:', prev.length);
          const updated = [newNotification, ...prev];
          console.log('📋 Updated notifications count:', updated.length);
          console.log('🔔 Unread count will be computed from updated notifications');
          return updated;
        });
        
        // Handle type-specific updates
        handleNotificationTypeUpdate(newNotification);
        
        // Show toast for new notifications (except invitations which are handled by other UI)
        if (newNotification.type !== 'invitation') {
          toast.info(newNotification.title, {
            description: newNotification.message,
          });
        }
      } else if (payload.eventType === 'UPDATE') {
        const updatedNotification = payload.new as Notification;
        
        // Skip real-time update if we have an optimistic update in progress
        if (optimisticUpdatesRef.current.has(updatedNotification.id)) {
          return; // Don't delete from optimistic tracker here - let the timeout handle it
        }
        
        setNotifications(prev => {
          const updated = prev.map(n => 
            n.id === updatedNotification.id 
              ? updatedNotification 
              : n
          );
          return updated;
        });
      } else if (payload.eventType === 'DELETE') {
        const deletedId = payload.old.id;
        setNotifications(prev => prev.filter(n => n.id !== deletedId));
      }
    };

    subscribe('notifications', {
      table: 'notifications',
      filter: `user_id=eq.${user.id}`,
      event: '*',
      callback: handleNotificationUpdate
    });

    return () => {
      unsubscribe('notifications');
    };
  }, [user, subscribe, unsubscribe, handleNotificationTypeUpdate]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    createNotification,
    connectionState,
    lastFetch
  };
};