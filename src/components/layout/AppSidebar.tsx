import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Settings, Users, Calendar, BarChart3, ListTodo, ChevronsUpDown, Check, Plus, Building2, Loader2, MessageSquare, Plug, Sparkles } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Logo } from '@/components/Logo';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgPermissions } from '@/hooks/useProjectPermissions';
import { OrganizationSettings } from '@/services/organizations.service';
import { resolveFileUrl } from '@/utils/fileUrl';
import { toast } from 'sonner';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { useAssistantDraftStore } from '@/features/assistant/stores/useAssistantDraftStore';

const mainNavItems = [{
  title: 'Dashboard',
  url: '/',
  icon: LayoutDashboard
}, {
  title: 'Assistant',
  url: '/assistant',
  icon: Sparkles
}, {
  title: 'My Tasks',
  url: '/my-day',
  icon: ListTodo
}, {
  title: 'Projects',
  url: '/projects',
  icon: FolderKanban
}, {
  title: 'Calendar',
  url: '/calendar',
  icon: Calendar
}, {
  title: 'Reports',
  url: '/reports',
  icon: BarChart3
}, {
  title: 'Chat',
  url: '/chat',
  icon: MessageSquare
}];

const teamNavItems = [{
  title: 'Team',
  url: '/team',
  icon: Users
}, {
  title: 'Integrations',
  url: '/integrations',
  icon: Plug
}, {
  title: 'Settings',
  url: '/settings',
  icon: Settings
}];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const { organizations, currentOrganization, setCurrentOrganization, createOrganization, isLoading: orgLoading } = useOrganization();
  const { isOrgAdmin: canCreateOrg } = useOrgPermissions();
  const chatUnreadCount = useChatStore((s) => s.getTotalUnread());
  const lastAssistantConversationId = useAssistantDraftStore((s) => s.lastActiveConversationId);

  const [orgPopoverOpen, setOrgPopoverOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newOrgForm, setNewOrgForm] = useState({ name: '', description: '' });
  const organizationNavItems = teamNavItems;

  const orgSettings = (currentOrganization?.settings || {}) as OrganizationSettings;
  const orgLogo = resolveFileUrl(orgSettings.logoUrl) ?? orgSettings.logoUrl ?? null;
  const companyName = orgSettings.companyName;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Clicking "Assistant" always used to reset to a blank composer, even if a
  // thread was already open before navigating elsewhere — send it back to
  // that thread instead, mirroring ChatGPT's persistent sidebar behavior.
  const navDestination = (item: typeof mainNavItems[number]) =>
    item.url === '/assistant' && lastAssistantConversationId
      ? `/assistant/${lastAssistantConversationId}`
      : item.url;

  const handleSelectOrg = (org: typeof currentOrganization) => {
    if (org) {
      setCurrentOrganization(org);
      setOrgPopoverOpen(false);
      navigate('/');
    }
  };

  const handleCreateOrg = async () => {
    if (!newOrgForm.name.trim()) {
      toast.error('Organization name is required');
      return;
    }
    setIsCreating(true);
    try {
      await createOrganization(newOrgForm.name, newOrgForm.description);
      toast.success('Organization created successfully');
      setNewOrgForm({ name: '', description: '' });
      setCreateDialogOpen(false);
      setOrgPopoverOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Error creating organization:', error);
      toast.error('Failed to create organization');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        {/* Organization Switcher at top */}
        <SidebarHeader className="p-2">
          <div className="flex items-center gap-2 w-full">
            {/* Org switcher button */}
            <Popover open={orgPopoverOpen} onOpenChange={setOrgPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  className={`group/orgtrigger relative flex items-center rounded-lg  transition-colors cursor-pointer ${collapsed ? 'justify-center p-1.5 w-full' : 'gap-2 p-2 flex-1 min-w-0'}`}
                  aria-label="Switch organization"
                >
                  {/* Org Logo / Fallback */}
                  <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                    {/* Logo — always visible when expanded; fades on hover when collapsed */}
                    <div className={`flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 border border-primary/20 overflow-hidden transition-opacity duration-150 ${collapsed ? 'group-hover/orgtrigger:opacity-0' : ''}`}>
                      {orgLogo ? (
                        <img src={orgLogo} alt="Org logo" className="h-full w-full object-contain" />
                      ) : (
                        <Logo className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                    {/* SidebarTrigger overlay — only shown on hover when collapsed */}
                    {collapsed && (
                      <span
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/orgtrigger:opacity-100 transition-opacity duration-150"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SidebarTrigger className="h-7 w-7 rounded-md" />
                      </span>
                    )}
                  </div>

                  {!collapsed && (
                    <>
                      <div className="flex flex-col items-start min-w-0 flex-1">
                        <span className="font-semibold text-sm text-sidebar-foreground truncate w-full text-left">
                          {currentOrganization?.name || 'No Organization'}
                        </span>
                        {companyName && (
                          <span className="text-[10px] text-muted-foreground truncate w-full text-left">
                            {companyName}
                          </span>
                        )}
                      </div>
                      <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </>
                  )}
                </button>
              </PopoverTrigger>

              <PopoverContent
                className="w-64 p-0"
                side="right"
                align="start"
                sideOffset={8}
              >
                <div className="px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">Organizations</p>
                  <p className="text-xs text-muted-foreground">Switch or create an organization</p>
                </div>
                <Separator />
                <div className="max-h-[240px] overflow-y-auto py-1">
                  {orgLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : organizations.length === 0 ? (
                    <div className="px-3 py-4 text-center">
                      <p className="text-sm text-muted-foreground">No organizations yet</p>
                    </div>
                  ) : (
                    organizations.map((org) => {
                      const settings = (org.settings || {}) as OrganizationSettings;
                      const resolvedLogoUrl = resolveFileUrl(settings.logoUrl) ?? settings.logoUrl ?? null;
                      const isSelected = currentOrganization?.id === org.id;
                      return (
                        <button
                          key={org.id}
                          onClick={() => handleSelectOrg(org)}
                          className={`flex items-center gap-3 w-full px-3 py-2 text-left transition-colors hover:bg-accent/50 ${isSelected ? 'bg-accent' : ''}`}
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 border border-primary/20 overflow-hidden">
                            {resolvedLogoUrl ? (
                              <img src={resolvedLogoUrl} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <Logo className="h-3.5 w-3.5 text-primary" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-medium truncate">{org.name}</span>
                            {settings.companyName && (
                              <span className="text-[11px] text-muted-foreground truncate">{settings.companyName}</span>
                            )}
                          </div>
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
                {canCreateOrg && (
                  <>
                    <Separator />
                    <div className="p-1.5">
                      <button
                        onClick={() => {
                          setOrgPopoverOpen(false);
                          setCreateDialogOpen(true);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Create new organization
                      </button>
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>
            {/* SidebarTrigger — always visible beside org button when expanded */}
            {!collapsed && (
              <SidebarTrigger className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors" />
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-4">
              {!collapsed && 'Main'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems.map(item => {
                  const showChatBadge = item.title === 'Chat' && chatUnreadCount > 0;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton className="overflow-visible relative" asChild isActive={isActive(item.url)} tooltip={collapsed ? item.title : undefined}>
                        <NavLink id={item.url} to={navDestination(item)} end={item.url === '/'} className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                          <span className="relative shrink-0 overflow-visible">
                            <item.icon className="h-4 w-4" />
                          </span>
                          {showChatBadge && collapsed && (
                            <span className="absolute top-1 right-1 z-10 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-status-in-progress px-0.5 text-[9px] font-medium leading-none text-white ring-1 ring-sidebar">
                              {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                            </span>
                          )}
                          {!collapsed && (
                            <span className="flex flex-1 items-center justify-between min-w-0">
                              <span>{item.title}</span>
                              {showChatBadge && (
                                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-status-in-progress px-1 text-[10px] font-medium leading-none text-white">
                                  {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                                </span>
                              )}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-4">
              {!collapsed && 'Organization'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {organizationNavItems.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={collapsed ? item.title : undefined}>
                      <NavLink to={item.url} className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* OpenPlan AI branding at bottom */}
        <SidebarFooter className="p-3">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
              <Logo className="h-3.5 w-3.5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-semibold text-xs text-sidebar-foreground">OpenPlan AI</span>
                <span className="text-[10px] text-muted-foreground">© 2026 OpenPlanAI</span>
              </div>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Create Organization Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Set up a new organization to manage your projects and team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-org-name">Organization Name *</Label>
              <Input
                id="new-org-name"
                value={newOrgForm.name}
                onChange={(e) => setNewOrgForm({ ...newOrgForm, name: e.target.value })}
                placeholder="e.g. My Company"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-org-desc">Description (optional)</Label>
              <Textarea
                id="new-org-desc"
                value={newOrgForm.description}
                onChange={(e) => setNewOrgForm({ ...newOrgForm, description: e.target.value })}
                placeholder="Brief description of your organization"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrg} disabled={isCreating || !newOrgForm.name.trim()}>
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4 mr-2" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}