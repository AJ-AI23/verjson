import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail } from 'lucide-react';
import { NotificationsDialog } from './NotificationsDialog';
import { InvitationsDialog } from './InvitationsDialog';
import { DebugToggle } from '@/components/DebugToggle';
import { SupportButton } from './SupportButton';
import { useNotifications } from '@/hooks/useNotifications';
import { useInvitations } from '@/hooks/useInvitations';

export const NotificationsButton: React.FC = () => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isInvitationsOpen, setIsInvitationsOpen] = useState(false);
  const { unreadCount, notifications } = useNotifications();
  const { invitations } = useInvitations();

  const pendingInvitationsCount = invitations.length; // All invitations are pending


  return (
    <div className="flex items-center gap-2">
      {/* Support Button */}
      <SupportButton />
      
      {/* Invitations Button */}
      <div className="relative">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsInvitationsOpen(true)}
          className="relative"
        >
          <Mail className="h-4 w-4" />
          {pendingInvitationsCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              key={`invitations-${pendingInvitationsCount}`}
            >
              {pendingInvitationsCount > 9 ? '9+' : pendingInvitationsCount}
            </Badge>
          )}
        </Button>
      </div>
      
      {/* Notifications Button */}
      <div className="relative">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsNotificationsOpen(true)}
          className="relative"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              key={`notifications-${unreadCount}`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </div>
      
      {/* Debug Toggle */}
      <DebugToggle />
      
      {/* Dialog Components */}
      <InvitationsDialog 
        open={isInvitationsOpen} 
        onOpenChange={setIsInvitationsOpen} 
      />
      
      <NotificationsDialog 
        open={isNotificationsOpen} 
        onOpenChange={setIsNotificationsOpen} 
      />
    </div>
  );
};