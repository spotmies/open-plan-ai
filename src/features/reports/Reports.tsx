import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadCSVReport, triggerPDFExport } from './utils/exportUtils';
import { ReportsHeader } from './components/ReportsHeader';
import { ReportsFilters } from './components/ReportsFilters';
import { ReportsKPIRow } from './components/ReportsKPIRow';
import { ReportTaskStatusChart } from './components/ReportTaskStatusChart';
import { ReportMilestoneHealth } from './components/ReportMilestoneHealth';
import { ReportTeamWorkload } from './components/ReportTeamWorkload';
import { ReportModuleProgress } from './components/ReportModuleProgress';
import { ReportOpenIssuesTable } from './components/ReportOpenIssuesTable';
import { ReportTrendChart } from './components/ReportTrendChart';
import { ReportBomSection } from './components/ReportBomSection';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';
import { useProjects } from '@/hooks/useProjects';
import { useOrgAllTasks } from '@/hooks/useTasks';
import { useOrgAllIssues } from '@/hooks/useIssues';
import { useAllMilestones } from '@/hooks/useMilestones';
import { useOrgAllModules } from '@/hooks/useModules';
import { useTeamMembers } from '@/hooks/useTeam';
import { useBomTree, useBomCostTrend } from '@/hooks/useBom';
import { useCurrency } from '@/hooks/useCurrency';
import { fromApiNode, bomFlatAll, applyPriceRollup } from '@/features/projects/components/bomData';
import { useOrganization } from '@/contexts/OrganizationContext';
import { TeamMember as ServiceTeamMember } from '@/services/team.service';
import { Module as DbModule } from '@/services/modules.service';
import { Milestone as DbMilestone } from '@/services/milestones.service';
import {
  ReportFilter,
  getDateRangeFromTimeRange,
  getTaskStatusBreakdown,
  getIssueStatusBreakdown,
  getMilestoneHealth,
  getTeamWorkload,
  getModuleProgress,
  getCompletedTasksTrend,
  applyFilters,
  filterTasksByTimeRange,
  calculateKPIs,
  calculateProjectProgress,
} from './utils/reportsUtils';
import { TeamMember, Module, Milestone, ModuleType } from '@/types';

// ─── Type Adapters ────────────────────────────────────────────────────────────

function dbMilestoneToFrontend(dbM: DbMilestone): Milestone {
  return {
    id: dbM.id,
    title: dbM.name,
    date: dbM.due_date || '',
    completed: dbM.status === 'completed',
    description: dbM.description || undefined,
  };
}

function dbModuleToFrontend(dbM: DbModule): Module {
  return {
    id: dbM.id,
    name: dbM.name,
    type: (dbM.module_type as ModuleType) || 'software',
    description: dbM.description || undefined,
    createdAt: dbM.created_at || '',
    progress: dbM.progress || 0,
    status: dbM.status as any || 'active',
  };
}

