import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeSubscription {
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  callback: (payload: any) => void;
}

export function useRealtimeService() {
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());

  const unsubscribe = useCallback((id: string) => {
    const channel = channelsRef.current.get(id);
    if (channel) {
      console.log(`Unsubscribing from ${id}`);
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch (error) {
        console.error(`Error unsubscribing from ${id}:`, error);
      }
      channelsRef.current.delete(id);
    }
  }, []);

  const subscribe = useCallback((
    id: string,
    subscription: RealtimeSubscription
  ) => {
    // Clean up any existing subscription with the same ID first
    unsubscribe(id);
    
    // Create a simpler channel name without timestamps to avoid conflicts
    const channelName = `realtime-${subscription.table}-${id}`;
    console.log(`Creating realtime subscription: ${channelName}`);
    
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: id }
      }
    });

    const config: any = {
      event: subscription.event || '*',
      schema: 'public',
      table: subscription.table
    };

    if (subscription.filter) {
      config.filter = subscription.filter;
    }

    channel.on('postgres_changes', config, (payload) => {
      console.log(`Realtime event for ${id}:`, payload);
      subscription.callback(payload);
    });

    channel.subscribe((status) => {
      console.log(`Subscription ${id} status:`, status);
      if (status === 'SUBSCRIBED') {
        console.log(`Successfully subscribed to ${id}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Subscription error for ${id}`);
        // Retry connection after a short delay
        setTimeout(() => {
          if (channelsRef.current.has(id)) {
            console.log(`Retrying subscription for ${id}`);
            channel.subscribe();
          }
        }, 2000);
      } else if (status === 'TIMED_OUT') {
        console.warn(`Subscription ${id} timed out, attempting reconnect...`);
        setTimeout(() => {
          if (channelsRef.current.has(id)) {
            console.log(`Reconnecting timed out subscription for ${id}`);
            // Remove and recreate the subscription
            unsubscribe(id);
            subscribe(id, subscription);
          }
        }, 1000);
      } else if (status === 'CLOSED') {
        console.warn(`Subscription ${id} was closed, attempting reconnect...`);
        setTimeout(() => {
          if (channelsRef.current.has(id)) {
            console.log(`Reconnecting closed subscription for ${id}`);
            channel.subscribe();
          }
        }, 1000);
      }
    });

    channelsRef.current.set(id, channel);
  }, [unsubscribe]);


  const cleanup = useCallback(() => {
    console.log('Cleaning up all realtime subscriptions');
    channelsRef.current.forEach((channel, id) => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch (error) {
        console.error(`Error cleaning up channel ${id}:`, error);
      }
    });
    channelsRef.current.clear();
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { subscribe, unsubscribe, cleanup };
}