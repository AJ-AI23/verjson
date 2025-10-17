import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeService } from './useRealtimeService';
import { toast } from 'sonner';

// Global event handlers for triggering updates in other hooks
let globalInvitationUpdateHandler: (() => void) | null = null;
let globalWorkspaceUpdateHandler: (() => void) | null = null;
let globalSharedDocumentsUpdateHandler: (() => void) | null = null;

export const registerInvitationUpdateHandler = (handler: () => void) => {
  globalInvitationUpdateHandler = handler;
};

export const registerWorkspaceUpdateHandler = (handler: (() => void) | null) => {
  globalWorkspaceUpdateHandler = handler;
};

export const registerSharedDocumentsUpdateHandler = (handler: (() => void) | null) => {
  console.log('[useNotifications] 📝 Registering shared documents update handler:', !!handler);
  globalSharedDocumentsUpdateHandler = handler;
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

const NOTIFICATIONS_QUERY_KEY = 'notifications';

export const useNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { subscribe, unsubscribe, connectionState } = useRealtimeService();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  
  // Track processed notifications to prevent duplicates
  const processedNotifications = useRef<Set<string>>(new Set());
  
  // Clean up old processed notification IDs periodically to prevent memory leaks
  useEffect(() => {
    const cleanup = () => {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const oldIds = Array.from(processedNotifications.current).filter(id => {
        // Simple heuristic: if ID looks like a timestamp-based UUID, check age
        return false; // For now, keep all IDs - can be enhanced later
      });
      // Keep the Set manageable size (max 1000 entries)
      if (processedNotifications.current.size > 1000) {
        processedNotifications.current.clear();
      }
    };
    
    const interval = setInterval(cleanup, 60000); // Clean every minute
    return () => clearInterval(interval);
  }, []);

  // Use React Query for fetching with automatic deduplication
  const { data: queryData, isLoading: loading } = useQuery({
    queryKey: [NOTIFICATIONS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) return { notifications: [], unreadCount: 0 };

      const { data, error } = await supabase.functions.invoke('notifications-management', {
        body: { action: 'getUserNotifications' }
      });

      if (error) throw error;

      return {
        notifications: data.notifications || [],
        unreadCount: data.unreadCount || 0,
      };
    },
    enabled: !!user,
  });

  // Sync query data to local state for real-time updates
  useEffect(() => {
    if (queryData) {
      setNotifications(queryData.notifications);
      setUnreadCount(queryData.unreadCount);
    }
  }, [queryData]);

  const fetchNotifications = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY, user?.id] });
  }, [queryClient, user?.id]);

  // Track optimistic updates to prevent real-time conflicts
  const optimisticUpdatesRef = useRef<Set<string>>(new Set());

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
      
      // Update unread count immediately if it was unread
      if (wasUnread) {
        setUnreadCount(current => Math.max(0, current - 1));
      }

      const { data, error } = await supabase.functions.invoke('notifications-management', {
        body: { 
          action: 'markNotificationAsRead',
          notificationId 
        }
      });

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
      setUnreadCount(0);

      const { data, error } = await supabase.functions.invoke('notifications-management', {
        body: { action: 'markAllNotificationsAsRead' }
      });

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
      const { data, error } = await supabase.functions.invoke('notifications-management', {
        body: { 
          action: 'createNotification',
          documentId,
          title,
          message,
          workspaceId,
          type: 'notation'
        }
      });

      if (error) throw error;
      
      // No need to manually refresh - real-time will handle it
    } catch (error) {
      console.error('Error creating notification:', error);
      toast.error('Failed to create notification');
    }
  }, [user]);

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

  // Handle notification type-based updates (central dispatcher)
  const handleNotificationTypeUpdate = useCallback((notification: Notification) => {
    console.log('[useNotifications] Processing notification type:', notification.type, notification);
    
    switch (notification.type) {
      case 'invitation':
        // Only trigger invitation refresh, NOT workspace refresh
        console.log('[useNotifications] Invitation notification received, refreshing invitations only');
        if (globalInvitationUpdateHandler) {
          globalInvitationUpdateHandler();
        }
        break;
        
      case 'workspace_member_added':
      case 'workspace_updated':
      case 'workspace_member_removed':
        // Trigger workspace refresh for membership changes
        console.log('[useNotifications] Workspace change notification, refreshing workspaces');
        if (globalWorkspaceUpdateHandler) {
          globalWorkspaceUpdateHandler();
        }
        break;
        
      case 'workspace_deleted':
        // Clear workspace selection and refresh both workspace and shared documents
        console.log('[useNotifications] Workspace deleted notification');
        if (globalWorkspaceUpdateHandler) {
          globalWorkspaceUpdateHandler();
        }
        if (globalSharedDocumentsUpdateHandler) {
          globalSharedDocumentsUpdateHandler();
        }
        toast.error(notification.title, {
          description: notification.message,
        });
        break;
        
      case 'document_deleted':
        // Refresh shared documents for document deletion
        console.log('[useNotifications] Document deleted notification');
        if (globalSharedDocumentsUpdateHandler) {
          globalSharedDocumentsUpdateHandler();
        }
        toast.info(notification.title, {
          description: notification.message,
        });
        break;
        
      case 'document_access_revoked':
      case 'workspace_access_revoked':
        // For access revocation, refresh invitations and workspaces/shared docs
        console.log('[useNotifications] 🔒 Access revoked notification received:', {
          type: notification.type,
          title: notification.title,
          message: notification.message,
          documentId: notification.document_id,
          workspaceId: notification.workspace_id
        });
        
        console.log('[useNotifications] 🔒 Calling global handlers...');
        if (globalInvitationUpdateHandler) {
          console.log('[useNotifications] 🔒 Calling invitation update handler');
          globalInvitationUpdateHandler();
        }
        if (globalWorkspaceUpdateHandler) {
          console.log('[useNotifications] 🔒 Calling workspace update handler');
          globalWorkspaceUpdateHandler();
        }
        if (globalSharedDocumentsUpdateHandler) {
          console.log('[useNotifications] 🔒 Calling shared documents update handler for access revocation');
          globalSharedDocumentsUpdateHandler();
        } else {
          console.warn('[useNotifications] 🔒 No shared documents update handler registered!');
        }
        
        // Dispatch custom events for clearing selections
        console.log('[useNotifications] 🔒 Dispatching clearWorkspaceSelection event');
        window.dispatchEvent(new CustomEvent('clearWorkspaceSelection', {
          detail: {
            documentId: notification.document_id,
            workspaceId: notification.workspace_id,
            type: notification.type
          }
        }));
        
        toast.error(notification.title, {
          description: notification.message,
        });
        break;
        
      case 'document_shared':
      case 'document_updated':
        // Refresh shared documents for document permission changes
        console.log('[useNotifications] Document shared/updated notification');
        if (globalSharedDocumentsUpdateHandler) {
          globalSharedDocumentsUpdateHandler();
        }
        break;
        
      default:
        console.log('[useNotifications] Unknown notification type:', notification.type);
        break;
    }
  }, []);

  // Set up real-time subscription for notifications
  useEffect(() => {
    if (!user) return;

    setLastFetch(new Date());
    
    const handleNotificationUpdate = (payload: any) => {
      console.log('🚨🚨🚨 REAL-TIME NOTIFICATION EVENT RECEIVED 🚨🚨🚨');
      console.log('Event Type:', payload.eventType);
      console.log('Payload:', payload);
      setLastFetch(new Date());
      
      if (payload.eventType === 'INSERT') {
        const newNotification = payload.new as Notification;
        console.log('📨 New notification received:', newNotification);
        
        // DEDUPLICATION: Check if we've already processed this notification
        if (processedNotifications.current.has(newNotification.id)) {
          console.log('⏭️  Skipping duplicate notification:', newNotification.id);
          return;
        }
        
        // Mark as processed
        processedNotifications.current.add(newNotification.id);
        
        setNotifications(prev => {
          // Double-check for duplicates in state as well
          const isDuplicate = prev.some(n => n.id === newNotification.id);
          if (isDuplicate) {
            console.log('⏭️  Notification already exists in state:', newNotification.id);
            return prev;
          }
          
          console.log('📋 Current notifications count:', prev.length);
          const updated = [newNotification, ...prev];
          console.log('📋 Updated notifications count:', updated.length);
          
          // Calculate unread count from the updated array
          const newUnreadCount = updated.filter(n => !n.read_at).length;
          setUnreadCount(newUnreadCount);
          console.log('🔔 Setting unread count to:', newUnreadCount);
          
          return updated;
        });
        
        // Handle type-specific updates (central dispatching)
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
          
          // Recalculate unread count based on actual data to ensure accuracy
          const newUnreadCount = updated.filter(n => !n.read_at).length;
          setUnreadCount(newUnreadCount);
          
          return updated;
        });
      } else if (payload.eventType === 'DELETE') {
        const deletedId = payload.old.id;
        setNotifications(prev => {
          const filtered = prev.filter(n => n.id !== deletedId);
          const newUnreadCount = filtered.filter(n => !n.read_at).length;
          setUnreadCount(newUnreadCount);
          return filtered;
        });
      }
    };

    console.log('🔗 SETTING UP REAL-TIME NOTIFICATION SUBSCRIPTION FOR USER:', user.id);
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

  // No need for initial fetch - React Query handles it automatically

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