function serviceTeamMemberToFrontend(m: ServiceTeamMember): TeamMember {
  return {
    id: m.userId,
    name: m.name,
    email: m.email,
    role: m.role,
    initials: m.initials,
    avatar: m.avatar_url || undefined,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Reports() {
  const navigate = useNavigate();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();

  useEffect(() => {
    document.title = 'Reports | Open Plan AI';
    return () => { document.title = 'Open Plan AI'; };
  }, []);
  const orgId = currentOrganization?.id;

  const [filter, setFilter] = useState<ReportFilter>({ timeRange: '30d' });

  // ─── Real data hooks ─────────────────────────────────────────────────────
  const { data: allProjects = [], isLoading: projectsLoading } = useProjects();
  const { data: allTasks = [], isLoading: tasksLoading } = useOrgAllTasks();
  const { data: allIssues = [], isLoading: issuesLoading } = useOrgAllIssues();
  const { data: dbMilestones = [], isLoading: milestonesLoading } = useAllMilestones();
  const { data: dbModules = [], isLoading: modulesLoading } = useOrgAllModules();
  const { data: serviceTeamMembers = [], isLoading: teamLoading } = useTeamMembers(orgId);
  const { formatCurrency } = useCurrency();

  const isLoading = orgLoading || projectsLoading || tasksLoading || issuesLoading || milestonesLoading || modulesLoading || teamLoading;

  // ─── Adapted frontend types ───────────────────────────────────────────────
  const allAdaptedMilestones = useMemo(
    () => dbMilestones.map(dbMilestoneToFrontend),
    [dbMilestones]
  );

  const allAdaptedModules = useMemo(
    () => dbModules.map(dbModuleToFrontend),
    [dbModules]
  );

  const allAdaptedTeamMembers = useMemo(
    () => serviceTeamMembers.map(serviceTeamMemberToFrontend),
    [serviceTeamMembers]
  );

  // Org-level task/issue endpoints return data from ALL projects regardless of
  // membership. Restrict to projects visible in the dropdown so "All Projects"
  // and a single-project view are consistent when the org has one member-project.
  const visibleProjectIds = useMemo(
    () => new Set(allProjects.map(p => p.id)),
    [allProjects]
  );

  // ─── Project-scoped data ─────────────────────────────────────────────────
  const tasks = useMemo(() => {
    if (!filter.projectId) return allTasks.filter(t => visibleProjectIds.has(t.projectId));
    return allTasks.filter(t => t.projectId === filter.projectId);
  }, [allTasks, visibleProjectIds, filter.projectId]);

  const issues = useMemo(() => {
    if (!filter.projectId) return allIssues.filter(i => visibleProjectIds.has(i.projectId));
    return allIssues.filter(i => i.projectId === filter.projectId);
  }, [allIssues, visibleProjectIds, filter.projectId]);

  const milestones = useMemo(() => {
    if (!filter.projectId) return allAdaptedMilestones;
    const filtered = dbMilestones.filter(m => m.project_id === filter.projectId);
    return filtered.map(dbMilestoneToFrontend);
  }, [dbMilestones, allAdaptedMilestones, filter.projectId]);

  const modules = useMemo(() => {
    if (!filter.projectId) return allAdaptedModules;
    const filtered = dbModules.filter(m => m.project_id === filter.projectId);
    return filtered.map(dbModuleToFrontend);
  }, [dbModules, allAdaptedModules, filter.projectId]);

  // ─── Project name for header ──────────────────────────────────────────────
  const projectName = useMemo(() => {
    if (!filter.projectId) return undefined;
    return allProjects.find(p => p.id === filter.projectId)?.name;
  }, [allProjects, filter.projectId]);

  // ─── BOM (project-scoped only — there is no org-wide BOM tree) ────────────
  const { data: bomTree } = useBomTree(filter.projectId);
  const [bomCostTrendGranularity, setBomCostTrendGranularity] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const { data: bomCostTrend, isLoading: bomCostTrendLoading } = useBomCostTrend(filter.projectId, bomCostTrendGranularity);
  const bomNodes = useMemo(() => {
    if (!bomTree?.roots?.length) return [];
    const roots = bomTree.roots.map(r => applyPriceRollup(fromApiNode(r)));
    return bomFlatAll(roots);
  }, [bomTree]);

  // ─── Date range ───────────────────────────────────────────────────────────
  const dateRange = useMemo(
    () => getDateRangeFromTimeRange(filter.timeRange, filter.customDateRange),
    [filter.timeRange, filter.customDateRange]
  );

  // ─── Task list: project/module/etc. filters first, then time window ────────
  const scopedTasks = useMemo(() => applyFilters(tasks, filter), [tasks, filter]);

  const filteredTasks = useMemo(
    () => filterTasksByTimeRange(scopedTasks, dateRange),
    [scopedTasks, dateRange]
  );

  // ─── KPIs (same task set as charts — no mixed filtered vs unfiltered totals) ─
  const kpis = useMemo(
    () => calculateKPIs(filteredTasks, issues, dateRange, milestones, modules),
    [filteredTasks, issues, dateRange, milestones, modules]
  );

  // ─── Chart data ───────────────────────────────────────────────────────────
  const statusBreakdown = useMemo(() => getTaskStatusBreakdown(filteredTasks), [filteredTasks]);
  const issueStatusBreakdown = useMemo(() => getIssueStatusBreakdown(issues), [issues]);
  const milestoneHealth = useMemo(() => getMilestoneHealth(milestones, tasks), [milestones, tasks]);
  const teamWorkload = useMemo(() => getTeamWorkload(filteredTasks, allAdaptedTeamMembers, issues), [filteredTasks, allAdaptedTeamMembers, issues]);
  const moduleProgress = useMemo(() => getModuleProgress(tasks, modules), [tasks, modules]);
  const trendData = useMemo(() => getCompletedTasksTrend(filteredTasks, dateRange), [filteredTasks, dateRange]);

  // ─── Time range label ─────────────────────────────────────────────────────
  const timeRangeLabel = useMemo(() => {
    switch (filter.timeRange) {
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case '90d': return 'Last 90 days';
      case 'custom': return 'Custom range';
      default: return '';
    }
  }, [filter.timeRange]);

  const handleTimeRangeChange = useCallback((value: ReportFilter['timeRange']) => {
    setFilter(prev => ({ ...prev, timeRange: value }));
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleKPIClick = useCallback((_type: 'progress' | 'issues' | 'overdue' | 'cycle') => {
    if (filter.projectId) navigate(`/projects/${filter.projectId}`);
  }, [filter.projectId, navigate]);

  const handleStatusClick = useCallback((status: string) => {
    setFilter(prev => ({ ...prev, status: [status as any] }));
  }, []);

  const handleMilestoneClick = useCallback((milestoneId: string) => {
    const dbM = dbMilestones.find(m => m.id === milestoneId);
    if (dbM?.project_id) navigate(`/projects/${dbM.project_id}`);
    else if (filter.projectId) navigate(`/projects/${filter.projectId}`);
  }, [dbMilestones, filter.projectId, navigate]);

  const handleMemberClick = useCallback((memberId: string) => {
    setFilter(prev => ({ ...prev, assigneeIds: [memberId] }));
  }, []);

  const handleIssueClick = useCallback((issueId: string) => {
    const issue = allIssues.find(i => i.id === issueId);
    if (issue?.projectId) navigate(`/projects/${issue.projectId}/issues/${issueId}`);
  }, [allIssues, navigate]);

  const handleExport = useCallback((format: 'csv' | 'pdf') => {
    if (format === 'csv') {
      downloadCSVReport({
        kpis,
        statusBreakdown,
        milestoneHealth,
        teamWorkload,
        moduleProgress,
        trendData,
        issues,
        projectName,
        timeRangeLabel,
      });
    } else {
      triggerPDFExport();
    }
  }, [kpis, statusBreakdown, milestoneHealth, teamWorkload, moduleProgress, trendData, issues, projectName, timeRangeLabel]);

  if (isLoading) {
    return <AppLayoutSkeleton variant="reports" />;
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        <ReportsHeader
          projectName={projectName}
          timeRangeLabel={timeRangeLabel}
          timeRange={filter.timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          onExport={handleExport}
        />

        <ReportsFilters
          projects={allProjects}
          teamMembers={allAdaptedTeamMembers}
          modules={modules}
          milestones={milestones}
          filter={filter}
          onFilterChange={setFilter}
          onExport={handleExport}
        />

        <ReportsKPIRow kpis={kpis} statusBreakdown={statusBreakdown} onKPIClick={handleKPIClick} />

        {/* 2-Column Grid for Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ReportTaskStatusChart
            data={statusBreakdown}
            issueData={issueStatusBreakdown}
            onStatusClick={handleStatusClick}
          />
          <ReportMilestoneHealth
            data={milestoneHealth}
            onMilestoneClick={handleMilestoneClick}
          />
          <ReportTeamWorkload
            data={teamWorkload}
            onMemberClick={handleMemberClick}
          />
          <ReportModuleProgress
            data={moduleProgress}
          />
        </div>

        {/* Full Width: Trend Chart */}
        <ReportTrendChart data={trendData} />

        {/* Full Width: Open Issues Table */}
        {/* <ReportOpenIssuesTable
          issues={issues}
          onIssueClick={handleIssueClick}
        /> */}

        {/* Bill of Materials — project-scoped only */}
        {filter.projectId ? (
          <ReportBomSection
            projectName={projectName}
            nodes={bomNodes}
            formatCurrency={formatCurrency}
            costTrendData={bomCostTrend}
            costTrendLoading={bomCostTrendLoading}
            costTrendGranularity={bomCostTrendGranularity}
            onCostTrendGranularityChange={setBomCostTrendGranularity}
          />
        ) : (
          <div className="pt-6 mt-2 border-t">
            <Card>
              <CardContent className="flex items-center justify-center h-[120px] text-muted-foreground text-sm">
                Select a project above to see its Bill of Materials data.
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
