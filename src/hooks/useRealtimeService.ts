import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';

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

// Global singleton to prevent multiple channels
class RealtimeServiceSingleton {
  private static instance: RealtimeServiceSingleton;
  private channel: RealtimeChannel | null = null;
  private subscriptions = new Map<string, RealtimeSubscription>();
  private connectionState: ConnectionState = { status: 'disconnected', retryCount: 0 };
  private listeners = new Set<(state: ConnectionState) => void>();
  private retryTimeout: NodeJS.Timeout | null = null;
  private isCleaningUp = false;

  static getInstance(): RealtimeServiceSingleton {
    if (!RealtimeServiceSingleton.instance) {
      RealtimeServiceSingleton.instance = new RealtimeServiceSingleton();
    }
    return RealtimeServiceSingleton.instance;
  }

  private setConnectionState(newState: ConnectionState) {
    this.connectionState = newState;
    this.listeners.forEach(listener => listener(newState));
  }

  private cleanup() {
    if (this.isCleaningUp) return; // Prevent recursive cleanup
    this.isCleaningUp = true;
    
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (this.channel) {
      try {
        this.channel.unsubscribe();
        supabase.removeChannel(this.channel);
      } catch (error) {
        console.error('Error cleaning up channel:', error);
      }
      this.channel = null;
    }
    
    this.setConnectionState({ status: 'disconnected', retryCount: 0 });
    this.isCleaningUp = false;
  }

  private async createChannel(userId: string) {
    if (this.isCleaningUp) return;
    
    this.cleanup();
    
    try {
      if (!userId) {
        console.warn('No user ID provided, skipping realtime connection');
        return;
      }

      const channelName = `unified-realtime-${userId}`;
      
      this.setConnectionState({ ...this.connectionState, status: 'connecting' });

      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: 'user' }
        }
      });

      // Set up all current subscriptions on the new channel
      this.subscriptions.forEach((subscription, id) => {
        const config: any = {
          event: subscription.event || '*',
          schema: 'public',
          table: subscription.table
        };

        if (subscription.filter) {
          config.filter = subscription.filter;
        }

        channel.on('postgres_changes', config, (payload) => {
          subscription.callback(payload);
        });
      });

      channel.subscribe((status) => {
        if (this.isCleaningUp) return;
        
        if (status === 'SUBSCRIBED') {
          this.setConnectionState({ status: 'connected', retryCount: 0 });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          const newRetryCount = this.connectionState.retryCount + 1;
          const delay = Math.min(1000 * Math.pow(2, newRetryCount), 30000);
          
          if (newRetryCount < 5) { // Max 5 retries
            console.warn(`Channel ${status}, retrying in ${delay}ms (attempt ${newRetryCount})`);
            this.setConnectionState({ status: 'error', retryCount: newRetryCount, lastError: status });
            
            this.retryTimeout = setTimeout(() => {
              if (!this.isCleaningUp) {
                this.createChannel(userId);
              }
            }, delay);
          } else {
            console.error('Max retries reached, giving up');
            this.setConnectionState({ status: 'error', retryCount: newRetryCount, lastError: 'Max retries exceeded' });
          }
        }
      });

      this.channel = channel;
    } catch (error) {
      console.error('Error creating realtime channel:', error);
      this.setConnectionState({ status: 'error', retryCount: this.connectionState.retryCount + 1, lastError: 'Creation failed' });
    }
  }

  subscribe(id: string, subscription: RealtimeSubscription, userId: string) {
    this.subscriptions.set(id, subscription);
    
    // If we have an active channel, add the subscription to it
    if (this.channel && this.connectionState.status === 'connected') {
      const config: any = {
        event: subscription.event || '*',
        schema: 'public',
        table: subscription.table
      };

      if (subscription.filter) {
        config.filter = subscription.filter;
      }

      this.channel.on('postgres_changes', config, (payload) => {
        subscription.callback(payload);
      });
    } else {
      // Create channel if it doesn't exist or is not connected
      this.createChannel(userId);
    }
  }

  unsubscribe(id: string) {
    this.subscriptions.delete(id);
    
    // If no more subscriptions, cleanup the channel
    if (this.subscriptions.size === 0) {
      this.cleanup();
    }
  }

  addConnectionListener(listener: (state: ConnectionState) => void) {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.connectionState);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  getConnectionState() {
    return this.connectionState;
  }

  destroy() {
    this.cleanup();
    this.subscriptions.clear();
    this.listeners.clear();
  }
}

export function useRealtimeService() {
  const { user } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    retryCount: 0
  });
  
  const serviceRef = useRef<RealtimeServiceSingleton | null>(null);

  useEffect(() => {
    serviceRef.current = RealtimeServiceSingleton.getInstance();
    
    const removeListener = serviceRef.current.addConnectionListener(setConnectionState);
    
    return removeListener;
  }, []);

  const subscribe = useCallback((id: string, subscription: RealtimeSubscription) => {
    if (user?.id) {
      serviceRef.current?.subscribe(id, subscription, user.id);
    }
  }, [user?.id]);

  const unsubscribe = useCallback((id: string) => {
    serviceRef.current?.unsubscribe(id);
  }, []);

  const cleanup = useCallback(() => {
    serviceRef.current?.destroy();
  }, []);

  return { 
    subscribe, 
    unsubscribe, 
    cleanup, 
    connectionState 
  };
}