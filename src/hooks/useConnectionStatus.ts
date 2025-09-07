import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ConnectionStatus {
  isOnline: boolean;
  isSupabaseConnected: boolean;
  lastChecked: Date | null;
}

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    isSupabaseConnected: true,
    lastChecked: null
  });

  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false, isSupabaseConnected: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check Supabase connection periodically
    const checkSupabase = async () => {
      try {
        const { error } = await supabase.from('profiles').select('count').limit(1);
        setStatus(prev => ({ 
          ...prev, 
          isSupabaseConnected: !error,
          lastChecked: new Date()
        }));
      } catch {
        setStatus(prev => ({ 
          ...prev, 
          isSupabaseConnected: false,
          lastChecked: new Date()
        }));
      }
    };

    const interval = setInterval(checkSupabase, 30000); // Check every 30s
    checkSupabase(); // Initial check

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return status;
}