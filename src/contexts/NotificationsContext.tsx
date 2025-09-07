import React, { createContext, useContext } from 'react';
import { useNotifications as useNotificationsHook } from '@/hooks/useNotifications';

const NotificationsContext = createContext<ReturnType<typeof useNotificationsHook> | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notificationsData = useNotificationsHook();
  
  return (
    <NotificationsContext.Provider value={notificationsData}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};