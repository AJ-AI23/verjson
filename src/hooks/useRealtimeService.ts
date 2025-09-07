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

  const subscribe = useCallback((
    id: string,
    subscription: RealtimeSubscription
  ) => {
    // Create a dedicated channel for each subscription to avoid conflicts
    const channelName = `${subscription.table}-${id}-${Date.now()}`;
    console.log(`Creating realtime subscription: ${channelName}`);
    
    const channel = supabase.channel(channelName);

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
        // Don't auto-retry to avoid infinite loops
      }
    });

    channelsRef.current.set(id, channel);
  }, []);

  const unsubscribe = useCallback((id: string) => {
    const channel = channelsRef.current.get(id);
    if (channel) {
      console.log(`Unsubscribing from ${id}`);
      channel.unsubscribe();
      channelsRef.current.delete(id);
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('Cleaning up all realtime subscriptions');
    channelsRef.current.forEach((channel, id) => {
      channel.unsubscribe();
    });
    channelsRef.current.clear();
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { subscribe, unsubscribe, cleanup };
}