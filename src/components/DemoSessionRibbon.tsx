import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function DemoSessionRibbon() {
  const { user } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setIsDemo(false);
      setTimeRemaining(null);
      setExpiresAt(null);
      return;
    }

    // Check if this is a demo session
    const checkDemoSession = async () => {
      try {
        const { data, error } = await supabase
          .from('demo_sessions')
          .select('expires_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking demo session:', error);
          return;
        }

        if (data) {
          setIsDemo(true);
          const expiry = new Date(data.expires_at).getTime();
          setExpiresAt(expiry);
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
          setTimeRemaining(remaining);
        } else {
          setIsDemo(false);
          setTimeRemaining(null);
          setExpiresAt(null);
        }
      } catch (error) {
        console.error('Error in checkDemoSession:', error);
      }
    };

    checkDemoSession();

    // Update countdown every second
    const interval = setInterval(() => {
      if (expiresAt) {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setTimeRemaining(remaining);
        
        // If expired, stop counting
        if (remaining === 0) {
          clearInterval(interval);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user, expiresAt]);

  if (!isDemo || timeRemaining === null) {
    return null;
  }

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isWarning = timeRemaining < 120; // Less than 2 minutes

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 px-4 py-2 text-sm font-medium text-center shadow-md transition-colors duration-300"
      style={{
        backgroundColor: isWarning ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
        color: 'hsl(var(--primary-foreground))'
      }}
    >
      <div className="flex items-center justify-center gap-2">
        {isWarning ? (
          <AlertTriangle className="h-4 w-4 animate-pulse" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
        <span>
          Demo Session Expires in: {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
