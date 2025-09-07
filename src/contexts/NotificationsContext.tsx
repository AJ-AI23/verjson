import React, { createContext, useContext } from 'react';
import { useNotifications as useNotificationsHook } from '@/hooks/useNotifications';
import { useInvitations as useInvitationsHook } from '@/hooks/useInvitations';

type NotificationsContextType = ReturnType<typeof useNotificationsHook> & {
  invitations: ReturnType<typeof useInvitationsHook>['invitations'];
  invitationsLoading: ReturnType<typeof useInvitationsHook>['loading'];
  acceptInvitation: ReturnType<typeof useInvitationsHook>['acceptInvitation'];
  declineInvitation: ReturnType<typeof useInvitationsHook>['declineInvitation'];
  refetchInvitations: ReturnType<typeof useInvitationsHook>['refetch'];
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notificationsData = useNotificationsHook();
  const invitationsData = useInvitationsHook();
  
  return (
    <NotificationsContext.Provider value={{
      ...notificationsData,
      invitations: invitationsData.invitations,
      invitationsLoading: invitationsData.loading,
      acceptInvitation: invitationsData.acceptInvitation,
      declineInvitation: invitationsData.declineInvitation,
      refetchInvitations: invitationsData.refetch,
    }}>
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