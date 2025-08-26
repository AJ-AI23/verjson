import React, { createContext, useContext, useState } from 'react';
import { toast } from 'sonner';

interface DebugContextType {
  isDebugMode: boolean;
  toggleDebugMode: () => void;
  debugToast: (message: string, data?: any) => void;
  errorToast: (message: string, error?: any) => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDebugMode, setIsDebugMode] = useState(false);

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

  const debugToast = (message: string, data?: any) => {
    if (isDebugMode) {
      console.log('🔧 DEBUG:', message, data);
      toast.info(`🔧 DEBUG: ${message}`, {
        description: data ? JSON.stringify(data, null, 2).substring(0, 200) : undefined,
        duration: 3000,
      });
    }
  };

  const errorToast = (message: string, error?: any) => {
    if (isDebugMode) {
      console.error('🚨 DEBUG ERROR:', message, error);
      toast.error(`🚨 DEBUG ERROR: ${message}`, {
        description: error?.message || String(error),
        duration: 5000,
      });
    } else {
      // Always log errors to console even when debug is off
      console.error('Error:', message, error);
    }
  };

  return (
    <DebugContext.Provider value={{ isDebugMode, toggleDebugMode, debugToast, errorToast }}>
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