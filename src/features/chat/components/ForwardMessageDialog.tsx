import { useState, useMemo, useEffect } from 'react';
import { Search, Loader2, FileImage, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation, ChatMessage } from '../types';

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  messages: ChatMessage[] | null;
  onForward: (targetConversationIds: string[]) => Promise<void>;
}

function conversationDisplay(conversation: Conversation, currentUserId?: string) {
  const isSelfChat = conversation.type === 'dm' && conversation.members.every((m) => m.id === currentUserId);
  const otherMember = conversation.type === 'dm'
    ? conversation.members.find((m) => m.id !== currentUserId) ?? (isSelfChat ? conversation.members[0] : undefined)
    : null;
  const name = conversation.type === 'dm'
    ? (isSelfChat ? `${otherMember?.name || 'You'} (You)` : otherMember?.name || conversation.name)
    : conversation.name;
  const initials = conversation.type === 'dm'
    ? otherMember?.initials || '??'
    : conversation.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const avatarUrl = conversation.type === 'dm' ? otherMember?.avatarUrl : conversation.avatarUrl;
  return { name, initials, avatarUrl };
}

export function ForwardMessageDialog({ open, onOpenChange, conversations, messages, onForward }: ForwardMessageDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isForwarding, setIsForwarding] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelectedIds([]);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return conversations.filter((c) => conversationDisplay(c, user?.id).name.toLowerCase().includes(q));
  }, [search, conversations, user?.id]);

  const toggleConversation = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const message = messages?.[0] ?? null;
  const isImageMessage = message?.contentType === 'image';
  const isFileMessage = message?.contentType === 'file';
  const extraCount = (messages?.length ?? 0) - 1;

  const handleForward = async () => {
    if (selectedIds.length === 0) return;
    setIsForwarding(true);
    try {
      await onForward(selectedIds);
      onOpenChange(false);
    } finally {
      setIsForwarding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
        </DialogHeader>

        {message && (
          <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {isImageMessage ? <FileImage className="h-3.5 w-3.5 shrink-0" /> : isFileMessage ? <FileText className="h-3.5 w-3.5 shrink-0" /> : null}
            <span className="min-w-0 flex-1 truncate whitespace-nowrap">
              {isImageMessage
                ? extraCount > 0 ? `${extraCount + 1} photos` : 'Photo'
                : isFileMessage ? 'File attachment' : message.content}
            </span>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search conversations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No conversations found</p>
          ) : (
            filtered.map((conversation) => {
              const { name, initials, avatarUrl } = conversationDisplay(conversation, user?.id);
              const isSelected = selectedIds.includes(conversation.id);
              return (
                <div
                  key={conversation.id}
                  className={cn(
                    'flex items-center gap-3 w-full p-2.5 rounded-lg transition-colors cursor-pointer group hover:bg-muted/50',
                    isSelected && 'bg-primary/5',
                  )}
                  onClick={() => toggleConversation(conversation.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary pointer-events-none"
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={avatarUrl} alt={name} className="object-cover" />
                    <AvatarFallback className={cn('text-xs', conversation.type === 'group' && 'bg-primary/10 text-primary')}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate flex-1 min-w-0">{name}</span>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleForward}
            disabled={selectedIds.length === 0 || isForwarding}
            className="gap-2"
          >
            {isForwarding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Forward{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
