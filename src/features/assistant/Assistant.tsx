import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { AssistantConversationList } from './components/AssistantConversationList';
import { AssistantPanel } from './components/AssistantPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function Assistant() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Assistant | Open Plan AI';
    return () => { document.title = 'Open Plan AI'; };
  }, []);

  const handleSelect = (id: string) => {
    setActiveId(id);
    setDrawerOpen(false);
  };

  const handleNewConversation = () => {
    setActiveId(null);
    setDrawerOpen(false);
  };

  if (!isMobile) {
    return (
      <div className="flex h-full min-h-0">
        <AssistantConversationList
          activeId={activeId}
          onSelect={setActiveId}
          onNewConversation={() => setActiveId(null)}
          onActiveDeleted={() => setActiveId(null)}
        />
        <AssistantPanel
          variant="page"
          className="flex-1 min-w-0"
          conversationId={activeId}
          onConversationCreated={setActiveId}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
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
        onConversationCreated={setActiveId}
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
          onActiveDeleted={() => setActiveId(null)}
        />
      </div>
    </div>
  );
}
