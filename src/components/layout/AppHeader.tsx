import { useMemo, useState } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { Sun, Moon, ChevronLeft, ChevronDown, Check, BarChart3, Plus, Users, Bug, Sparkles, Download, ShoppingCart, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useProjects } from '@/hooks/useProjects';
import type { Project } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationsPopover } from './NotificationsPopover';
import { ReportBugDialog } from '@/features/support/components/ReportBugDialog';
import { useAppTheme } from '@/hooks/useAppTheme';
import { resolveFileUrl } from '@/utils/fileUrl';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { useAssistantStore } from '@/features/assistant/stores/useAssistantStore';
import { ProjectTeamButton } from '@/features/projects/components/ProjectTeamButton';
import { cn } from '@/lib/utils';

// GitHub-style "switch repository" dropdown: search box + list of every project
// the user can access, current one checked, click navigates to the same tab
// (e.g. /bom) on the selected project.
function ProjectSwitcher({ current, restPath }: { current: Project; restPath: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: projects = [] } = useProjects();

  const handleSelect = (id: string) => {
    setOpen(false);
    if (id === current.id) return;
    navigate(restPath ? `/projects/${id}/${restPath}` : `/projects/${id}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 min-w-0 rounded-md px-1 -mx-1 hover:bg-muted transition-colors"
        >
          <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">
            {current.name}
          </h1>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72" align="start">
        <Command>
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>No projects found.</CommandEmpty>
            <CommandGroup>
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => handleSelect(p.id)}
                  className="cursor-pointer"
                >
                  <Check className={cn('h-3.5 w-3.5 shrink-0', p.id === current.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/my-day')) return 'My Tasks';
  if (pathname.startsWith('/projects')) return 'Projects';
  if (pathname.startsWith('/calendar')) return 'Calendar';
  if (pathname.startsWith('/reports')) return 'Reports';
  if (pathname.startsWith('/inventory')) return 'Inventory';
  if (pathname.startsWith('/chat')) return 'Chat';
  if (pathname.startsWith('/team')) return 'Team';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/notifications')) return 'Notifications';
  if (pathname.startsWith('/assistant')) return 'Assistant';
  return 'Open Plan AI';
}

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: profile, signOut } = useAuth();
  const { theme, changeTheme } = useAppTheme();
  const isMobile = useIsMobile();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showReportBugDialog, setShowReportBugDialog] = useState(false);
  const setNewDMDialogOpen = useChatStore((s) => s.setNewDMDialogOpen);
  const setNewGroupDialogOpen = useChatStore((s) => s.setNewGroupDialogOpen);
  const toggleAssistant = useAssistantStore((s) => s.toggle);

  // Mobile chat list route: AppHeader is only rendered here (not on /chat/:id,
  // see AppLayout's showAppHeader), so pathname alone is enough to detect it.
  const isMobileChatList = isMobile && location.pathname.startsWith('/chat');

  // Mobile inventory: back + title, with Receive/New transaction shortcuts that hand off
  // to InventoryView via ?action= query param (same pattern as the Settings ?tab= links
  // below) since the dialogs' state lives locally in InventoryView, not in a shared store.
  const isMobileInventory = isMobile && location.pathname.startsWith('/inventory');

  // Detect project detail route to show project name in header
  const projectMatch = useMatch('/projects/:id/*');
  const projectId = projectMatch?.params?.id;
  const projectRestPath = projectMatch?.params?.['*'] ?? '';
  const { data: project } = useProjectDetail(projectId, { enabled: !!projectId });

  // Mobile project detail: hide theme/notifications/profile, keep only back + name
  const isMobileProjectDetail = isMobile && !!project;

  // Mobile settings page: hide theme/notifications/profile
  const isMobileSettings = isMobile && location.pathname.startsWith('/settings');

  // Full Assistant page already has its own inline Ask UI (and the floating
  // AssistantWidget refuses to render here — see AssistantWidget.tsx). Hide
  // the header button here too, otherwise toggling it just flips isOpen with
  // no visible effect, and that stale true value pops the widget open on
  // whatever route the user navigates to next.
  const isAssistantPage = location.pathname.startsWith('/assistant');

  const pageTitle = useMemo(
    () => getPageTitle(location.pathname),
    [location.pathname],
  );

  const cycleTheme = () => {
    changeTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="relative h-14 border-b border-border flex items-center justify-between px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 w-full max-w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-3 min-w-0">

        {/* Project detail: Back + Name (with switcher dropdown) */}
        {project ? (
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1 h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/projects')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <ProjectSwitcher current={project} restPath={projectRestPath} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {(isMobileChatList || isMobileInventory) && (
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8 -ml-2 shrink-0 text-muted-foreground hover:text-foreground', isMobileInventory && 'border border-border rounded-lg bg-muted')}
                onClick={() => navigate('/')}
                title="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {location.pathname.startsWith('/reports') && (
              <BarChart3 className="h-5 w-5 text-primary shrink-0" />
            )}
            <h1 className={cn('font-semibold text-foreground leading-none', isMobileInventory ? 'text-lg' : 'text-2xl')}>
              {pageTitle}
              {location.pathname.startsWith('/assistant') && (
                <span className="ml-1.5 text-xs font-medium text-muted-foreground align-middle">
                  (BETA)
                </span>
              )}
            </h1>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isMobileInventory ? (
          <>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => navigate('/inventory?action=order')}
              title="Place order"
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => navigate('/inventory?action=receive')}
              title="Receive stock"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => navigate('/inventory?action=adjust')}
              title="New transaction"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </>
        ) : isMobileChatList ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setNewDMDialogOpen(true)}
              title="New Message"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setNewGroupDialogOpen(true)}
              title="New Group"
            >
              <Users className="h-4 w-4" />
            </Button>
          </>
        ) : isMobileProjectDetail || isMobileSettings ? (
          isMobileProjectDetail ? <ProjectTeamButton projectId={projectId!} /> : null
        ) : (
          <>
            {/* Ask Assistant */}
            {!isMobile && !isAssistantPage && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 px-3 text-muted-foreground hover:text-foreground"
                onClick={toggleAssistant}
                title="Ask the Assistant"
              >
                <Sparkles className="h-4 w-4" />
                Ask
                <span className="text-[10px] font-medium text-muted-foreground">
                  (BETA)
                </span>
              </Button>
            )}

            {/* Report a Bug */}
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', isMobile && 'border border-border rounded-xl')}
              onClick={() => setShowReportBugDialog(true)}
              title="Report a bug"
            >
              <Bug className="h-4 w-4" />
              <span className="sr-only">Report a bug</span>
            </Button>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', isMobile && 'border border-border rounded-xl')}
              onClick={cycleTheme}
              title={`Theme: ${theme} (click to cycle)`}
            >
              {theme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>

            {/* Notifications */}
            <NotificationsPopover />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    {profile?.avatarUrl && <AvatarImage src={resolveFileUrl(profile.avatarUrl) ?? profile.avatarUrl} alt={profile?.name || 'User'} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {profile?.initials || profile?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || profile?.email?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile?.name || profile?.email?.split('@')[0] || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{profile?.email || ''}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings?tab=profile')}>Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings?tab=general')}>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowLogoutDialog(true)}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be signed out of your account. Any unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportBugDialog isOpen={showReportBugDialog} onClose={() => setShowReportBugDialog(false)} />
    </header>
  );
}