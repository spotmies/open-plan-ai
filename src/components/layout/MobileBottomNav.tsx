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
  Warehouse,
  X,
  Check,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { useOrganization } from '@/contexts/OrganizationContext';
import { OrganizationSettings } from '@/services/organizations.service';
import { resolveFileUrl } from '@/utils/fileUrl';
import { useAssistantDraftStore } from '@/features/assistant/stores/useAssistantDraftStore';
import { useFeatureTogglesStore, type ToggleableFeature } from '@/stores/useFeatureTogglesStore';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  feature?: ToggleableFeature;
}

// Primary tabs shown in the footer
const primaryNavItems: NavItem[] = [
  { title: 'My Tasks',   url: '/my-day',   icon: ListTodo,        feature: 'my-tasks' },
  { title: 'Projects',   url: '/projects', icon: FolderKanban   },
  { title: 'Dashboard',  url: '/',         icon: LayoutDashboard},
  { title: 'Chat',       url: '/chat',     icon: MessageSquare  },
];

// Secondary items shown under "More"
const moreNavItems: NavItem[] = [
  { title: 'Assistant', url: '/assistant', icon: Sparkles      },
  { title: 'Team',      url: '/team',     icon: Users         },
  { title: 'Calendar',  url: '/calendar', icon: Calendar,      feature: 'calendar' },
  { title: 'Reports',   url: '/reports',  icon: BarChart3,     feature: 'reports' },
  { title: 'Inventory', url: '/inventory', icon: Warehouse,    feature: 'inventory' },
  { title: 'Integrations', url: '/integrations', icon: Plug   },
  { title: 'Settings',  url: '/settings', icon: Settings      },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const enabledFeatures = useFeatureTogglesStore((s) => s.enabled);
  const visiblePrimaryNavItems = primaryNavItems.filter((item) => !item.feature || enabledFeatures[item.feature]);
  const visibleMoreNavItems = moreNavItems.filter((item) => !item.feature || enabledFeatures[item.feature]);
  const lastAssistantConversationId = useAssistantDraftStore((s) => s.lastActiveConversationId);

  // Org switching lives in the sidebar on desktop, which mobile never renders —
  // without this a multi-org member is stuck on whichever org this device
  // happened to restore, with every org-scoped view silently empty.
  const { organizations, currentOrganization, setCurrentOrganization, isLoading: orgLoading } = useOrganization();
  const [orgListOpen, setOrgListOpen] = useState(false);
  const canSwitchOrg = organizations.length > 1;

  const currentOrgSettings = (currentOrganization?.settings || {}) as OrganizationSettings;
  const currentOrgLogo = resolveFileUrl(currentOrgSettings.logoUrl) ?? currentOrgSettings.logoUrl ?? null;

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

  // Collapse the org list whenever the sheet closes, so reopening "More"
  // always starts on the nav grid rather than mid-switch.
  useEffect(() => {
    if (!moreOpen) setOrgListOpen(false);
  }, [moreOpen]);

  const handleNavClick = (url: string) => {
    navigate(url);
  };

  // Land on the dashboard after switching, same as the desktop sidebar: the
  // current route may point at a project/task belonging to the old org.
  const handleSelectOrg = (org: typeof currentOrganization) => {
    if (!org) return;
    setCurrentOrganization(org);
    setOrgListOpen(false);
    setMoreOpen(false);
    navigate('/');
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

        {/* Current organization + switcher */}
        {(orgLoading || currentOrganization) && (
          <div className="border-b border-border">
            <button
              onClick={() => canSwitchOrg && setOrgListOpen((o) => !o)}
              disabled={!canSwitchOrg}
              className={cn(
                'w-full flex items-center gap-3 px-5 py-3 text-left transition-colors',
                canSwitchOrg ? 'hover:bg-accent/50' : 'cursor-default',
              )}
              aria-expanded={canSwitchOrg ? orgListOpen : undefined}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 border border-primary/20 overflow-hidden">
                {currentOrgLogo ? (
                  <img src={currentOrgLogo} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Logo className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Organization
                </span>
                <span className="text-sm font-medium text-foreground truncate">
                  {orgLoading && !currentOrganization ? 'Loading…' : currentOrganization?.name}
                </span>
              </div>
              {canSwitchOrg && (
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
                    orgListOpen && 'rotate-180',
                  )}
                />
              )}
            </button>

            {canSwitchOrg && orgListOpen && (
              <div className="max-h-[220px] overflow-y-auto border-t border-border/60 bg-muted/20 py-1">
                {orgLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  organizations.map((org) => {
                    const settings = (org.settings || {}) as OrganizationSettings;
                    const logoUrl = resolveFileUrl(settings.logoUrl) ?? settings.logoUrl ?? null;
                    const isSelected = currentOrganization?.id === org.id;
                    return (
                      <button
                        key={org.id}
                        onClick={() => handleSelectOrg(org)}
                        className={cn(
                          'w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-accent/50',
                          isSelected && 'bg-accent/60',
                        )}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 border border-primary/20 overflow-hidden">
                          {logoUrl ? (
                            <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <Logo className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium text-foreground truncate">{org.name}</span>
                          {settings.companyName && (
                            <span className="text-[11px] text-muted-foreground truncate">{settings.companyName}</span>
                          )}
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Sheet items */}
        <div className="grid grid-cols-3 gap-1 px-3 py-4">
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
        <div
          className="h-16 px-2 grid items-center"
          style={{ gridTemplateColumns: `repeat(${visiblePrimaryNavItems.length + 1}, minmax(0, 1fr))` }}
        >
          {visiblePrimaryNavItems.map((item) => {
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
