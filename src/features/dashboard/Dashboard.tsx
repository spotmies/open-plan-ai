import { useState, useMemo, useEffect } from 'react';
import { DashboardStats } from './components/DashboardStats';
import { ActivityFeed } from './components/ActivityFeed';
import { ProjectsOverview } from './components/ProjectsOverview';
import { EngineeringChangesSummary } from './components/EngineeringChangesSummary';
import { BomReadiness } from './components/BomReadiness';
import { DashboardGreeting } from './components/DashboardGreeting';
import { NeedsAttentionCard } from './components/NeedsAttentionCard';
import { useOrgEcoAggregate, useOrgBomAggregate } from './hooks/useOrgAggregates';
import { useAvailableHeight } from './hooks/useAvailableHeight';
import { useRecentActivity, useUpcomingDashboardMilestones } from '@/hooks/useDashboard';
import { useProjects } from '@/hooks/useProjects';
import { projectHealth } from './utils/projectHealth';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';
import { Activity } from '@/types';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Loader2, Plus, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/use-mobile';
import { teamService } from '@/services/team.service';
import { logger } from '@/services/monitoring/logger';

export default function Dashboard() {
  const isMobile = useIsMobile();
  const { ref: gridRef, height: gridHeight } = useAvailableHeight(320, 24);
  const { currentOrganization, isLoading: orgLoading, createOrganization, refreshOrganizations } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newOrgForm, setNewOrgForm] = useState({ name: '', description: '' });

  const { data: activities, isLoading: activitiesLoading } = useRecentActivity(10);
  const { data: milestones, isLoading: milestonesLoading } = useUpcomingDashboardMilestones(50);
  const { data: projects, isLoading: projectsLoading } = useProjects();

  const projectIds = useMemo(() => (projects ?? []).map((p) => p.id), [projects]);
  const ecoAgg = useOrgEcoAggregate(projectIds);
  const bomAgg = useOrgBomAggregate(projectIds);

  // Include org loading so we show the skeleton (not a flash of zeros / empty
  // states) while the org resolves and the org-scoped queries are still disabled.
  const isLoading = orgLoading || activitiesLoading || milestonesLoading || projectsLoading;

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
    } catch (error) {
      logger.error('Error creating organization:', error);
      toast.error('Failed to create organization');
    } finally {
      setIsCreating(false);
    }
  };

  // Fetch pending invitations for current user — via service layer, not inline Supabase.
  const { data: pendingInvitations } = useQuery({
    queryKey: ['pending-invitations', user?.email],
    queryFn: () => teamService.getPendingInvitationsForUser(user!.email!),
    enabled: !!user?.email,
  });

  const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null);

  const handleAcceptInvite = async (invitation: { id: string }) => {
    setAcceptingInvite(invitation.id);
    try {
      const { apiClient } = await import('@/services/api/client');
      const { ENDPOINTS } = await import('@/services/api/endpoints');
      await apiClient.post(ENDPOINTS.ORGANIZATIONS.ACCEPT_BY_ID(invitation.id), {});
      toast.success('Successfully joined the organization!');
    } catch (err: any) {
      // 409 means the user is already a member — treat as success and dismiss
      const isAlreadyMember =
        err?.response?.status === 409 ||
        err?.status === 409 ||
        (err?.message || '').toLowerCase().includes('already') ||
        (err?.code || '').toUpperCase() === 'CONFLICT';

      if (!isAlreadyMember) {
        toast.error(err.message || 'Failed to accept invitation');
        setAcceptingInvite(null);
        return;
      }
      // Already a member — just dismiss the banner silently
    } finally {
      await refreshOrganizations();
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] });
      setAcceptingInvite(null);
    }
  };

  // Transform activities for ActivityFeed (Activity type)
  const activityItems: Activity[] = (activities || []).map((activity: any) => {
    const userName: string = activity.user?.name || 'Team Member';
    const initials: string = userName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'TM';
    return {
      id: activity.id,
      type: activity.type,
      title: (activity.description || activity.title || 'Activity').split(' ').slice(0, 3).join(' '),
      description: activity.description || activity.title || '',
      user: {
        id: activity.user?.id || 'unknown',
        name: userName,
        email: '',
        role: '',
        initials,
      },
      projectId: activity.projectId,
      projectName: '',
      entityType: activity.entityType ?? null,
      entityId: activity.entityId ?? null,
      timestamp: activity.createdAt || new Date().toISOString(),
    };
  });

  // Projects with an overdue, incomplete milestone are flagged "at risk" for the
  // Project Management RAG calc — the dashboard milestones API has no atRisk flag,
  // so derive it from due date the same way UpcomingMilestones does inline.
  const atRiskProjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of milestones ?? []) {
      const dueIso = m.due_date ?? m.dueDate;
      const pid = m.project_id ?? m.projectId;
      if (!dueIso || !pid || m.status === 'completed') continue;
      if (new Date(dueIso).getTime() < Date.now()) ids.add(pid);
    }
    return ids;
  }, [milestones]);

  const nextGate = useMemo(() => {
    const upcoming = (milestones ?? [])
      .map((m) => {
        const dueIso = m.due_date ?? m.dueDate;
        if (!dueIso) return null;
        const days = Math.round((new Date(dueIso).getTime() - Date.now()) / 86400000);
        return days >= 0 ? { days, name: m.name } : null;
      })
      .filter((x): x is { days: number; name: string } => x != null)
      .sort((a, b) => a.days - b.days);
    return upcoming[0] ?? null;
  }, [milestones]);

  const dashboardProjects = useMemo(() => projects ?? [], [projects]);
  const onTrackCount = useMemo(
    () => dashboardProjects.filter((p) => projectHealth(p, atRiskProjectIds.has(p.id)).rag === 'green').length,
    [dashboardProjects, atRiskProjectIds],
  );
  const atRiskCount = dashboardProjects.length - onTrackCount;

  // Most overdue red-RAG project, surfaced as the headline "Needs Attention" item on mobile.
  const mostOverdueProject = useMemo(() => {
    const overdue = dashboardProjects
      .map((p) => ({ project: p, health: projectHealth(p, atRiskProjectIds.has(p.id)) }))
      .filter((x) => x.health.rag === 'red' && x.health.days < 0)
      .sort((a, b) => a.health.days - b.health.days);
    return overdue[0] ?? null;
  }, [dashboardProjects, atRiskProjectIds]);

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  // Show "Create Organization" card when no org exists
  const showNoOrgState = !orgLoading && !currentOrganization;

  useEffect(() => {
    document.title = 'Dashboard | Open Plan AI';
    return () => { document.title = 'Open Plan AI'; };
  }, []);

  return (
    <>
      <div className="flex flex-col gap-3 md:gap-4 animate-fade-in overflow-x-hidden">

        {/* Compact Create Organization Banner */}
        {/* {showNoOrgState && (
          <Card className="border-dashed border border-primary/25 bg-primary/[0.03]">
            <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4 px-4 sm:px-5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Create Your Organization</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set up an organization to manage projects and collaborate with your team.
                </p>
              </div>
              <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="gap-1.5 shrink-0 w-full sm:w-auto">
                <Plus className="h-3.5 w-3.5" />
                Create
              </Button>
            </CardContent>
          </Card>
        )} */}

        {/* Pending Invitations Banner */}
        {/* {pendingInvitations && pendingInvitations.length > 0 && pendingInvitations.map((inv: any) => (
          <Card key={inv.id} className="border-dashed border border-primary/25 bg-primary/[0.03]">
            <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4 px-4 sm:px-5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  Pending Invitation: {inv.organizations?.name || 'Organization'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You've been invited as a <strong>{inv.role}</strong>. Click Join to accept.
                </p>
              </div>
              <Button
                onClick={() => handleAcceptInvite({ id: inv.id, token: inv.token })}
                size="sm"
                className="gap-1.5 shrink-0 w-full sm:w-auto"
                disabled={acceptingInvite === inv.id}
              >
                {acceptingInvite === inv.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Building2 className="h-3.5 w-3.5" />
                )}
                Join
              </Button>
            </CardContent>
          </Card>
        ))} */}

        {isLoading ? (
          <AppLayoutSkeleton variant="dashboard" />
        ) : (
          <>
            {/* Dashboard Stats */}
            {/* <DashboardStats
              portfolio={{ onTrack: onTrackCount, total: dashboardProjects.length }}
              eco={{ open: ecoAgg.open, awaitingMyAction: ecoAgg.awaitingMyAction }}
              bom={{ pct: bomAgg.pct, pending: bomAgg.pending }}
              nextGate={nextGate ? { days: nextGate.days, label: nextGate.name } : null}
            /> */}

            {/* Dashboard Welcome / Greeting Container */}
            {/* {isMobile && (
              <DashboardGreeting name={firstName} attentionCount={atRiskCount + bomAgg.rejected} />
            )} */}

            {/* Needs Attention Card */}
            {/* {isMobile && (
              <NeedsAttentionCard
                overdueProject={mostOverdueProject ? {
                  id: mostOverdueProject.project.id,
                  name: mostOverdueProject.project.name,
                  days: mostOverdueProject.health.days,
                  stageLabel: mostOverdueProject.project.stage,
                } : null}
                atRiskCount={atRiskCount}
                bomRejected={bomAgg.rejected}
              />
            )} */}

            <div className="grid gap-3 md:gap-4 lg:grid-cols-3 items-start">
              <div>
                <ProjectsOverview projects={dashboardProjects} atRiskProjectIds={atRiskProjectIds} />
              </div>
              <div>
                <EngineeringChangesSummary projectIds={projectIds} projects={dashboardProjects} />
              </div>
              <div className="flex flex-col space-y-4 md:space-y-3">
                <BomReadiness projectIds={projectIds} projects={dashboardProjects} />
                <ActivityFeed
                  activities={activityItems}
                  isLoading={activitiesLoading || isLoading}
                />
              </div>
            </div>
          </>
        )}
      </div>

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
              <Label htmlFor="dashboard-org-name">Organization Name *</Label>
              <Input
                id="dashboard-org-name"
                value={newOrgForm.name}
                onChange={(e) => setNewOrgForm({ ...newOrgForm, name: e.target.value })}
                placeholder="e.g. My Company"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dashboard-org-desc">Description (optional)</Label>
              <Textarea
                id="dashboard-org-desc"
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
