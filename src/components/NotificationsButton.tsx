import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import { NotificationsDialog } from './NotificationsDialog';
import { DebugToggle } from '@/components/DebugToggle';
import { useNotifications } from '@/hooks/useNotifications';

export const NotificationsButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <div className="flex items-center gap-2">
      {/* Debug Toggle */}
      <DebugToggle />
      
      {/* Notifications Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="relative gap-2"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 min-w-5 text-xs p-0 flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      <NotificationsDialog 
        open={isOpen} 
        onOpenChange={setIsOpen} 
      />
    </div>
  );
};