import { useState, useEffect, useRef } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import {
  ListTodo,
  FolderKanban,
  BarChart3,
  MoreHorizontal,
  LayoutDashboard,
  MessageSquare,
  Users,
  Settings,
  Calendar,
  Sparkles,
  Plug,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAssistantDraftStore } from '@/features/assistant/stores/useAssistantDraftStore';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

// Primary tabs shown in the footer
const primaryNavItems: NavItem[] = [
  { title: 'My Tasks',   url: '/my-day',   icon: ListTodo       },
  { title: 'Projects',   url: '/projects', icon: FolderKanban   },
  { title: 'Dashboard',  url: '/',         icon: LayoutDashboard},
  { title: 'Chat',       url: '/chat',     icon: MessageSquare  },
];

// Secondary items shown under "More"
const moreNavItems: NavItem[] = [
  { title: 'Assistant', url: '/assistant', icon: Sparkles      },
  { title: 'Team',      url: '/team',     icon: Users         },
  { title: 'Calendar',  url: '/calendar', icon: Calendar      },
  { title: 'Reports',   url: '/reports',  icon: BarChart3     },
  { title: 'Integrations', url: '/integrations', icon: Plug   },
  { title: 'Settings',  url: '/settings', icon: Settings      },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const visibleMoreNavItems = moreNavItems;
  const lastAssistantConversationId = useAssistantDraftStore((s) => s.lastActiveConversationId);

  // Tapping "Assistant" always used to reset to a blank composer, even if a
  // thread was already open before navigating elsewhere — send it back to
  // that thread instead, mirroring ChatGPT's persistent nav behavior.
  const navDestination = (item: NavItem) =>
    item.url === '/assistant' && lastAssistantConversationId
      ? `/assistant/${lastAssistantConversationId}`
      : item.url;

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }

    return Boolean(
      matchPath({ path, end: false }, location.pathname) ||
      matchPath({ path: `${path}/*`, end: false }, location.pathname)
    );
  };

  const isMoreActive = visibleMoreNavItems.some((item) => isActive(item.url));

  // Close sheet on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  // Close sheet when navigating
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const handleNavClick = (url: string) => {
    navigate(url);
  };

  return (
    <>
      {/* Backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* "More" bottom sheet */}
      <div
        id="mobile-more-sheet"
        ref={sheetRef}
        className={cn(
          'fixed left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out',
          moreOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none',
        )}
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}
      >
        {/* Sheet handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">More</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="h-7 w-7 flex items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Sheet items */}
        <div className="grid grid-cols-4 gap-1 px-3 py-4">
          {visibleMoreNavItems.map((item) => {
            const active = isActive(item.url);
            return (
              <button
                key={item.url}
                onClick={() => handleNavClick(navDestination(item))}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-150',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <item.icon className={cn('h-5 w-5', active && 'text-primary')} />
                <span className="text-[10px] font-medium leading-none">{item.title}</span>
              </button>
            );
          })}
        </div>

        {/* Safe area spacer */}
        <div className="h-2" />
      </div>

      {/* Footer nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Mobile bottom navigation"
      >
        <div className="h-16 px-2 grid grid-cols-5 items-center">
          {primaryNavItems.map((item) => {
            const active = isActive(item.url);
            return (
              <button
                key={item.url}
                onClick={() => {
                  setMoreOpen(false);
                  handleNavClick(item.url);
                }}
                className="h-full flex flex-col items-center justify-center gap-0.5"
                aria-label={item.title}
                aria-current={active ? 'page' : undefined}
              >
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center transition-colors duration-150',
                    active
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <item.icon className={cn('h-5 w-5', active && 'stroke-[2.3px]')} />
                </div>
                <span className={cn('text-[10px] leading-none transition-colors', active ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                  {item.title}
                </span>
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen((prev) => !prev)}
            className="h-full flex flex-col items-center justify-center gap-0.5"
            aria-label="More"
            aria-expanded={moreOpen}
            aria-controls="mobile-more-sheet"
          >
            <div
              className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center transition-colors duration-150',
                (moreOpen || isMoreActive)
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MoreHorizontal className={cn('h-5 w-5', (moreOpen || isMoreActive) && 'stroke-[2.3px]')} />
            </div>
            <span className={cn('text-[10px] leading-none transition-colors', (moreOpen || isMoreActive) ? 'text-foreground font-medium' : 'text-muted-foreground')}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
