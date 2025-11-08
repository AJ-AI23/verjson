import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, FileText, MoreHorizontal, Eye } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationsContext';
import { Notification } from '@/hooks/useNotifications';
import { ImportReviewDialog } from '@/components/ImportReviewDialog';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface NotificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotificationsDialog: React.FC<NotificationsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();

  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    documentId: string;
    versionId: string;
    document: { name: string; content: any };
  }>({
    open: false,
    documentId: '',
    versionId: '',
    document: { name: '', content: null }
  });

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }
  };

  const handleReviewImport = async (notification: Notification) => {
    if (!notification.document_id) {
      console.error('No document_id in notification');
      return;
    }

    try {
      // Find the pending version for this document
      // We'll need to fetch this from the useDocumentVersions hook
      // For now, we'll open the dialog with the available information
      setReviewDialog({
        open: true,
        documentId: notification.document_id,
        versionId: '', // Will be filled by the ImportReviewDialog
        document: { 
          name: 'Loading...', 
          content: {} 
        }
      });
    } catch (error) {
      console.error('Error opening import review:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'notation':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'crowdin_import_pending':
        return <FileText className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[600px] p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount}
                </Badge>
              )}
            </DialogTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </DialogHeader>

        <Separator />

        <ScrollArea className="flex-1 max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-pulse text-muted-foreground">
                Loading notifications...
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-muted-foreground mb-2">
                No notifications yet
              </h3>
              <p className="text-sm text-muted-foreground">
                You'll see notifications here when someone adds comments to your documents.
              </p>
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors',
                    !notification.read_at && 'bg-blue-50/50 border-l-2 border-l-blue-500'
                  )}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={cn(
                        'text-sm font-medium leading-tight',
                        !notification.read_at && 'text-foreground font-semibold'
                      )}>
                        {notification.title}
                      </h4>
                      {!notification.read_at && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                      
                      {notification.type === 'crowdin_import_pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReviewImport(notification);
                          }}
                          className="text-xs h-6"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Review
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>

      <ImportReviewDialog
        open={reviewDialog.open}
        onOpenChange={(open) => setReviewDialog(prev => ({ ...prev, open }))}
        documentId={reviewDialog.documentId}
        versionId={reviewDialog.versionId}
        document={reviewDialog.document}
      />
    </Dialog>
  );
};