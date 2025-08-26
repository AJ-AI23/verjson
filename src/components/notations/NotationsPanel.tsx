import React, { memo, useState } from 'react';
import { MessageCircle, X, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { NotationComment } from '@/types/notations';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GroupedNotation {
  path: string;
  nodeId: string;
  notations: NotationComment[];
}

interface NotationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  groupedNotations: GroupedNotation[];
  onAddNotation: (nodeId: string, user: string, message: string) => void;
  onReplyToNotation: (nodeId: string, user: string, message: string) => void;
}

export const NotationsPanel = memo(({ 
  isOpen, 
  onClose, 
  groupedNotations, 
  onAddNotation,
  onReplyToNotation 
}: NotationsPanelProps) => {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyUser, setReplyUser] = useState('');
  const [replyMessage, setReplyMessage] = useState('');

  const totalNotations = groupedNotations.reduce((sum, group) => sum + group.notations.length, 0);

  const handleResolve = (nodeId: string) => {
    console.log('Resolving notation for nodeId:', nodeId);
    onReplyToNotation(nodeId, 'System', 'Resolved - Closed');
  };

  const handleReply = (nodeId: string) => {
    if (replyUser.trim() && replyMessage.trim()) {
      console.log('Adding reply for nodeId:', nodeId);
      onReplyToNotation(nodeId, replyUser.trim(), replyMessage.trim());
      setReplyingTo(null);
      setReplyUser('');
      setReplyMessage('');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">All Notations</h2>
            <Badge variant="secondary">{totalNotations}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {groupedNotations.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No notations found in this schema</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedNotations.map((group) => (
                <div key={group.nodeId} className="border rounded-lg p-4">
                  {/* Path Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900">{group.path}</h3>
                      <Badge variant="outline">{group.notations.length}</Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResolve(group.nodeId)}
                      className="flex items-center gap-1 text-green-600 hover:text-green-700"
                    >
                      Resolve
                    </Button>
                  </div>

                  {/* Notations List */}
                  <div className="space-y-3">
                    {group.notations.map((notation) => (
                      <div key={notation.id} className="bg-slate-50 rounded p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-700">{notation.user}</span>
                            <span className="text-xs text-slate-500">{formatTimestamp(notation.timestamp)}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReplyingTo(notation.id)}
                            className="text-xs"
                          >
                            Reply
                          </Button>
                        </div>
                        <p className="text-sm text-slate-600">{notation.message}</p>
                      </div>
                    ))}
                  </div>

                  {/* Reply Form */}
                  {replyingTo && group.notations.some(n => n.id === replyingTo) && (
                    <div className="mt-3 p-3 bg-blue-50 rounded">
                      <div className="space-y-2">
                        <Input
                          placeholder="Your name"
                          value={replyUser}
                          onChange={(e) => setReplyUser(e.target.value)}
                          className="text-sm"
                        />
                        <Textarea
                          placeholder="Write your reply..."
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleReply(group.nodeId)}
                            disabled={!replyUser.trim() || !replyMessage.trim()}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Send Reply
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReplyingTo(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* New Notation Form - Remove this section */}

                  {group !== groupedNotations[groupedNotations.length - 1] && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
});

NotationsPanel.displayName = 'NotationsPanel';