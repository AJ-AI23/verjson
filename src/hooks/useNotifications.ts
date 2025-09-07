import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeService } from './useRealtimeService';
import { toast } from 'sonner';

export interface Notification {
  id: string;
  user_id: string;
  document_id: string;
  type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const { subscribe, unsubscribe } = useRealtimeService();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
      const calculatedUnreadCount = data?.filter(n => !n.read_at).length || 0;
      console.log('Fetched notifications:', data?.length, 'Unread:', calculatedUnreadCount);
      setUnreadCount(calculatedUnreadCount);
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

    console.log('Marking notification as read:', notificationId);
    console.log('Current unread count before update:', unreadCount);

    try {
      // Get the notification being marked as read
      const notificationToUpdate = notifications.find(n => n.id === notificationId);
      const wasUnread = notificationToUpdate?.read_at === null;
      
      console.log('Notification was unread:', wasUnread);

      // Optimistic update
      setNotifications(prev => {
        const updated = prev.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        );
        console.log('Updated notifications:', updated.map(n => ({ id: n.id, read_at: n.read_at })));
        return updated;
      });
      
      // Update unread count immediately if it was unread
      if (wasUnread) {
        setUnreadCount(current => {
          const newCount = Math.max(0, current - 1);
          console.log('Updating unread count from', current, 'to', newCount);
          return newCount;
        });
      }

      const updateTimestamp = new Date().toISOString();
      console.log('Attempting to update notification with timestamp:', updateTimestamp);

      const { data, error } = await supabase
        .from('notifications')
        .update({ read_at: updateTimestamp })
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .select(); // Add select to see what was actually updated

      console.log('Database update result:', { data, error });

      if (error) {
        console.error('Error marking notification as read:', error);
        // Revert optimistic update on error
        await fetchNotifications();
      } else {
        console.log('Successfully marked notification as read in database');
        console.log('Updated notification data:', data);
        
        // Verify the update by fetching fresh data
        const { data: verifyData, error: verifyError } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', notificationId)
          .single();
        
        console.log('Verification query result:', { verifyData, verifyError });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      await fetchNotifications();
    }
  }, [user, fetchNotifications, notifications, unreadCount]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    console.log('Marking all notifications as read');

    try {
      // Optimistic update
      const currentTime = new Date().toISOString();
      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: n.read_at || currentTime }))
      );
      setUnreadCount(0);

      const { error } = await supabase
        .from('notifications')
        .update({ read_at: currentTime })
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        // Revert optimistic update on error
        await fetchNotifications();
      } else {
        toast.success('All notifications marked as read');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      await fetchNotifications();
    }
  }, [user, fetchNotifications]);

  // Create a notification (for testing or manual creation)
  const createNotification = useCallback(async (documentId: string, title: string, message: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          document_id: documentId,
          type: 'notation',
          title,
          message
        });

      if (error) throw error;
      
      // Refresh notifications
      fetchNotifications();
    } catch (error) {
      console.error('Error creating notification:', error);
      toast.error('Failed to create notification');
    }
  }, [user, fetchNotifications]);

  // Set up real-time subscription for notifications
  useEffect(() => {
    if (!user) return;

    console.log('Setting up notifications subscription for user:', user.id);
    
    const handleNotificationUpdate = (payload: any) => {
      console.log('Notifications real-time update:', payload);
      
      if (payload.eventType === 'INSERT') {
        const newNotification = payload.new as Notification;
        setNotifications(prev => [newNotification, ...prev]);
        
        if (!newNotification.read_at) {
          setUnreadCount(prev => prev + 1);
        }
        
        // Show toast for new notifications (except invitations)
        if (newNotification.type !== 'invitation') {
          toast.info(newNotification.title, {
            description: newNotification.message,
          });
        }
      } else if (payload.eventType === 'UPDATE') {
        const updatedNotification = payload.new as Notification;
        const oldNotification = payload.old as Notification;
        
        console.log('Real-time UPDATE event:', {
          id: updatedNotification.id,
          oldReadAt: oldNotification?.read_at,
          newReadAt: updatedNotification.read_at
        });
        
        setNotifications(prev => {
          const updated = prev.map(n => 
            n.id === updatedNotification.id 
              ? updatedNotification 
              : n
          );
          
          // Recalculate unread count based on actual data
          const newUnreadCount = updated.filter(n => !n.read_at).length;
          console.log('Recalculating unread count after real-time update:', newUnreadCount);
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

    subscribe('notifications', {
      table: 'notifications',
      filter: `user_id=eq.${user.id}`,
      callback: handleNotificationUpdate
    });

    return () => {
      console.log('Cleaning up notifications subscription');
      unsubscribe('notifications');
    };
  }, [user, subscribe, unsubscribe]);

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
  };
};