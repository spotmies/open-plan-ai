import { useMemo, useState } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { Sun, Moon, ChevronLeft, BarChart3, Plus, Users, Bug, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

const stageColors: Record<string, string> = {
  concept: 'bg-muted text-muted-foreground',
  design: 'bg-chart-1/10 text-chart-1',
  development: 'bg-chart-2/10 text-chart-2',
  testing: 'bg-chart-4/10 text-chart-4',
  production: 'bg-chart-3/10 text-chart-3',
};

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/my-day')) return 'My Tasks';
  if (pathname.startsWith('/projects')) return 'Projects';
  if (pathname.startsWith('/calendar')) return 'Calendar';
  if (pathname.startsWith('/reports')) return 'Reports';
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

  // Detect project detail route to show project name in header
  const projectMatch = useMatch('/projects/:id/*');
  const projectId = projectMatch?.params?.id;
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
    <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3 min-w-0">

        {/* Project detail: Back + Name + Stage */}
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
            <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">
              {project.name}
            </h1>
            {!isMobile && (
              <Badge
                variant="secondary"
                className={cn(stageColors[project.stage] ?? '', 'shrink-0')}
              >
                {project.stage.charAt(0).toUpperCase() + project.stage.slice(1)}
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isMobileChatList && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/')}
                title="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {location.pathname.startsWith('/reports') && (
              <BarChart3 className="h-5 w-5 text-primary shrink-0" />
            )}
            <h1 className="text-2xl font-semibold text-foreground leading-none">
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
        {isMobileChatList ? (
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