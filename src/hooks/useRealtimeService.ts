import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeSubscription {
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  callback: (payload: any) => void;
}

interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  retryCount: number;
  lastError?: string;
}

export function useRealtimeService() {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscriptionsRef = useRef<Map<string, RealtimeSubscription>>(new Map());
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    retryCount: 0
  });

  const cleanup = useCallback(() => {
    console.log('Cleaning up realtime service');
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
      } catch (error) {
        console.error('Error cleaning up channel:', error);
      }
      channelRef.current = null;
    }
    subscriptionsRef.current.clear();
    setConnectionState({ status: 'disconnected', retryCount: 0 });
  }, []);

  const createChannel = useCallback(() => {
    cleanup();
    
    const userId = supabase.auth.getUser().then(({ data }) => data.user?.id);
    const channelName = `user-realtime-${Date.now()}`;
    
    console.log('Creating unified realtime channel:', channelName);
    setConnectionState(prev => ({ ...prev, status: 'connecting' }));

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: 'user' }
      }
    });

    // Set up all current subscriptions on the new channel
    subscriptionsRef.current.forEach((subscription, id) => {
      const config: any = {
        event: subscription.event || '*',
        schema: 'public',
        table: subscription.table
      };

      if (subscription.filter) {
        config.filter = subscription.filter;
      }

      channel.on('postgres_changes', config, (payload) => {
        console.log(`Realtime event for ${subscription.table}:`, payload);
        subscription.callback(payload);
      });
    });

    let retryTimeout: NodeJS.Timeout;

    channel.subscribe((status) => {
      console.log('Unified channel status:', status);
      
      if (status === 'SUBSCRIBED') {
        setConnectionState({ status: 'connected', retryCount: 0 });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setConnectionState(prev => {
          const newRetryCount = prev.retryCount + 1;
          const delay = Math.min(1000 * Math.pow(2, newRetryCount), 30000); // Exponential backoff, max 30s
          
          console.warn(`Channel ${status}, retrying in ${delay}ms (attempt ${newRetryCount})`);
          
          retryTimeout = setTimeout(() => {
            if (newRetryCount < 5) { // Max 5 retries
              createChannel();
            } else {
              console.error('Max retries reached, falling back to polling');
              setConnectionState({ status: 'error', retryCount: newRetryCount, lastError: 'Max retries exceeded' });
            }
          }, delay);
          
          return { status: 'error', retryCount: newRetryCount, lastError: status };
        });
      }
    });

    channelRef.current = channel;
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [cleanup]);

  const subscribe = useCallback((
    id: string,
    subscription: RealtimeSubscription
  ) => {
    console.log(`Adding subscription: ${id} for table: ${subscription.table}`);
    subscriptionsRef.current.set(id, subscription);
    
    // If we have an active channel, add the subscription to it
    if (channelRef.current) {
      const config: any = {
        event: subscription.event || '*',
        schema: 'public',
        table: subscription.table
      };

      if (subscription.filter) {
        config.filter = subscription.filter;
      }

      channelRef.current.on('postgres_changes', config, (payload) => {
        console.log(`Realtime event for ${subscription.table}:`, payload);
        subscription.callback(payload);
      });
    } else {
      // Create channel if it doesn't exist
      createChannel();
    }
  }, [createChannel]);

  const unsubscribe = useCallback((id: string) => {
    console.log(`Removing subscription: ${id}`);
    subscriptionsRef.current.delete(id);
    
    // If no more subscriptions, cleanup the channel
    if (subscriptionsRef.current.size === 0) {
      cleanup();
    }
  }, [cleanup]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { 
    subscribe, 
    unsubscribe, 
    cleanup, 
    connectionState 
  };
}