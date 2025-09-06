import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Wifi, WifiOff } from 'lucide-react';

interface CollaborationUser {
  id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  last_seen: string;
}

interface CollaborationIndicatorProps {
  activeUsers: CollaborationUser[];
  isConnected: boolean;
  isLoading?: boolean;
  className?: string;
}

export const CollaborationIndicator: React.FC<CollaborationIndicatorProps> = ({
  activeUsers,
  isConnected,
  isLoading = false,
  className = ''
}) => {
  const displayUsers = activeUsers.slice(0, 3); // Show max 3 users
  const extraCount = Math.max(0, activeUsers.length - 3);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Connection Status */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
              ) : isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {isLoading 
              ? 'Connecting...' 
              : isConnected 
                ? 'Connected to collaboration server' 
                : 'Disconnected from collaboration server'
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Active Users Count */}
      {activeUsers.length > 0 && (
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Badge variant="secondary" className="text-xs">
            {activeUsers.length}
          </Badge>
        </div>
      )}

      {/* User Avatars */}
      {displayUsers.length > 0 && (
        <div className="flex -space-x-2">
          {displayUsers.map((user) => (
            <TooltipProvider key={user.user_id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 border-2 border-background">
                    <AvatarImage 
                      src={user.user_avatar || undefined} 
                      alt={user.user_name || 'User'} 
                    />
                    <AvatarFallback className="text-xs">
                      {(user.user_name || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <div className="font-medium">
                      {user.user_name || 'Anonymous User'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Active now
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          
          {/* Show count for extra users */}
          {extraCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 border-2 border-background">
                    <AvatarFallback className="text-xs bg-muted">
                      +{extraCount}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  {extraCount} more user{extraCount > 1 ? 's' : ''} active
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  );
};