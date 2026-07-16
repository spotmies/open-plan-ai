import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { chatService } from '@/services/chat.service';
import { chatTransport } from '../transport';
import { useChatStore } from '../stores/useChatStore';
import { logger } from '@/services/monitoring/logger';
import { useCallSignaling } from '../hooks/useCallSignaling';
import { CallOverlay } from '../components/CallOverlay';

function refreshConversations() {
  chatService.getConversations()
    .then((data) => {
      useChatStore.getState().setConversations(data);
      useChatStore.getState().hydrateUnreadCounts(data);
    })
    .catch((err) => logger.error('Failed to refresh conversations:', err));
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matches the mention format MessageInput inserts ("@Full Name" / "@everyone")
// so group toasts only fire when the current user is actually addressed.
function mentionsUser(content: string, userName: string): boolean {
  if (/@everyone(?=\s|$|[.,!?])/i.test(content)) return true;
  if (!userName) return false;
  const regex = new RegExp(`@${escapeRegExp(userName)}(?=\\s|$|[.,!?])`, 'i');
  return regex.test(content);
}

/**
 * Mounted once near the app root (inside the router, wrapping every route).
 * Keeps chat unread counts and conversation previews fresh app-wide — not just
 * while the Chat page itself is open — so the sidebar badge stays accurate and
 * new messages surface as a clickable toast no matter which page the user is on.
 */
export function ChatNotificationsProvider() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const conversations = useChatStore((s) => s.conversations);

  // Real-time call ringing/accept/decline — app-wide, so an incoming call
  // surfaces no matter which page the user is currently on.
  useCallSignaling();

  // The chat socket only connects once we know the auth cookie is set —
  // connecting eagerly at module-load time races AuthProvider's bootstrap
  // and can leave presence permanently wrong until a full page reload.
  // Reconnect (fresh handshake) whenever the logged-in user changes.
  useEffect(() => {
    if (!user) {
      chatTransport.disconnect();
      return;
    }
    chatTransport.connect();
  }, [user?.id]);

  // Initial hydration — runs once per login, independent of the Chat page ever mounting.
  useEffect(() => {
    if (!user) return;
    refreshConversations();
  }, [user?.id]);

  useEffect(() => {
    if (!user || conversations.length === 0) return;
    const convIds = conversations.map((c) => c.id);

    const conversationChannel = chatTransport.subscribeToConversationUpdates(convIds, refreshConversations);
    const memberChannel = chatTransport.subscribeToMemberUpdates(null, refreshConversations);

    const messageUnsubs = convIds.map((convId) =>
      chatTransport.subscribeToMessages(convId, (payload) => {
        const raw = (payload as any)?.new ?? (payload as any);
        const store = useChatStore.getState();
        const activeId = store.activeConversationId;
        const isOwnMessage = (raw.senderId ?? raw.sender?.id) === user.id;

        if (convId !== activeId) {
          store.incrementUnread(convId);
        }

        const nextConversations = store.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                lastMessage: {
                  content: raw.content ?? '',
                  senderId: raw.senderId ?? raw.sender?.id ?? undefined,
                  senderName: raw.sender?.name ?? raw.senderName ?? '',
                  createdAt: raw.createdAt ?? new Date().toISOString(),
                },
                lastMessageAt: raw.createdAt ?? new Date().toISOString(),
              }
            : c
        );
        store.setConversations(nextConversations);

        if (convId !== activeId && !isOwnMessage) {
          const conv = nextConversations.find((c) => c.id === convId);
          const content = raw.content ?? '';

          // Group chats only notify when the user is @mentioned or @everyone is used —
          // otherwise every message in a busy group would notify all members.
          if (conv?.type === 'group' && !mentionsUser(content, user.name)) {
            return;
          }

          const senderName = raw.sender?.name ?? raw.senderName ?? 'Someone';
          const heading = conv?.type === 'group' && conv.name ? `${senderName} in ${conv.name}` : `${senderName} sent you a message`;
          const preview = content.slice(0, 80);

          toast.custom((toastId) => (
            <button
              type="button"
              onClick={() => {
                toast.dismiss(toastId);
                navigate(`/chat/${convId}`);
              }}
              className="flex w-full items-start gap-3 rounded-lg border border-border bg-background p-3 text-left shadow-lg transition-colors hover:bg-accent/50"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{heading}</span>
                {preview && <span className="block truncate text-xs text-muted-foreground">{preview}</span>}
              </span>
            </button>
          ));
        }
      })
    );

    return () => {
      chatTransport.unsubscribe(conversationChannel);
      chatTransport.unsubscribe(memberChannel);
      messageUnsubs.forEach((unsub) => chatTransport.unsubscribe(unsub));
    };
  }, [user, conversations.length, navigate]);

  return <CallOverlay />;
}
