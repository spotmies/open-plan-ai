import { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OnlineStatus } from './OnlineStatus';
import { chatService } from '@/services/chat.service';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { ReachableUser } from '../types';
import { logger } from '@/services/monitoring/logger';
import { useAuth } from '@/contexts/AuthContext';

interface NewDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (conversationId: string) => void;
  onConversationCreated?: () => Promise<void>;
  orgId?: string;
}

export function NewDMDialog({ open, onOpenChange, onSelect, onConversationCreated, orgId }: NewDMDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<ReachableUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    chatService
      .getReachableUsers(orgId)
      .then(setUsers)
      .catch((err) => {
        logger.error('Failed to fetch users:', err);
        toast.error('Failed to load users');
      })
      .finally(() => setLoading(false));
  }, [open]);

  // The "message yourself" entry never comes back from getReachableUsers (the
  // backend deliberately excludes the requester from that search), so it's
  // synthesized client-side from the logged-in user's own profile.
  const selfEntry: ReachableUser | null = user
    ? {
        id: user.id,
        name: `${user.name} (You)`,
        email: user.email,
        avatarUrl: user.avatarUrl ?? undefined,
        initials: user.initials || user.name.charAt(0).toUpperCase(),
        role: 'Message yourself',
        isOnline: true,
      }
    : null;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [search, users]);

  const showSelfEntry = !!selfEntry && selfEntry.name.toLowerCase().includes(search.toLowerCase());

  const handleSelect = async (userId: string) => {
    try {
      const convId = await chatService.getOrCreateDM(userId);
      if (onConversationCreated) await onConversationCreated();
      onSelect(convId);
      onOpenChange(false);
      setSearch('');
    } catch (err) {
      logger.error('Failed to start DM:', err);
      toast.error('Failed to start conversation');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search people..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-1 mt-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))
          ) : !showSelfEntry && filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
          ) : (
            <>
              {showSelfEntry && selfEntry && (
                <button
                  key={selfEntry.id}
                  onClick={() => handleSelect(selfEntry.id)}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selfEntry.avatarUrl} alt={selfEntry.name} />
                      <AvatarFallback className="text-xs">{selfEntry.initials}</AvatarFallback>
                    </Avatar>
                    <OnlineStatus isOnline className="absolute -bottom-0.5 -right-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">{selfEntry.name}</span>
                    <span className="text-xs text-muted-foreground block truncate">{selfEntry.role}</span>
                  </div>
                </button>
              )}
              {filtered.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelect(user.id)}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent/50 transition-colors text-left"
              >
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback className="text-xs">{user.initials}</AvatarFallback>
                  </Avatar>
                  <OnlineStatus isOnline={user.isOnline} className="absolute -bottom-0.5 -right-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block truncate">{user.name}</span>
                  <span className="text-xs text-muted-foreground block truncate">{user.role}</span>
                </div>
              </button>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
