import { useMemo, useState } from 'react';
import { Plus, Users, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConversationSearch } from './ConversationSearch';
import { ConversationItem } from './ConversationItem';
import { NewDMDialog } from './NewDMDialog';
import { NewGroupDialog } from './NewGroupDialog';
import { EmptyState } from './EmptyState';
import { PeopleList } from './PeopleList';
import { useChatStore } from '../stores/useChatStore';
import { useReachableUsers } from '../hooks/useReachableUsers';
import { useIsMobile } from '@/hooks/use-mobile';
import { chatService } from '@/services/chat.service';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { Conversation } from '../types';
import { logger } from '@/services/monitoring/logger';
import { useAuth } from '@/contexts/AuthContext';

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  onSelect: (id: string) => void;
  onConversationCreated?: () => Promise<void>;
  onlineUserIds?: Set<string>;
  onShowSaved?: () => void;
  isSavedActive?: boolean;
  onToggleFavourite?: (conversationId: string) => void;
  onToggleMute?: (conversationId: string) => void;
  onMarkRead?: (conversationId: string) => void;
  onDeleteChat?: (conversationId: string) => void;
}

export function ConversationList({
  conversations, loading, onSelect, onConversationCreated, onlineUserIds, onShowSaved, isSavedActive,
  onToggleFavourite, onToggleMute, onMarkRead, onDeleteChat,
}: ConversationListProps) {
  const isMobile = useIsMobile();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const {
    activeConversationId, conversationFilter, setConversationFilter, searchQuery, setSearchQuery, unreadCounts,
    isNewDMDialogOpen: dmDialogOpen, setNewDMDialogOpen: setDmDialogOpen,
    isNewGroupDialogOpen: groupDialogOpen, setNewGroupDialogOpen: setGroupDialogOpen,
  } = useChatStore();
  const { data: reachableUsers = [] } = useReachableUsers();
  const [isCreatingDM, setIsCreatingDM] = useState(false);

  const isSelfConversation = (c: Conversation) =>
    c.type === 'dm' && c.members.length > 0 && c.members.every((m) => m.id === currentUserId);

  const filtered = useMemo(() => {
    // A DM only counts as "started" once a message has actually been sent —
    // hide empty ones (created just by clicking a search result) from the
    // sidebar list. The currently open conversation stays visible even while
    // empty so the user isn't kicked out of the thread they're about to type in.
    // The self-chat ("Message yourself") is always shown, like Teams' own Notes.
    let list: Conversation[] = conversations.filter(
      (c) => c.type !== 'dm' || !!c.lastMessage || c.id === activeConversationId || isSelfConversation(c)
    );
    if (conversationFilter === 'dms') list = list.filter((c) => c.type === 'dm');
    if (conversationFilter === 'groups') list = list.filter((c) => c.type === 'group');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        c.members.some(m => (m.name ?? '').toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => {
      if (isSelfConversation(a) !== isSelfConversation(b)) return isSelfConversation(a) ? -1 : 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }, [conversations, conversationFilter, searchQuery, activeConversationId, currentUserId]);

  const hasSelfConversation = conversations.some(isSelfConversation);

  // Teams-style: chats favourited via the hover menu surface in their own
  // section above the regular list. Skipped while searching so results stay
  // a single flat list.
  const showFavouritesSection = !searchQuery.trim() && filtered.some((c) => c.isFavourite);
  const favouriteConversations = showFavouritesSection ? filtered.filter((c) => c.isFavourite) : [];
  const regularConversations = showFavouritesSection ? filtered.filter((c) => !c.isFavourite) : filtered;

  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim() || conversationFilter === 'groups') return [];
    const q = searchQuery.toLowerCase();
    // Only exclude people who have a *started* DM (a message was actually sent) —
    // an empty DM created by clicking a search result shouldn't hide them here,
    // otherwise they'd vanish from search entirely (matches the `filtered` rule above).
    const people = reachableUsers.filter(u =>
      ((u.name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)) &&
      !conversations.some(c => c.type === 'dm' && !!c.lastMessage && c.members.some(m => m.id === u.id))
    );
    // The reachable-users search deliberately excludes the requester, so
    // "message yourself" has to be synthesized here too, mirroring NewDMDialog.
    if (user && !hasSelfConversation && `${user.name} (You)`.toLowerCase().includes(q)) {
      people.unshift({
        id: user.id,
        name: `${user.name} (You)`,
        email: user.email,
        avatarUrl: user.avatarUrl ?? undefined,
        initials: user.initials || user.name.charAt(0).toUpperCase(),
        role: 'Message yourself',
        isOnline: true,
      });
    }
    return people;
  }, [searchQuery, reachableUsers, conversations, conversationFilter, user, hasSelfConversation]);

  const handleSelectPerson = async (userId: string) => {
    try {
      setIsCreatingDM(true);
      const convId = await chatService.getOrCreateDM(userId);
      if (onConversationCreated) await onConversationCreated();
      onSelect(convId);
      setSearchQuery(''); // Clear search after selection
    } catch (err) {
      logger.error('Failed to start DM:', err);
      toast.error('Failed to start conversation');
    } finally {
      setIsCreatingDM(false);
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-border">
      {isMobile ? (
        <div className="px-3 py-2 border-b border-border">
          <ConversationSearch isMobileHeader />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-3 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Messages</h2>
            <div className="flex gap-1">
              {onShowSaved && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', isSavedActive && 'bg-muted text-amber-500')}
                  onClick={onShowSaved}
                  title="Saved Messages"
                >
                  <Bookmark className={cn('h-4 w-4', isSavedActive && 'fill-amber-500')} />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDmDialogOpen(true)} title="New Message">
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setGroupDialogOpen(true)} title="New Group">
                <Users className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <ConversationSearch />
        </>
      )}

      <div className="px-3 pb-2">
        <Tabs value={conversationFilter} onValueChange={(v) => setConversationFilter(v as 'all' | 'dms' | 'groups')}>
          <TabsList className="w-full h-8">
            <TabsTrigger value="all" className="text-xs flex-1">All</TabsTrigger>
            <TabsTrigger value="dms" className="text-xs flex-1">DMs</TabsTrigger>
            <TabsTrigger value="groups" className="text-xs flex-1">Groups</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1 min-w-0">
        <div className="px-1.5 pb-2 overflow-hidden">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md overflow-hidden">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-2.5 w-8 shrink-0" />
                  </div>
                  <Skeleton className="h-3 w-[72%] mt-1.5" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 && filteredPeople.length === 0 ? (
            <EmptyState 
              type="no-conversations" 
              onCreateGroup={conversationFilter !== 'dms' ? () => setGroupDialogOpen(true) : undefined}
              description={conversationFilter === 'dms' ? "Start a new direct message to get started" : undefined}
            />
          ) : (
            <>
              {showFavouritesSection && (
                <>
                  <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Favourites
                  </div>
                  {favouriteConversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={activeConversationId === conv.id}
                      unreadCount={unreadCounts[conv.id] || 0}
                      onClick={() => onSelect(conv.id)}
                      onlineUserIds={onlineUserIds}
                      onToggleFavourite={onToggleFavourite ? () => onToggleFavourite(conv.id) : undefined}
                      onToggleMute={onToggleMute ? () => onToggleMute(conv.id) : undefined}
                      onMarkRead={onMarkRead ? () => onMarkRead(conv.id) : undefined}
                      onDeleteChat={onDeleteChat ? () => onDeleteChat(conv.id) : undefined}
                    />
                  ))}
                  <div className="px-2.5 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Chats
                  </div>
                </>
              )}
              {regularConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={activeConversationId === conv.id}
                  unreadCount={unreadCounts[conv.id] || 0}
                  onClick={() => onSelect(conv.id)}
                  onlineUserIds={onlineUserIds}
                  onToggleFavourite={onToggleFavourite ? () => onToggleFavourite(conv.id) : undefined}
                  onToggleMute={onToggleMute ? () => onToggleMute(conv.id) : undefined}
                  onMarkRead={onMarkRead ? () => onMarkRead(conv.id) : undefined}
                  onDeleteChat={onDeleteChat ? () => onDeleteChat(conv.id) : undefined}
                />
              ))}
              <PeopleList
                users={filteredPeople}
                onSelect={handleSelectPerson}
                onlineUserIds={onlineUserIds}
              />
              {isCreatingDM && (
                <div className="flex items-center gap-3 px-3 py-2 animate-pulse">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-2 w-32" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      <NewDMDialog open={dmDialogOpen} onOpenChange={setDmDialogOpen} onSelect={onSelect} onConversationCreated={onConversationCreated} orgId={currentOrganization?.id} />
      <NewGroupDialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen} onSelect={onSelect} onConversationCreated={onConversationCreated} orgId={currentOrganization?.id} />
    </div>
  );
}
