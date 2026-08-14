import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Maximize2, Plus, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { AssistantPanel } from './AssistantPanel';
import { useAssistantStore } from '../stores/useAssistantStore';

export function AssistantWidget() {
  const { isOpen, close, toggle } = useAssistantStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Global Cmd/Ctrl+K — mirrors the Ctrl/Cmd+B sidebar shortcut in
  // components/ui/sidebar.tsx. This component is mounted once at the app
  // shell level (see App.tsx), so the listener is always live regardless of
  // route.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  // Not signed in yet (widget can mount before auth resolves), or already on
  // the full Assistant page — either way there's nothing for the widget to add.
  if (!isOpen || !user || location.pathname.startsWith('/assistant')) return null;

  const handleExpand = () => {
    close();
    navigate('/assistant');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[600px] max-h-[80vh] w-[420px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Assistant</p>
            <p className="truncate text-xs text-muted-foreground">Simply ask...</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setActiveId(null)}
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleExpand}
            title="Open full page"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={close}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AssistantPanel
        variant="widget"
        className="flex-1 min-h-0"
        conversationId={activeId}
        onConversationCreated={setActiveId}
      />
    </div>
  );
}
