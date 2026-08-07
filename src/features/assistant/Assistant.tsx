import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { AssistantConversationList } from './components/AssistantConversationList';
import { AssistantPanel } from './components/AssistantPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// `100vh`/`h-full` don't shrink when the on-screen keyboard opens on mobile,
// so the composer (a plain flex child) ends up positioned below the visible
// area, covered by the keyboard. Tracking `visualViewport` and sizing the
// page to it keeps the composer glued to the keyboard's top edge.
function useKeyboardAwareHeight(active: boolean) {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      setHeight(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);

  return height;
}

export default function Assistant() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const activeId = conversationId ?? null;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const keyboardAwareHeight = useKeyboardAwareHeight(isMobile);

  useEffect(() => {
    document.title = 'Assistant | Open Plan AI';
    return () => { document.title = 'Open Plan AI'; };
  }, []);

  // Each selection pushes its own history entry (rather than replacing), so
  // clicking through several past conversations and then hitting the
  // browser's back button steps back through them in the exact order they
  // were opened — matching ChatGPT's /c/:id behavior.
  const handleSelect = useCallback((id: string) => {
    navigate(`/assistant/${id}`);
    setDrawerOpen(false);
  }, [navigate]);

  const handleNewConversation = useCallback(() => {
    navigate('/assistant');
    setDrawerOpen(false);
  }, [navigate]);

  // The very first message of a brand-new conversation creates it server-side
  // before any id exists; once that resolves, reflect it in the URL so a
  // refresh (or a later back-navigation) lands back on this same chat instead
  // of a blank composer.
  const handleConversationCreated = useCallback((id: string) => {
    navigate(`/assistant/${id}`);
  }, [navigate]);

  if (!isMobile) {
    return (
      <div className="flex h-full min-h-0">
        <AssistantConversationList
          activeId={activeId}
          onSelect={handleSelect}
          onNewConversation={handleNewConversation}
          onActiveDeleted={handleNewConversation}
        />
        <AssistantPanel
          variant="page"
          className="flex-1 min-w-0"
          conversationId={activeId}
          onConversationCreated={handleConversationCreated}
        />
      </div>
    );
  }

  return (
    <div
      className={cn('flex min-h-0 flex-col overflow-hidden', keyboardAwareHeight === null && 'h-full')}
      style={keyboardAwareHeight !== null ? { height: keyboardAwareHeight } : undefined}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground active:bg-muted"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-[15px] font-semibold text-foreground">
          Assistant
          <span className="ml-1 text-[10px] font-medium text-muted-foreground align-middle">
            (BETA)
          </span>
        </span>
        <button
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground active:bg-muted"
          aria-label="Open conversations"
          aria-expanded={drawerOpen}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <AssistantPanel
        variant="page"
        className="flex-1 min-w-0"
        conversationId={activeId}
        onConversationCreated={handleConversationCreated}
      />

      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-[82%] max-w-[300px] bg-background shadow-2xl transition-transform duration-300 ease-out',
          drawerOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <AssistantConversationList
          activeId={activeId}
          onSelect={handleSelect}
          onNewConversation={handleNewConversation}
          onActiveDeleted={handleNewConversation}
        />
      </div>
    </div>
  );
}
