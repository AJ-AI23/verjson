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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscriptionsRef = useRef<Map<string, RealtimeSubscription>>(new Map());

  const subscribe = useCallback((
    id: string,
    subscription: RealtimeSubscription
  ) => {
    subscriptionsRef.current.set(id, subscription);
    
    // If channel doesn't exist, create it
    if (!channelRef.current) {
      const channel = supabase.channel('realtime-updates', {
        config: {
          broadcast: { self: false },
          presence: { key: '' }
        }
      });

      // Add all current subscriptions to the channel
      subscriptionsRef.current.forEach((sub, subId) => {
        const config: any = {
          event: sub.event || '*',
          schema: 'public',
          table: sub.table
        };

        if (sub.filter) {
          config.filter = sub.filter;
        }

        channel.on('postgres_changes', config, (payload) => {
          console.log(`Realtime event for ${subId}:`, payload);
          sub.callback(payload);
        });
      });

      channel.subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to realtime updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Realtime subscription error');
          // Try to reconnect after a delay
          setTimeout(() => {
            if (channelRef.current) {
              channelRef.current.unsubscribe();
              channelRef.current = null;
              // Re-subscribe with current subscriptions
              const currentSubs = Array.from(subscriptionsRef.current.entries());
              subscriptionsRef.current.clear();
              currentSubs.forEach(([subId, sub]) => {
                subscribe(subId, sub);
              });
            }
          }, 2000);
        }
      });

      channelRef.current = channel;
    } else {
      // Add new subscription to existing channel
      const sub = subscription;
      const config: any = {
        event: sub.event || '*',
        schema: 'public',
        table: sub.table
      };

      if (sub.filter) {
        config.filter = sub.filter;
      }

      channelRef.current.on('postgres_changes', config, (payload) => {
        console.log(`Realtime event for ${id}:`, payload);
        sub.callback(payload);
      });
    }
  }, []);

  const unsubscribe = useCallback((id: string) => {
    subscriptionsRef.current.delete(id);
    
    // If no more subscriptions, close the channel
    if (subscriptionsRef.current.size === 0 && channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    subscriptionsRef.current.clear();
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { subscribe, unsubscribe, cleanup };
}