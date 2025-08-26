import React, { memo, useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { NotationComment } from '@/types/notations';
import { useUserProfile } from '@/hooks/useUserProfile';

interface NotationsPanelProps {
  notations: NotationComment[];
  isExpanded: boolean;
  onAddNotation?: (user: string, message: string) => void;
}

export const NotationsPanel = memo(({ notations, isExpanded, onAddNotation }: NotationsPanelProps) => {
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const { getNotationUsername } = useUserProfile();
  if (!isExpanded) {
    return null;
  }

  const handleAddComment = () => {
    const username = getNotationUsername();
    if (username && newMessage.trim() && onAddNotation) {
      onAddNotation(username, newMessage.trim());
      setNewMessage('');
      setIsAddingComment(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="mt-2 border-t pt-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-700">Comments:</div>
        {onAddNotation && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddingComment(!isAddingComment)}
            className="h-6 px-2 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        )}
      </div>
      
      {notations.length > 0 && (
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {notations.map((notation) => (
            <div 
              key={notation.id} 
              className="bg-amber-50 border border-amber-200 rounded p-2 text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-amber-900">@{notation.user}</span>
                <span className="text-amber-600 text-[10px]">
                  {formatTimestamp(notation.timestamp)}
                </span>
              </div>
              <p className="text-amber-800 leading-relaxed break-words">
                {notation.message}
              </p>
            </div>
          ))}
        </div>
      )}

      {isAddingComment && (
        <div className="bg-slate-50 border border-slate-200 rounded p-2 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Posting as:</span>
            <span className="font-medium">@{getNotationUsername()}</span>
          </div>
          <Textarea
            placeholder="Add your comment..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="min-h-[60px] text-xs"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!newMessage.trim()}
              className="h-7 px-3 text-xs"
            >
              <Send className="w-3 h-3 mr-1" />
              Send
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingComment(false)}
              className="h-7 px-3 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

NotationsPanel.displayName = 'NotationsPanel';