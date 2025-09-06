import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch notifications
  const fetchNotifications = async () => {
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
      setUnreadCount(data?.filter(n => !n.read_at).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    console.log('Marking notification as read:', notificationId);

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      console.log('Successfully marked notification as read in database');

      // Update local state immediately for better UX
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
      
      // Calculate new unread count from updated notifications
      setNotifications(prevNotifications => {
        const updatedNotifications = prevNotifications.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        );
        const newUnreadCount = updatedNotifications.filter(n => !n.read_at).length;
        console.log('Updating unread count after marking as read:', newUnreadCount);
        setUnreadCount(newUnreadCount);
        return updatedNotifications;
      });

    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;

    console.log('Marking all notifications as read');

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) throw error;

      console.log('Successfully marked all notifications as read in database');

      // Update local state immediately
      const currentTime = new Date().toISOString();
      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: n.read_at || currentTime }))
      );
      
      console.log('Setting unread count to 0');
      setUnreadCount(0);
      
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  // Create a notification (for testing or manual creation)
  const createNotification = async (documentId: string, title: string, message: string) => {
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
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return;

    console.log('Setting up notifications real-time subscription for user:', user.id);

    const channel = supabase
      .channel(`user-notifications-${user.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: user.id }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time: New notification received:', payload);
          const newNotification = payload.new as Notification;
          
          setNotifications(prev => {
            console.log('Adding new notification to list, current count:', prev.length);
            return [newNotification, ...prev];
          });
          
          setUnreadCount(prev => {
            const newCount = prev + 1;
            console.log('Real-time: Updating unread count from', prev, 'to', newCount);
            return newCount;
          });
          
          // Show toast notification for all types except access_revoked (which might be sensitive)
          if (newNotification.type !== 'access_revoked') {
            toast.info(newNotification.title, {
              description: newNotification.message,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time: Notification updated:', payload);
          const updatedNotification = payload.new as Notification;
          const oldNotification = payload.old as Notification;
          
          setNotifications(prev => {
            const updated = prev.map(n => n.id === updatedNotification.id ? updatedNotification : n);
            console.log('Real-time: Updated notifications list');
            return updated;
          });
          
          // Update unread count based on read_at changes
          if (oldNotification?.read_at !== updatedNotification?.read_at && updatedNotification?.read_at) {
            setUnreadCount(prev => {
              const newCount = Math.max(0, prev - 1);
              console.log('Real-time: Notification marked as read, updating unread count from', prev, 'to', newCount);
              return newCount;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time: Notification deleted:', payload);
          const deletedNotification = payload.old as Notification;
          
          setNotifications(prev => 
            prev.filter(n => n.id !== deletedNotification.id)
          );
          
          // Update unread count if the deleted notification was unread
          if (!deletedNotification.read_at) {
            setUnreadCount(prev => {
              const newCount = Math.max(0, prev - 1);
              console.log('Real-time: Unread notification deleted, updating count from', prev, 'to', newCount);
              return newCount;
            });
          }
        }
      )
      .subscribe((status, err) => {
        console.log('Notifications subscription status:', status);
        if (err) {
          console.error('Notifications subscription error:', err);
        }
      });

    return () => {
      console.log('Cleaning up notifications subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [user]);

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