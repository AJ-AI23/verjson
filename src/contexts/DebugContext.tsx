import React, { createContext, useContext, useState } from 'react';
import { toast } from 'sonner';

interface DebugContextType {
  isDebugMode: boolean;
  toggleDebugMode: () => void;
  debugToast: (message: string, data?: any) => void;
  errorToast: (message: string, error?: any) => void;
  showDiagramDebug: boolean;
  toggleDiagramDebug: () => void;
}

// Throttle function to limit toast frequency
const createThrottledToast = (toastFn: any, delay: number = 2000) => {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (message: string, options?: any) => {
    const now = Date.now();
    
    if (now - lastCall >= delay) {
      // If enough time has passed, show immediately
      lastCall = now;
      toastFn(message, options);
    } else {
      // Otherwise, schedule for later (debounce)
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        toastFn(message, options);
      }, delay - (now - lastCall));
    }
  };
};

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [showDiagramDebug, setShowDiagramDebug] = useState(() => {
    return localStorage.getItem('diagram-debug-mode') === 'true';
  });

  // Create throttled toast functions
  const throttledInfoToast = React.useMemo(
    () => createThrottledToast(toast.info, 3000), // 3 second throttle for debug toasts
    []
  );
  
  const throttledErrorToast = React.useMemo(
    () => createThrottledToast(toast.error, 1000), // 1 second throttle for errors
    []
  );

  const toggleDebugMode = () => {
    setIsDebugMode(prev => {
      const newMode = !prev;
      toast.info(`Debug mode ${newMode ? 'enabled' : 'disabled'}`, {
        description: newMode ? 'Debug toasts will now appear' : 'Debug toasts disabled',
        duration: 2000
      });
      return newMode;
    });
  };

  const toggleDiagramDebug = () => {
    setShowDiagramDebug(prev => {
      const newMode = !prev;
      localStorage.setItem('diagram-debug-mode', String(newMode));
      toast.info(`Diagram debug ${newMode ? 'enabled' : 'disabled'}`, {
        description: newMode ? 'Node dimensions will be shown' : 'Node dimensions hidden',
        duration: 2000
      });
      return newMode;
    });
  };

  const debugToast = (message: string, data?: any) => {
    if (isDebugMode) {
      console.log('🔧 DEBUG:', message, data);
      throttledInfoToast(`🔧 ${message}`, {
        description: data ? JSON.stringify(data, null, 2).substring(0, 150) + '...' : undefined,
        duration: 4000,
      });
    }
  };

  const errorToast = (message: string, error?: any) => {
    if (isDebugMode) {
      console.error('🚨 DEBUG ERROR:', message, error);
      throttledErrorToast(`🚨 ${message}`, {
        description: error?.message || String(error),
        duration: 6000,
      });
    } else {
      // Always log errors to console even when debug is off
      console.error('Error:', message, error);
    }
  };

  return (
    <DebugContext.Provider value={{ isDebugMode, toggleDebugMode, debugToast, errorToast, showDiagramDebug, toggleDiagramDebug }}>
      {children}
    </DebugContext.Provider>
  );
};

export const useDebug = (): DebugContextType => {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
};