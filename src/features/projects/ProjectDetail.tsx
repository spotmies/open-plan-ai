import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Flag, AlertTriangle, Users, Calendar, CalendarIcon, Search, X, Plus, Filter, User, Clock, LayoutGrid, List, Loader2, MessageCircle, Trash2, Upload, Download, Tag } from 'lucide-react';
import { BOMView } from './components/BOMView';
import RequirementsView from './components/RequirementsView';
import { ECOView } from './components/ECOView';
import { GateView } from './components/GateView';
import { RiskView } from './components/RiskView';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { TasksSection, ViewControls } from './components/TasksSection';
import { ModulesSection, ModuleViewControls } from './components/ModulesSection';
import { MilestonesView } from './components/MilestonesView';
import { IssuesView } from './components/IssuesView';
import { SupportLinksSheet } from './components/SupportLinksSheet';
import { ProjectDetailSkeleton } from './components/ProjectDetailSkeleton';
import { ProjectProgressPopover } from './components/ProjectProgressPopover';
import { AddModuleDialog } from './components/AddModuleDialog';
import { TaskDetailModal } from './components/TaskDetailModal';
import { ModuleDetailModal } from './components/ModuleDetailModal';
import { MilestoneDetailModal } from './components/MilestoneDetailModal';
import { IssueDetailModal } from './components/IssueDetailModal';
import { TaskFiltersDropdown } from './components/TaskFiltersDropdown';
import { ProjectTeamButton } from './components/ProjectTeamButton';
import { resolveProjectTabConfig, visibleOrderedTabDefinitions } from './projectTabsConfig';
import { MultiSelect } from '@/components/ui/multi-select';
import { useProjectDetail, useProjectModules } from '@/hooks/useProjectDetail';
import { useProjectRealtime } from '@/hooks/useProjectRealtime';
import { useOrganizationMembers, useProjectMembers } from '@/hooks/useProjectTeam';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { useProjectTaskColumns } from '@/hooks/useProjectTaskColumns';
import { buildTaskStatusOptions } from './utils/taskStatusOptions';
import { useIssueColumns } from '@/hooks/useIssueColumns';
import { DEFAULT_ISSUE_COLUMNS, type ProjectIssueColumn } from '@/services/issueColumns.service';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUpdateProjectProgress } from '@/hooks/useProjects';
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useCreateIssue,
  useUpdateIssue,
  useDeleteIssue,
  useCreateMilestone,
  useUpdateMilestone,
  useToggleMilestoneComplete,
  useDeleteMilestone,
  useCreateModule,
  useUpdateModule,
  useDeleteModule,
  useBatchUpdateTasks,
  useBatchUpdateModules,
} from '@/hooks/useProjectMutations';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { projectMembersService } from '@/services/projectMembers.service';
import { attachmentsService } from '@/services/attachments.service';
import { chatService } from '@/services/chat.service';
import { ProjectChatPanel } from './components/ProjectChatPanel';
import { toast } from 'sonner';
import { calculateProjectProgress, getModuleTasks, getModuleProgress } from './utils/projectUtils';
import { ProjectSection, ProjectTabId, Module, TaskViewMode, TaskFilter, ModuleViewMode, Issue, Milestone, Task, IssueStatus, IssueSeverity, TeamMember, ProjectRole } from '@/types';
import { logger } from '@/services/monitoring/logger';
import { format } from 'date-fns';
import { resolveFileUrl } from '@/utils/fileUrl';

// Issue Filter interface
interface IssueFilter {
  status?: string[]; // status keys from the project's issue buckets (custom, not a fixed enum)
  severity?: IssueSeverity[];
  assigneeId?: string[];
  assignedById?: string[];
  updatedById?: string[];
  dueDate?: 'overdue' | 'today' | 'this-week' | 'this-month' | 'no-date';
  dueDateCustom?: string; // exact date (yyyy-MM-dd) picked from the calendar, overrides dueDate preset
  reportedDate?: 'today' | 'this-week' | 'this-month';
  reportedDateCustom?: string; // exact date (yyyy-MM-dd) picked from the calendar, overrides reportedDate preset
  tags?: string[];
}



const DEFAULT_MEMBER_REMOVAL_PROMPT: {
  open: boolean;
  memberId: string | null;
  memberName: string;
} = {
  open: false,
  memberId: null,
  memberName: '',
};

/** Normalizes a loosely-typed TeamMember.role (or missing role) to a ProjectRole. */
const toProjectRole = (role: string | undefined | null): ProjectRole => {
  const normalized = (role || '').toLowerCase();
  if (normalized === 'admin' || normalized === 'maintainer') return normalized;
  return 'member';
};

// Milestone View Controls Component — only the toggle (search is in parent)
function MilestoneViewControls({
  viewMode,
  onViewModeChange,
}: {
  viewMode: 'list' | 'kanban';
  onViewModeChange: (mode: 'list' | 'kanban') => void;
}) {
  return (
    <div className="flex items-center gap-0.5 bg-muted/50 p-1 rounded-lg shrink-0">
      <Button
        variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onViewModeChange('kanban')}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onViewModeChange('list')}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Issue View Controls Component — view toggle + filter only (search is in parent)
function IssueViewControls({
  viewMode,
  onViewModeChange,
  filters,
  onFiltersChange,
  teamMembers,
  issueColumns,
  allTags,
  activeFilterCount,
  onClearFilters,
}: {
  viewMode: 'table' | 'kanban';
  onViewModeChange: (mode: 'table' | 'kanban') => void;
  filters: IssueFilter;
  onFiltersChange: (filters: IssueFilter) => void;
  teamMembers: TeamMember[];
  issueColumns: ProjectIssueColumn[];
  allTags: string[];
  activeFilterCount: number;
  onClearFilters: () => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {/* View Toggle */}
      <div className="flex items-center gap-0.5 bg-muted/50 p-1 rounded-lg shrink-0">
        <Button
          variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onViewModeChange('kanban')}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === 'table' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onViewModeChange('table')}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter Dropdown */}
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 h-9 rounded-lg">
            <Filter className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Filter Issues</h4>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onClearFilters();
                    setFilterOpen(false);
                  }}
                  className="h-6 px-2 text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Status
              </Label>
              <MultiSelect
                options={issueColumns.map((column) => ({ value: column.status, label: column.label }))}
                selected={filters.status || []}
                onChange={(values) => onFiltersChange({ ...filters, status: values.length ? values : undefined })}
                placeholder="All Status"
              />
            </div>

            {/* Priority Filter */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Flag className="h-3 w-3" />
                Priority
              </Label>
              <MultiSelect
                options={[
                  { value: 'critical', label: 'Critical' },
                  { value: 'major', label: 'Major' },
                  { value: 'minor', label: 'Minor' },
                  { value: 'trivial', label: 'Trivial' },
                ]}
                selected={filters.severity || []}
                onChange={(values) => onFiltersChange({ ...filters, severity: values.length ? (values as IssueSeverity[]) : undefined })}
                placeholder="All Priorities"
              />
            </div>

            {/* Assigned To Filter */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <User className="h-3 w-3" />
                Assigned To
              </Label>
              <MultiSelect
                options={[
                  { value: 'unassigned', label: 'Unassigned' },
                  ...teamMembers.map(member => ({ value: member.id, label: member.name }))
                ]}
                selected={filters.assigneeId || []}
                onChange={(values) => onFiltersChange({ ...filters, assigneeId: values.length ? values : undefined })}
                placeholder="All Assignees"
              />
            </div>

            {/* Assigned By Filter */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <User className="h-3 w-3" />
                Assigned By
              </Label>
              <MultiSelect
                options={teamMembers.map(member => ({ value: member.id, label: member.name }))}
                selected={filters.assignedById || []}
                onChange={(values) => onFiltersChange({ ...filters, assignedById: values.length ? values : undefined })}
                placeholder="All Members"
              />
            </div>

            {/* Updated By Filter */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <User className="h-3 w-3" />
                Updated By
              </Label>
              <MultiSelect
                options={teamMembers.map(member => ({ value: member.id, label: member.name }))}
                selected={filters.updatedById || []}
                onChange={(values) => onFiltersChange({ ...filters, updatedById: values.length ? values : undefined })}
                placeholder="All Members"
              />
            </div>

            {/* Tags Filter */}
            {allTags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Tags
                </Label>
                <MultiSelect
                  options={allTags.map((tag) => ({ value: tag, label: tag }))}
                  selected={filters.tags || []}
                  onChange={(values) => onFiltersChange({ ...filters, tags: values.length ? values : undefined })}
                  placeholder="All Tags"
                />
              </div>
            )}

            {/* Due Date Filter */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Due Date
              </Label>
              <div className="flex items-center gap-1">
                <Select
                  value={filters.dueDate ?? 'all'}
                  onValueChange={(v) => onFiltersChange({
                    ...filters,
                    dueDate: v === 'all' ? undefined : v as IssueFilter['dueDate'],
                    dueDateCustom: undefined,
                  })}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Any Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Date</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this-week">This Week</SelectItem>
                    <SelectItem value="this-month">This Month</SelectItem>
                    <SelectItem value="no-date">No Date</SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant={filters.dueDateCustom ? 'secondary' : 'outline'}
                      size="icon"
                      className="h-8 w-8 shrink-0"
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarPicker
                      mode="single"
                      selected={filters.dueDateCustom ? new Date(filters.dueDateCustom) : undefined}
                      onSelect={(date) => onFiltersChange({
                        ...filters,
                        dueDateCustom: date ? format(date, 'yyyy-MM-dd') : undefined,
                        dueDate: date ? undefined : filters.dueDate,
                      })}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {filters.dueDateCustom && (
                <div className="flex items-center justify-between pl-1">
                  <span className="text-xs text-muted-foreground">{format(new Date(filters.dueDateCustom), 'PPP')}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-xs"
                    onClick={() => onFiltersChange({ ...filters, dueDateCustom: undefined })}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>

            {/* Reported Date Filter */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Reported Date
              </Label>
              <div className="flex items-center gap-1">
                <Select
                  value={filters.reportedDate ?? 'all'}
                  onValueChange={(v) => onFiltersChange({
                    ...filters,
                    reportedDate: v === 'all' ? undefined : v as IssueFilter['reportedDate'],
                    reportedDateCustom: undefined,
                  })}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Any Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Date</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this-week">This Week</SelectItem>
                    <SelectItem value="this-month">This Month</SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant={filters.reportedDateCustom ? 'secondary' : 'outline'}
                      size="icon"
                      className="h-8 w-8 shrink-0"
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarPicker
                      mode="single"
                      selected={filters.reportedDateCustom ? new Date(filters.reportedDateCustom) : undefined}
                      onSelect={(date) => onFiltersChange({
                        ...filters,
                        reportedDateCustom: date ? format(date, 'yyyy-MM-dd') : undefined,
                        reportedDate: date ? undefined : filters.reportedDate,
                      })}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {filters.reportedDateCustom && (
                <div className="flex items-center justify-between pl-1">
                  <span className="text-xs text-muted-foreground">{format(new Date(filters.reportedDateCustom), 'PPP')}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-xs"
                    onClick={() => onFiltersChange({ ...filters, reportedDateCustom: undefined })}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function ProjectDetail() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id, tab: tabParam, partId, ecoId, taskId, moduleId, milestoneId, issueId } = useParams();
  const { data: boardColumns } = useProjectTaskColumns(id);
  const filterStatusOptions = useMemo(() => buildTaskStatusOptions(boardColumns), [boardColumns]);
  const { data: apiIssueColumns } = useIssueColumns(id);
  const issueColumns = apiIssueColumns && apiIssueColumns.length > 0 ? apiIssueColumns : DEFAULT_ISSUE_COLUMNS;

  // The /bom/:partId, /eng-changes/:ecoId, /tasks/:taskId, /modules/:moduleId,
  // /milestones/:milestoneId, and /issues/:issueId routes encode the section as a
  // literal path segment rather than the generic :tab param, so infer it from which
  // item id is present.
  const ALL_SECTIONS: ProjectSection[] = ['bom', 'eng-changes', 'tasks', 'modules', 'milestones', 'issues', 'gate-reviews', 'risk'];
  const section: ProjectSection = partId
    ? 'bom'
    : ecoId
      ? 'eng-changes'
      : taskId
        ? 'tasks'
        : moduleId
          ? 'modules'
          : milestoneId
            ? 'milestones'
            : issueId
              ? 'issues'
              : ALL_SECTIONS.includes(tabParam as ProjectSection)
                ? (tabParam as ProjectSection)
                : 'bom';

  const isMobile = useIsMobile();
  const [viewModeStr, setViewModeStr] = useState<TaskViewMode | null>(null);
  const [moduleViewModeStr, setModuleViewModeStr] = useState<ModuleViewMode | null>(null);
  const [issueViewModeStr, setIssueViewModeStr] = useState<'table' | 'kanban' | null>(null);
  const [bomAddOpen, setBomAddOpen] = useState(false);
  const [ecoNewOpen, setEcoNewOpen] = useState(false);
  const [milestoneViewModeStr, setMilestoneViewModeStr] = useState<'list' | 'kanban' | null>(null);

  const viewMode = viewModeStr || (isMobile ? 'list' : 'kanban');
  const moduleViewMode = moduleViewModeStr || (isMobile ? 'list' : 'kanban');
  const issueViewMode = issueViewModeStr || (isMobile ? 'table' : 'kanban');
  const milestoneViewMode = milestoneViewModeStr || (isMobile ? 'list' : 'kanban');

  const setViewMode = (val: TaskViewMode) => setViewModeStr(val);
  const setModuleViewMode = (val: ModuleViewMode) => setModuleViewModeStr(val);
  const setIssueViewMode = (val: 'table' | 'kanban') => setIssueViewModeStr(val);
  const setMilestoneViewMode = (val: 'list' | 'kanban') => setMilestoneViewModeStr(val);

  // Mobile-only: long-press a section tab to reveal its name below the icon.
  const [longPressedTab, setLongPressedTab] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (longPressHideTimerRef.current) clearTimeout(longPressHideTimerRef.current);
    };
  }, []);

  const handleTabLongPressStart = (value: string) => {
    if (!isMobile) return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedTab(value);
      if (longPressHideTimerRef.current) clearTimeout(longPressHideTimerRef.current);
      longPressHideTimerRef.current = setTimeout(() => setLongPressedTab(null), 1500);
    }, 500);
  };

  const handleTabLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const [filters, setFilters] = useState<TaskFilter>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleSearchQuery, setModuleSearchQuery] = useState('');
  // Mobile-only: the module detail full-page view supplies its own header/back
  // button, so the tab strip + search bar above it must hide while it's open.
  const [isMobileModuleDetailOpen, setIsMobileModuleDetailOpen] = useState(false);
  const [milestoneSearchQuery, setMilestoneSearchQuery] = useState('');
  const [issueSearchQuery, setIssueSearchQuery] = useState('');
  const [issueFilters, setIssueFilters] = useState<IssueFilter>({});
  const [isAddModuleDialogOpen, setIsAddModuleDialogOpen] = useState(false);
  const [isAddMilestoneDialogOpen, setIsAddMilestoneDialogOpen] = useState(false);
  const [isAddIssueDialogOpen, setIsAddIssueDialogOpen] = useState(false);
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState('');
  const [selectedMemberRoleToAdd, setSelectedMemberRoleToAdd] = useState<ProjectRole>('member');
  const [isAddingProjectMember, setIsAddingProjectMember] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [projectChatConversationId, setProjectChatConversationId] = useState<string | null>(null);
  const [memberRemovalPrompt, setMemberRemovalPrompt] = useState<{
    open: boolean;
    memberId: string | null;
    memberName: string;
  }>(DEFAULT_MEMBER_REMOVAL_PROMPT);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [memberRoleUpdatingId, setMemberRoleUpdatingId] = useState<string | null>(null);
  const isRemovingMemberRef = useRef(isRemovingMember);

  useEffect(() => {
    isRemovingMemberRef.current = isRemovingMember;
  }, [isRemovingMember]);

  // Fetch project data using React Query
  const { data: project, isLoading, error } = useProjectDetail(id);
  // Live-updates BOM/ECO/Issues caches from other users' actions, regardless
  // of which tab is currently mounted (see useProjectRealtime.ts).
  useProjectRealtime(id);
  const { data: projectModules = [] } = useProjectModules(id);
  const { data: organizationMembers = [] } = useOrganizationMembers(currentOrganization?.id);
  const { data: projectMembers = [] } = useProjectMembers(id);
  const {
    canManageMembers,
    isProjectMaintainerPlus,
    isProjectMemberPlus,
  } = useProjectPermissions(id);

  // Mutation hooks
  const createTaskMutation = useCreateTask(id || '');
  const updateTaskMutation = useUpdateTask(id || '');
  const deleteTaskMutation = useDeleteTask(id || '');
  const createIssueMutation = useCreateIssue(id || '');
  const updateIssueMutation = useUpdateIssue(id || '');
  const deleteIssueMutation = useDeleteIssue(id || '');
  const createMilestoneMutation = useCreateMilestone(id || '');
  const updateMilestoneMutation = useUpdateMilestone(id || '');
  const toggleMilestoneCompleteMutation = useToggleMilestoneComplete(id || '');
  const deleteMilestoneMutation = useDeleteMilestone(id || '');
  const createModuleMutation = useCreateModule(id || '');
  const updateModuleMutation = useUpdateModule(id || '');
  const deleteModuleMutation = useDeleteModule(id || '');
  const batchUpdateTasksMutation = useBatchUpdateTasks(id || '');
  const batchUpdateModulesMutation = useBatchUpdateModules(id || '');
  const updateProjectProgressMutation = useUpdateProjectProgress();

  // Project-configurable tab order/visibility (set in Edit Project). Falls back
  // to the default order with everything visible when the project has no saved config.
  const visibleTabs = useMemo(
    () => visibleOrderedTabDefinitions(resolveProjectTabConfig(project?.tabConfig)),
    [project?.tabConfig]
  );

  // If the current section's tab has been hidden by the project's tab config,
  // fall back to the first visible tab instead of rendering an unreachable section.
  useEffect(() => {
    if (!project || !tabParam || partId || ecoId || taskId || moduleId || milestoneId || issueId) return;
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.some((t) => t.id === tabParam)) {
      navigate(`/projects/${id}/${visibleTabs[0].id}`, { replace: true });
    }
  }, [project, tabParam, partId, ecoId, taskId, moduleId, milestoneId, issueId, visibleTabs, navigate, id]);

  // Calculate active filter count - moved before early returns
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status?.length) count++;
    if (filters.priority?.length) count++;
    if (filters.module?.length) count++;
    if (filters.assignee?.length) count++;
    if (filters.milestoneId) count++;
    if (filters.dueDate) count++;
    if (filters.tags?.length) count++;
    if (filters.hasBlockers) count++;
    return count;
  }, [filters]);

  // Get unique team members from tasks - moved before early returns
  const teamMembers = useMemo(() => {
    if (!project?.tasks) return [];
    const members = new Map<string, { id: string; name: string; initials: string }>();
    project.tasks.forEach(task => {
      task.assignees?.forEach(assignee => {
        members.set(assignee.id, {
          id: assignee.id,
          name: assignee.name,
          initials: assignee.initials,
        });
      });
    });
    return Array.from(members.values());
  }, [project?.tasks]);

  // Get unique tags from tasks - moved before early returns
  const allTags = useMemo(() => {
    if (!project?.tasks) return [];
    const tags = new Set<string>();
    project.tasks.forEach(task => {
      task.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [project?.tasks]);

  // Get unique tags from issues
  const allIssueTags = useMemo(() => {
    if (!project?.issues) return [];
    const tags = new Set<string>();
    project.issues.forEach(issue => {
      issue.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [project?.issues]);

  // Map database modules to frontend Module type
  const modules: Module[] = useMemo(() => {
    return projectModules.map((m) => {
      const owner = m.owner_id
        ? organizationMembers.find((member) => member.id === m.owner_id) ?? {
          id: m.owner_id,
          name: m.owner?.name || 'Unknown',
          initials: (m.owner?.name || '?').slice(0, 2).toUpperCase(),
          email: '',
          role: 'member',
        }
        : undefined;
      const createdBy = m.created_by
        ? organizationMembers.find((member) => member.id === m.created_by!.id) ?? {
          id: m.created_by.id,
          name: m.created_by.name || 'Unknown',
          initials: (m.created_by.name || '?').slice(0, 2).toUpperCase(),
          email: '',
          role: 'member',
        }
        : undefined;
      return {
        id: m.id,
        name: m.name,
        type: m.module_type,
        description: m.description || '',
        progress: m.progress || 0,
        status: m.status || 'active',
        owner,
        createdBy,
        createdAt: m.created_at || new Date().toISOString(),
        milestoneId: m.milestone_id || undefined,
      };
    });
  }, [projectModules, organizationMembers]);

  const existingModuleNames = useMemo(() => modules.map(m => m.name), [modules]);

  // Deep-linked entities (e.g. opened via a chat entity tag) — looked up from
  // already-loaded project data rather than fetched separately.
  const deepLinkTask = useMemo(
    () => (taskId ? (project?.tasks || []).find(t => t.id === taskId) ?? null : null),
    [taskId, project?.tasks]
  );
  const deepLinkModule = useMemo(() => {
    if (!moduleId) return null;
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return null;
    const moduleTasks = getModuleTasks(mod.id, project?.tasks || []);
    const progress = getModuleProgress(mod.id, project?.tasks || []);
    const openIssues = (project?.issues || []).filter(i => i.moduleId === mod.id && i.status !== 'resolved').length;
    return { ...mod, taskCount: moduleTasks.length, progress, openIssues, tasks: moduleTasks };
  }, [moduleId, modules, project?.tasks, project?.issues]);
  const deepLinkMilestone = useMemo(
    () => (milestoneId ? (project?.milestones || []).find(m => m.id === milestoneId) ?? null : null),
    [milestoneId, project?.milestones]
  );
  const deepLinkIssue = useMemo(
    () => (issueId ? (project?.issues || []).find(i => i.id === issueId) ?? null : null),
    [issueId, project?.issues]
  );

  // Calculate project progress breakdown
  const progressBreakdown = useMemo(() => {
    return calculateProjectProgress(
      project?.tasks || [],
      project?.milestones || [],
      modules,
      project?.issues || []
    );
  }, [project?.tasks, project?.milestones, modules, project?.issues]);

  // Refs for progress-sync effect (defined here so they're stable across renders)
  const updateProjectProgressMutateRef = useRef(updateProjectProgressMutation.mutate);
  updateProjectProgressMutateRef.current = updateProjectProgressMutation.mutate;
  const updateProjectIsPendingRef = useRef(updateProjectProgressMutation.isPending);
  updateProjectIsPendingRef.current = updateProjectProgressMutation.isPending;
  // Tracks the last progress value we attempted to sync, so a failed sync
  // (e.g. permission or network error) can't be retried on every re-render —
  // only a genuinely NEW target value triggers another attempt.
  const lastAttemptedProgressRef = useRef<number | null>(null);

  // Filter tasks by search query
  const filteredTasks = useMemo(() => {
    if (!project?.tasks || !searchQuery.trim()) return project?.tasks || [];
    const query = searchQuery.toLowerCase();
    return project.tasks.filter(task =>
      task.title.toLowerCase().includes(query)
    );
  }, [project?.tasks, searchQuery]);

  // Calculate active issue filter count
  const activeIssueFilterCount = useMemo(() => {
    let count = 0;
    if (issueFilters.status?.length) count++;
    if (issueFilters.severity?.length) count++;
    if (issueFilters.assigneeId?.length) count++;
    if (issueFilters.assignedById?.length) count++;
    if (issueFilters.updatedById?.length) count++;
    if (issueFilters.dueDate !== undefined) count++;
    if (issueFilters.dueDateCustom !== undefined) count++;
    if (issueFilters.reportedDate !== undefined) count++;
    if (issueFilters.reportedDateCustom !== undefined) count++;
    if (issueFilters.tags?.length) count++;
    return count;
  }, [issueFilters]);

  const clearIssueFilters = () => {
    setIssueFilters({});
  };

  // Member management (add/remove/change role) is Admin-only.
  const canManageProjectMembers = canManageMembers;

  // Adding modules/milestones plus changing project stage/status is
  // Maintainer+ (manages all content, not just their own).
  const canAddModulesAndMilestones = isProjectMaintainerPlus;

  // Sync calculated progress — Maintainer+ only, via the dedicated
  // Maintainer-accessible progress endpoint (not the Admin-only general
  // project-update endpoint). Guarded by lastAttemptedProgressRef so a
  // failed sync is attempted once per distinct target value, never looped.
  useEffect(() => {
    if (
      project &&
      progressBreakdown.overallProgress !== project.progress &&
      progressBreakdown.overallProgress !== lastAttemptedProgressRef.current &&
      !updateProjectIsPendingRef.current &&
      canAddModulesAndMilestones
    ) {
      lastAttemptedProgressRef.current = progressBreakdown.overallProgress;
      updateProjectProgressMutateRef.current({
        id: project.id,
        progress: progressBreakdown.overallProgress
      });
    }
  }, [project, progressBreakdown.overallProgress, canAddModulesAndMilestones]);

  // Starting the project chat is available to any project member (any access at all).
  const canStartProjectChat = isProjectMemberPlus;

  const availableOrganizationMembers = useMemo(() => {
    const projectMemberIds = new Set(projectMembers.map((member) => member.id));
    return organizationMembers.filter((member) => !projectMemberIds.has(member.id));
  }, [organizationMembers, projectMembers]);

  const handleAddProjectMember = async () => {
    if (!project || !selectedMemberToAdd) return;
    if (!canManageProjectMembers) {
      toast.error('Only a project Admin can add or remove members');
      return;
    }

    const isMemberAlreadyInProject = projectMembers.some((m) => m.id === selectedMemberToAdd);
    if (isMemberAlreadyInProject) {
      toast.error('Member is already in this project');
      return;
    }

    const isMemberInOrganization = availableOrganizationMembers.some(
      (m) => m.id === selectedMemberToAdd
    );
    if (!isMemberInOrganization) {
      toast.error('Selected member is no longer available');
      return;
    }

    setIsAddingProjectMember(true);
    try {
      await projectMembersService.addMember({
        project_id: project.id,
        user_id: selectedMemberToAdd,
        role: selectedMemberRoleToAdd,
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(currentOrganization?.id) });
      await queryClient.invalidateQueries({ queryKey: ['project-members', project.id] });

      toast.success('Member added to project');
      setSelectedMemberToAdd('');
      setSelectedMemberRoleToAdd('member');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add member to project';
      toast.error(message);
    } finally {
      setIsAddingProjectMember(false);
    }
  };

  const handleUpdateProjectMemberRole = async (memberId: string, role: ProjectRole) => {
    if (!project || !canManageProjectMembers) return;

    setMemberRoleUpdatingId(memberId);
    try {
      await projectMembersService.updateRole(project.id, memberId, role);
      await queryClient.invalidateQueries({ queryKey: ['project-members', project.id] });
      toast.success('Member role updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update member role';
      toast.error(message);
    } finally {
      setMemberRoleUpdatingId(null);
    }
  };

  const handleStartProjectChat = async () => {
    if (!project) return;
    if (!canStartProjectChat) {
      toast.error('Only project team members can start this project chat');
      return;
    }

    // Already resolved this project's chat — just toggle the docked panel
    // instead of re-hitting the lookup/ensure endpoints.
    if (projectChatConversationId) {
      setIsChatPanelOpen((prev) => !prev);
      return;
    }

    setIsStartingChat(true);
    try {
      const timeoutMs = Number(import.meta.env.VITE_CHAT_START_PROJECT_TIMEOUT_MS ?? 6000);
      const maxAttempts = Number(import.meta.env.VITE_CHAT_START_PROJECT_MAX_ATTEMPTS ?? 2);
      const withTimeout = async <T,>(p: Promise<T>, ms: number, timeoutMessage: string): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), ms)),
        ]);

      const isNetworkError = (message: string) => {
        const m = message.toLowerCase();
        return (
          m.includes('network') ||
          m.includes('timeout') ||
          m.includes('failed to fetch') ||
          m.includes('fetch') ||
          m.includes('unavailable')
        );
      };

      let conversationId: string | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          if (attempt === 0) {
            conversationId = await withTimeout(
              chatService.getProjectGroupConversationId(project.id),
              timeoutMs,
              'Project chat lookup timed out'
            );
          }

          if (!conversationId) {
            // Ensure RPC is idempotent; we only do this when conversation mapping isn't present.
            conversationId = await withTimeout(
              chatService.ensureProjectGroup(project.id),
              timeoutMs,
              'Project chat start timed out'
            );
          }
        } catch (attemptErr) {
          const message = attemptErr instanceof Error ? attemptErr.message : 'Failed to start project chat';
          if (attempt >= maxAttempts - 1 || !isNetworkError(message)) throw attemptErr;
          conversationId = null;
          continue;
        }

        if (conversationId) break;
      }

      if (!conversationId) {
        throw new Error('Failed to start project chat. Please try again.');
      }

      setProjectChatConversationId(conversationId);
      setIsChatPanelOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start project chat';
      if (message && message.toLowerCase().includes('access denied')) {
        toast.error('You no longer have access to start this project chat');
      } else if (message) {
        toast.error(message);
      } else {
        toast.error('Failed to start project chat. Please try again.');
      }
    } finally {
      setIsStartingChat(false);
    }
  };

  const handleRemoveProjectMember = async (removeFromChatToo: boolean) => {
    if (!project || !memberRemovalPrompt.memberId) return;
    if (!canManageProjectMembers) {
      toast.error('Only a project Admin can add or remove members');
      return;
    }

    const isValidUuidLike = (value: unknown): value is string => {
      if (typeof value !== 'string') return false;
      return (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
        /^[0-9a-f]{32}$/i.test(value)
      );
    };

    const memberId = memberRemovalPrompt.memberId;
    if (!isValidUuidLike(project.id) || !isValidUuidLike(memberId)) {
      toast.error('Invalid member selection');
      return;
    }
    const isMemberInProject = projectMembers.some((m) => m.id === memberId);
    if (!isMemberInProject) {
      toast.error('That member is not part of this project anymore');
      return;
    }

    setIsRemovingMember(true);
    try {
      if (!removeFromChatToo) {
        await chatService.retainProjectChatMembershipAfterRemoval(project.id, [memberId]);
      }

      await projectMembersService.removeMember(project.id, memberId);

      if (removeFromChatToo) {
        // Only attempt chat cleanup if the project chat mapping exists.
        // Member removal from the project should not fail due to chat cleanup issues.
        try {
          const conversationId = await chatService.getProjectGroupConversationId(project.id);
          if (conversationId) {
            await chatService.forceRemoveProjectChatMembers(project.id, [memberId]);
          }
        } catch (chatErr) {
          logger.warn('[ProjectDetail] chat cleanup failed during member removal', {
            projectId: project.id,
            memberId,
            error: chatErr instanceof Error ? chatErr.message : String(chatErr),
          });
          toast.warning(
            'Member removed from project, but could not update project group chat',
            { description: chatErr instanceof Error ? chatErr.message : undefined }
          );
        }
      }

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(currentOrganization?.id) }),
        queryClient.invalidateQueries({ queryKey: ['project-members', project.id] }),
      ]);

      toast.success('Member removed from project');
      setMemberRemovalPrompt(DEFAULT_MEMBER_REMOVAL_PROMPT);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member';
      toast.error(message);
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleIssueCreate = async (newIssuePartial: Partial<Issue>, pendingFiles?: File[]) => {
    if (!project) return;

    const created = await createIssueMutation.mutateAsync({
      ...newIssuePartial,
      title: newIssuePartial.title || 'New Issue',
      description: newIssuePartial.description || '',
      descriptionBlocks: newIssuePartial.descriptionBlocks || [],
      status: newIssuePartial.status || 'open',
      severity: newIssuePartial.severity || 'minor',
      category: newIssuePartial.category || 'other',
      assignees: newIssuePartial.assignees || [],
      tags: newIssuePartial.tags || [],
      checklist: newIssuePartial.checklist || [],
      dueDate: newIssuePartial.dueDate,
      blocksTaskIds: newIssuePartial.blocksTaskIds || [],
      reportedBy: newIssuePartial.reportedBy || { id: '', name: '', email: '', role: 'Member', initials: '' },
    } as Omit<Issue, 'id' | 'reportedAt'>);

    if (pendingFiles && pendingFiles.length > 0 && created?.id) {
      try {
        await Promise.all(
          pendingFiles.map(file =>
            attachmentsService.upload({
              entityId: created.id,
              entityType: 'issue',
              projectId: project.id,
              file,
            })
          )
        );
      } catch {
        toast.warning('Issue created but some attachments failed to upload');
      }
    }
  };

  const handleIssueUpdate = (updatedIssue: Issue) => {
    updateIssueMutation.mutate({
      projectId: updatedIssue.projectId || id || '',
      issueId: updatedIssue.id,
      updates: updatedIssue,
    });
  };

  const handleAddModule = () => {
    setIsAddModuleDialogOpen(true);
  };

  const handleModuleAdd = async (newModule: Omit<Module, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      await createModuleMutation.mutateAsync({
        name: newModule.name,
        module_type: newModule.type,
        description: newModule.description || undefined,
        status: 'active',
        progress: 0,
        owner_id: newModule.owner?.id || null,
      });
      setIsAddModuleDialogOpen(false);
      return true;
    } catch {
      return false;
    }
  };

  const handleModuleUpdate = async (updatedModule: Module): Promise<boolean> => {
    try {
      await updateModuleMutation.mutateAsync({
        moduleId: updatedModule.id,
        updates: {
          name: updatedModule.name,
          module_type: updatedModule.type,
          description: updatedModule.description || null,
          status: updatedModule.status || 'active',
          progress: updatedModule.progress ?? 0,
          owner_id: updatedModule.owner?.id || null,
          milestone_id: updatedModule.milestoneId || null,
        },
      });
      return true;
    } catch {
      return false;
    }
  };

  const handleMilestoneCreate = async (newMilestonePartial: Omit<Milestone, 'id'>) => {
    if (!project) return;

    try {
      const createdMilestone = await createMilestoneMutation.mutateAsync({
        name: newMilestonePartial.title,
        due_date: newMilestonePartial.date || null,
        description: newMilestonePartial.description || null,
        status: newMilestonePartial.completed ? 'completed' : 'upcoming',
      });

      // Link tasks if any were selected during creation
      if (newMilestonePartial.linkedTaskIds && newMilestonePartial.linkedTaskIds.length > 0) {
        batchUpdateTasksMutation.mutate(
          newMilestonePartial.linkedTaskIds.map(taskId => ({ id: taskId, updates: { milestoneId: createdMilestone.id } }))
        );
      }

      // Link modules if any were selected during creation
      if (newMilestonePartial.linkedModuleIds && newMilestonePartial.linkedModuleIds.length > 0) {
        batchUpdateModulesMutation.mutate(
          newMilestonePartial.linkedModuleIds.map(moduleId => ({ id: moduleId, milestone_id: createdMilestone.id }))
        );
      }

      // Link issues if any were selected during creation
      if (newMilestonePartial.linkedIssueIds && newMilestonePartial.linkedIssueIds.length > 0) {
        const allIssues = project.issues || [];
        newMilestonePartial.linkedIssueIds.forEach(issueId => {
          const issue = allIssues.find(i => i.id === issueId);
          if (!issue) return;
          updateIssueMutation.mutate({
            projectId: issue.projectId || id || '',
            issueId,
            updates: { blocksMilestoneIds: [...(issue.blocksMilestoneIds || []), createdMilestone.id] },
          });
        });
      }
    } catch (error: any) {
      logger.error('Failed to create milestone and link tasks:', error);
      toast.error(error?.message || 'Failed to create milestone');
    }
  };

  const handleMilestoneUpdate = (updatedMilestone: Milestone) => {
    // Update milestone core fields
    updateMilestoneMutation.mutate({
      milestoneId: updatedMilestone.id,
      updates: {
        name: updatedMilestone.title,
        due_date: updatedMilestone.date || null,
        description: updatedMilestone.description || null,
        status: updatedMilestone.completed ? undefined : (updatedMilestone.status || null),
      },
    });

    // Completion is a separate endpoint on the backend, not part of the general update.
    const previousMilestone = (project?.milestones || []).find(m => m.id === updatedMilestone.id);
    if (previousMilestone && previousMilestone.completed !== updatedMilestone.completed) {
      toggleMilestoneCompleteMutation.mutate({
        milestoneId: updatedMilestone.id,
        completed: updatedMilestone.completed,
      });
    }

    // Persist linked task changes by updating ONLY each task's milestoneId field
    const previousLinkedTaskIds = (project?.tasks || [])
      .filter(t => t.milestoneId === updatedMilestone.id)
      .map(t => t.id);
    const newLinkedTaskIds = updatedMilestone.linkedTaskIds || [];

    const addedTaskIds = newLinkedTaskIds.filter(id => !previousLinkedTaskIds.includes(id));
    const removedTaskIds = previousLinkedTaskIds.filter(id => !newLinkedTaskIds.includes(id));

    const taskUpdates = [
      ...addedTaskIds.map(id => ({ id, updates: { milestoneId: updatedMilestone.id } })),
      ...removedTaskIds.map(id => ({ id, updates: { milestoneId: null } }))
    ];

    if (taskUpdates.length > 0) {
      batchUpdateTasksMutation.mutate(taskUpdates);
    }

    // Persist linked module changes
    const currentModules = project?.projectModules || [];
    const previousLinkedModuleIds = currentModules
      .filter(m => m.milestoneId === updatedMilestone.id)
      .map(m => m.id);
    const newLinkedModuleIds = updatedMilestone.linkedModuleIds || [];

    const addedModuleIds = newLinkedModuleIds.filter(id => !previousLinkedModuleIds.includes(id));
    const removedModuleIds = previousLinkedModuleIds.filter(id => !newLinkedModuleIds.includes(id));

    const moduleUpdates = [
      ...addedModuleIds.map(id => ({ id, milestone_id: updatedMilestone.id })),
      ...removedModuleIds.map(id => ({ id, milestone_id: null }))
    ];

    if (moduleUpdates.length > 0) {
      batchUpdateModulesMutation.mutate(moduleUpdates);
    }
  };


  const handleTaskCreate = async (newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, pendingFiles?: File[]) => {
    const created = await createTaskMutation.mutateAsync(newTask);
    if (pendingFiles && pendingFiles.length > 0 && created?.id) {
      try {
        await Promise.all(
          pendingFiles.map(file =>
            attachmentsService.upload({
              entityId: created.id,
              entityType: 'task',
              projectId: id!,
              file,
            })
          )
        );
      } catch {
        toast.warning('Task created but some attachments failed to upload');
      }
    }
  };

  const handleTaskUpdate = async (updatedTask: Task, onError?: () => void) => {
    try {
      await updateTaskMutation.mutateAsync({
        taskId: updatedTask.id,
        updates: updatedTask,
      });
    } catch (error) {
      if (onError) onError();
      throw error;
    }
  };

  const handleTaskDelete = (taskId: string) => {
    deleteTaskMutation.mutate(taskId);
  };

  const handleBatchTaskUpdate = async (updates: Array<{ id: string; updates: Partial<Task> }>) => {
    await batchUpdateTasksMutation.mutateAsync(updates);
  };

  const handleModuleDelete = (moduleId: string) => {
    deleteModuleMutation.mutate(moduleId);
  };

  const handleMilestoneDelete = (milestoneId: string) => {
    deleteMilestoneMutation.mutate(milestoneId);
  };

  const handleIssueDelete = (issueId: string) => {
    deleteIssueMutation.mutate(issueId);
  };

  // Loading state
  if (isLoading) {
    return (
      <>
        <ProjectDetailSkeleton />
      </>
    );
  }

  // Error or not found state
  if (error || !project) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <h2 className="text-xl font-medium">Project not found</h2>
          <p className="text-muted-foreground mt-2">
            {error ? 'An error occurred while loading the project.' : 'The project you are looking for does not exist.'}
          </p>
          <Button asChild className="mt-4">
            <Link to="/projects">Back to Projects</Link>
          </Button>
        </div>
      </>
    );
  }

  const openIssuesCount = project.issues?.filter(i => i.status !== 'resolved' && i.status !== 'wont-fix').length || 0;
  const criticalIssuesCount = project.issues?.filter(i => i.severity === 'critical' && i.status !== 'resolved' && i.status !== 'wont-fix').length || 0;

  const tabBadges: Partial<Record<ProjectTabId, { count: number; variant: 'secondary' | 'destructive' }>> = {
    tasks: { count: (project.tasks || []).length, variant: 'secondary' },
    modules: { count: modules.length, variant: 'secondary' },
    milestones: { count: (project.milestones || []).length, variant: 'secondary' },
    ...(openIssuesCount > 0
      ? { issues: { count: openIssuesCount, variant: criticalIssuesCount > 0 ? 'destructive' : 'secondary' } }
      : {}),
  };
  const TAB_GRID_COLS_CLASS: Record<number, string> = {
    1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3',
    4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6',
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-6 animate-fade-in w-full min-w-0">

        {/* Section Tabs - Entity-based navigation */}
        <Tabs value={section} onValueChange={(v) => navigate(`/projects/${id}/${v}`)} className="w-full">
          <div className="sticky top-0 z-20 bg-background">
          {!partId && !ecoId && !isMobileModuleDetailOpen && (
            <div className="flex flex-row md:items-center justify-between gap-2 w-full pb-1">
              {/* Left Side: Tabs */}
              <div className="flex-1 md:flex-none w-full md:w-auto py-1 min-w-0 md:mr-auto overflow-x-auto hide-scrollbar">
                <TabsList
                  className={`bg-muted/50 grid ${TAB_GRID_COLS_CLASS[visibleTabs.length] || 'grid-cols-6'} min-w-[300px] md:min-w-0 w-full h-11 md:w-auto md:flex md:shrink-0`}
                >
                  {visibleTabs.map(({ id: tabId, label, title, icon: Icon }) => {
                    const badge = tabBadges[tabId];
                    return (
                      <TabsTrigger
                        key={tabId}
                        value={tabId}
                        className="relative gap-1 sm:gap-2 px-2 justify-center min-w-0"
                        title={title}
                        onTouchStart={() => handleTabLongPressStart(tabId)}
                        onTouchEnd={handleTabLongPressEnd}
                        onTouchCancel={handleTabLongPressEnd}
                        onTouchMove={handleTabLongPressEnd}
                      >
                        <Icon className="h-5 w-5 md:h-4 md:w-4 shrink-0" />
                        {!isMobile && <span className="truncate">{label}</span>}
                        {!isMobile && badge && (
                          <Badge variant={badge.variant} className="ml-1 h-5 px-1.5 text-[10px] shrink-0">
                            {badge.count}
                          </Badge>
                        )}
                        {isMobile && longPressedTab === tabId && (
                          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-md">
                            {label}
                          </span>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* Right Side: Team + Chat + Add Button */}
              <div className="flex items-center gap-2 shrink-0 justify-end md:w-auto">
                {!isMobile && <ProjectProgressPopover breakdown={progressBreakdown} />}
                {/* Start Chat */}
                <Button
                  type="button"
                  variant={isChatPanelOpen ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9 gap-1.5 whitespace-nowrap rounded-lg hidden sm:flex"
                  onClick={handleStartProjectChat}
                  disabled={isStartingChat || !canStartProjectChat}
                >
                  {isStartingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  <span className="hidden md:inline">Chat</span>
                </Button>
                {/* Team Popover */}
                <div className="hidden md:block">
                  <ProjectTeamButton projectId={id!} />
                </div>
                {/* Critical Issues Badge */}
                {/* {criticalIssuesCount > 0 && (
                <Badge variant="destructive" className="gap-1 shrink-0 hidden sm:inline-flex">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {criticalIssuesCount} Critical
                </Badge>
              )} */}
                {/* Section Add/Action Buttons — on mobile these move down next to each
                    section's search bar instead (see the "Second Row" block below),
                    so the tab strip doesn't end in a floating "+" square. */}
                {section === 'tasks' && !isMobile && (
                  <Button
                    size="sm"
                    onClick={() => setIsAddTaskDialogOpen(true)}
                    className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-0 w-9 sm:w-auto sm:px-3 rounded-lg"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Create Task</span>
                  </Button>
                )}
                {section === 'modules' && canAddModulesAndMilestones && !isMobile && (
                  <Button size="sm" className="gap-2 shrink-0 px-2 md:px-3" onClick={handleAddModule}>
                    <Plus className="h-4 w-4" />
                    <span className="hidden md:inline">Add Module</span>
                  </Button>
                )}
                {section === 'milestones' && canAddModulesAndMilestones && !isMobile && (
                  <Button size="sm" className="gap-2 shrink-0 px-2 md:px-3" onClick={() => setIsAddMilestoneDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    <span className="hidden md:inline">Add Milestone</span>
                  </Button>
                )}
                {section === 'issues' && !isMobile && (
                  <>
                    {id && <SupportLinksSheet projectId={id} />}
                    <Button size="sm" className="gap-2 shrink-0 px-2 md:px-3" onClick={() => setIsAddIssueDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                      <span className="hidden md:inline">Report Issue</span>
                    </Button>
                  </>
                )}
                {section === 'bom' && !isMobile && (
                  <Button size="sm" onClick={() => setBomAddOpen(true)} className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-0 w-9 sm:w-auto sm:px-3 rounded-lg">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Part</span>
                  </Button>
                )}
                {section === 'eng-changes' && !isMobile && (
                  <Button size="sm" onClick={() => setEcoNewOpen(true)} className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-0 w-9 sm:w-auto sm:px-3 rounded-lg">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">New ECO</span>
                  </Button>
                )}
                {section === 'gate-reviews' && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 shrink-0 h-9">
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Export</span>
                    </Button>
                    <Button size="sm" className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-0 w-9 sm:w-auto sm:px-3 rounded-lg">
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Add Gate</span>
                    </Button>
                  </div>
                )}
                {section === 'risk' && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 shrink-0 h-9">
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Export</span>
                    </Button>
                    <Button size="sm" className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-0 w-9 sm:w-auto sm:px-3 rounded-lg">
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Add Risk</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Second Row: Search + View Toggle + Filter toolbar (below tabs, like BOM UI) */}
          {(section === 'tasks' || section === 'modules' || section === 'milestones' || section === 'issues') && !isMobileModuleDetailOpen && (
            <div className="flex items-center justify-between gap-3 mt-3 pb-3 border-b w-full">
              {section === 'tasks' && (
                <>
                  {/* Left: Search */}
                  <div className="relative flex items-center flex-1 min-w-0 max-w-xs">
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Search tasks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-9 h-9 w-full bg-background rounded-lg"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 h-9 w-9 text-foreground hover:opacity-70"
                        onClick={() => setSearchQuery('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {/* Right: View toggle + Filter */}
                  <div className="flex items-center gap-2 shrink-0">
                    <ViewControls
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                    />
                    <TaskFiltersDropdown
                      milestones={project.milestones || []}
                      modules={modules.map(m => ({ id: m.id, name: m.name, type: m.type }))}
                      teamMembers={teamMembers}
                      allTags={allTags}
                      filters={filters}
                      onFiltersChange={setFilters}
                      activeFilterCount={activeFilterCount}
                      statusOptions={filterStatusOptions}
                    />
                    {isMobile && (
                      <button
                        type="button"
                        onClick={() => setIsAddTaskDialogOpen(true)}
                        aria-label="Create Task"
                        className="w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0 active:opacity-90 transition-opacity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </>
              )}
              {section === 'modules' && (
                <>
                  {/* Left: Search */}
                  <div className="relative flex items-center flex-1 min-w-0 max-w-none md:max-w-xs">
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Search modules..."
                      value={moduleSearchQuery}
                      onChange={(e) => setModuleSearchQuery(e.target.value)}
                      className="pl-9 pr-9 h-9 w-full bg-background rounded-full md:rounded-lg"
                    />
                    {moduleSearchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 h-9 w-9 text-foreground hover:opacity-70"
                        onClick={() => setModuleSearchQuery('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {/* Right: View toggle (desktop/tablet only — mobile always uses the card view) */}
                  <div className="hidden md:flex items-center gap-2 shrink-0">
                    <ModuleViewControls
                      viewMode={moduleViewMode}
                      onViewModeChange={setModuleViewMode}
                    />
                  </div>
                  {isMobile && canAddModulesAndMilestones && (
                    <button
                      type="button"
                      onClick={handleAddModule}
                      aria-label="Add Module"
                      className="w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0 active:opacity-90 transition-opacity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
              {section === 'milestones' && (
                <>
                  {/* Left: Search */}
                  <div className="relative flex items-center flex-1 min-w-0 max-w-xs">
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Search milestones..."
                      value={milestoneSearchQuery}
                      onChange={(e) => setMilestoneSearchQuery(e.target.value)}
                      className="pl-9 pr-9 h-9 w-full bg-background rounded-lg"
                    />
                    {milestoneSearchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 h-9 w-9 text-foreground hover:opacity-70"
                        onClick={() => setMilestoneSearchQuery('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {/* Right: View toggle */}
                  <div className="flex items-center gap-2 shrink-0">
                    <MilestoneViewControls
                      viewMode={milestoneViewMode}
                      onViewModeChange={setMilestoneViewMode}
                    />
                    {isMobile && canAddModulesAndMilestones && (
                      <button
                        type="button"
                        onClick={() => setIsAddMilestoneDialogOpen(true)}
                        aria-label="Add Milestone"
                        className="w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0 active:opacity-90 transition-opacity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </>
              )}
              {section === 'issues' && (
                <>
                  {/* Left: Search */}
                  <div className="relative flex items-center flex-1 min-w-0 max-w-xs">
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Search issues..."
                      value={issueSearchQuery}
                      onChange={(e) => setIssueSearchQuery(e.target.value)}
                      className="pl-9 pr-9 h-9 w-full bg-background rounded-lg"
                    />
                    {issueSearchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 h-9 w-9 text-foreground hover:opacity-70"
                        onClick={() => setIssueSearchQuery('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {/* Right: View toggle + Filter */}
                  <div className="flex items-center gap-2 shrink-0">
                    <IssueViewControls
                      viewMode={issueViewMode}
                      onViewModeChange={setIssueViewMode}
                      filters={issueFilters}
                      onFiltersChange={setIssueFilters}
                      teamMembers={projectMembers}
                      issueColumns={issueColumns}
                      allTags={allIssueTags}
                      activeFilterCount={activeIssueFilterCount}
                      onClearFilters={clearIssueFilters}
                    />
                    {isMobile && id && <SupportLinksSheet projectId={id} iconOnly />}
                    {isMobile && (
                      <button
                        type="button"
                        onClick={() => setIsAddIssueDialogOpen(true)}
                        aria-label="Report Issue"
                        className="w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0 active:opacity-90 transition-opacity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          </div>

          <TabsContent value="tasks" className="mt-6">
            <TasksSection
              tasks={filteredTasks}
              allTasks={project.tasks || []}
              projectId={project.id}
              milestones={project.milestones || []}
              issues={project.issues || []}
              modules={modules.map(m => ({ id: m.id, name: m.name, type: m.type }))}
              assignableMembers={projectMembers}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              filters={filters}
              onFiltersChange={setFilters}
              onTaskCreate={handleTaskCreate}
              onTaskUpdate={handleTaskUpdate}
              onBatchTaskUpdate={handleBatchTaskUpdate}
              onTaskDelete={handleTaskDelete}
              userProjectRole={project?.myRole}
              onAddModule={canAddModulesAndMilestones ? handleAddModule : undefined}
            />
          </TabsContent>
          <TabsContent value="modules" className={isMobileModuleDetailOpen ? '-mx-4' : 'mt-6'}>
            <ModulesSection
              modules={modules}
              tasks={project.tasks || []}
              issues={project.issues || []}
              teamMembers={projectMembers}
              projectId={project.id}
              viewMode={moduleViewMode}
              onViewModeChange={setModuleViewMode}
              searchQuery={moduleSearchQuery}
              isAddDialogOpen={isAddModuleDialogOpen}
              onAddDialogClose={() => setIsAddModuleDialogOpen(false)}
              onModuleAdd={handleModuleAdd}
              onModuleUpdate={handleModuleUpdate}
              onModuleDelete={handleModuleDelete}
              onTaskUpdate={handleTaskUpdate}
              onIssueUpdate={handleIssueUpdate}
              onMobileDetailOpenChange={setIsMobileModuleDetailOpen}
            />
          </TabsContent>
          <TabsContent value="milestones" className="mt-6">
            <MilestonesView
              milestones={project.milestones || []}
              tasks={project.tasks || []}
              issues={project.issues || []}
              modules={modules}
              viewMode={milestoneViewMode}
              projectStartDate={project.startDate ? new Date(project.startDate) : undefined}
              searchQuery={milestoneSearchQuery}
              isAddDialogOpen={isAddMilestoneDialogOpen}
              onAddDialogClose={() => setIsAddMilestoneDialogOpen(false)}
              onMilestoneUpdate={handleMilestoneUpdate}
              onMilestoneCreate={handleMilestoneCreate}
              onMilestoneDelete={handleMilestoneDelete}
              onIssueUpdate={handleIssueUpdate}
            />
          </TabsContent>
          <TabsContent value="issues" className="mt-6">
            <IssuesView
              issues={project.issues || []}
              viewMode={issueViewMode}
              tasks={project.tasks || []}
              teamMembers={projectMembers}
              searchQuery={issueSearchQuery}
              severityFilter={issueFilters.severity}
              statusFilter={issueFilters.status}
              assigneeFilter={issueFilters.assigneeId}
              assignedByFilter={issueFilters.assignedById}
              updatedByFilter={issueFilters.updatedById}
              dueDateFilter={issueFilters.dueDate}
              dueDateCustomFilter={issueFilters.dueDateCustom}
              reportedDateFilter={issueFilters.reportedDate}
              reportedDateCustomFilter={issueFilters.reportedDateCustom}
              tagsFilter={issueFilters.tags}
              isAddDialogOpen={isAddIssueDialogOpen}
              onAddDialogClose={() => setIsAddIssueDialogOpen(false)}
              onIssueCreate={handleIssueCreate}
              onIssueUpdate={handleIssueUpdate}
              onIssueDelete={handleIssueDelete}
              userProjectRole={project?.myRole}
            />
          </TabsContent>
          <TabsContent value="bom" className="mt-0 -mx-4 md:-mx-6 -mb-6 flex flex-col">
            <BOMView
              projectId={project.id}
              orgId={currentOrganization?.id ?? ''}
              addOpen={bomAddOpen}
              onAddClose={() => setBomAddOpen(false)}
              selectedId={partId ?? null}
              onSelectedIdChange={(newId) =>
                navigate(`/projects/${id}/bom${newId ? `/${newId}` : ''}`)
              }
              onEcoCreated={(ecoId) => navigate(`/projects/${id}/eng-changes/${ecoId}`)}
            />
          </TabsContent>
          <TabsContent value="requirements" className="mt-6 -mx-4 md:-mx-6 -mb-6 flex flex-col">
            <RequirementsView />
          </TabsContent>
          <TabsContent value="eng-changes" className="mt-6 -mx-4 md:-mx-6 -mb-6 flex flex-col">
            <ECOView
              projectId={id!}
              projectName={project?.name}
              newTrigger={ecoNewOpen}
              onNewConsumed={() => setEcoNewOpen(false)}
              openEcoId={ecoId ?? null}
              onOpenEcoIdChange={(newId) =>
                navigate(`/projects/${id}/eng-changes${newId ? `/${newId}` : ''}`)
              }
            />
          </TabsContent>
          <TabsContent value="gate-reviews" className="mt-6">
            <GateView />
          </TabsContent>
          <TabsContent value="risk" className="mt-6">
            <RiskView />
          </TabsContent>
        </Tabs>
      </div>

      <AddModuleDialog
        isOpen={isAddModuleDialogOpen}
        onClose={() => setIsAddModuleDialogOpen(false)}
        onAdd={handleModuleAdd}
        teamMembers={projectMembers}
        existingModuleNames={existingModuleNames}
      />

      <TaskDetailModal
        task={null}
        allTasks={project.tasks || []}
        isOpen={isAddTaskDialogOpen}
        onClose={() => setIsAddTaskDialogOpen(false)}
        onUpdate={handleTaskUpdate}
        mode="create"
        onCreate={handleTaskCreate}
        modules={modules}
        milestones={project.milestones || []}
        projectId={id}
        onAddModule={canAddModulesAndMilestones ? handleAddModule : undefined}
        assignableMembers={projectMembers}
        statusOptions={(boardColumns ?? []).map((c) => ({
          value: c.status,
          label: c.label,
          color: c.color,   // hex kept as-is; TaskDetailModal dot uses inline style
        }))}
      />

      {/* Deep-linked entity modals — opened via a route param (e.g. /tasks/:taskId),
          such as when navigating from a chat entity tag. */}
      {taskId && (
        <TaskDetailModal
          task={deepLinkTask}
          allTasks={project.tasks || []}
          isOpen={!!taskId}
          onClose={() => navigate(`/projects/${id}/tasks`)}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
          mode="view"
          modules={modules}
          milestones={project.milestones || []}
          projectId={id}
          onAddModule={canAddModulesAndMilestones ? handleAddModule : undefined}
          assignableMembers={organizationMembers}
          statusOptions={(boardColumns ?? []).map((c) => ({
            value: c.status,
            label: c.label,
            color: c.color,
          }))}
        />
      )}

      {moduleId && (
        <ModuleDetailModal
          module={deepLinkModule}
          allTasks={project.tasks || []}
          allIssues={project.issues || []}
          teamMembers={organizationMembers}
          isOpen={!!moduleId}
          onClose={() => navigate(`/projects/${id}/modules`)}
          onUpdate={handleModuleUpdate}
        />
      )}

      {milestoneId && (
        <MilestoneDetailModal
          milestone={deepLinkMilestone}
          tasks={project.tasks || []}
          issues={project.issues || []}
          modules={modules}
          isOpen={!!milestoneId}
          onClose={() => navigate(`/projects/${id}/milestones`)}
          onUpdate={handleMilestoneUpdate}
          onIssueUpdate={handleIssueUpdate}
        />
      )}

      {issueId && (
        <IssueDetailModal
          issue={deepLinkIssue}
          tasks={project.tasks || []}
          teamMembers={projectMembers}
          isOpen={!!issueId}
          onClose={() => navigate(`/projects/${id}/issues`)}
          onUpdate={handleIssueUpdate}
          onDelete={handleIssueDelete}
          userProjectRole={project?.myRole}
          mode="view"
        />
      )}

      <Dialog
        open={memberRemovalPrompt.open}
        onOpenChange={(open) => {
          if (!open && !isRemovingMemberRef.current) {
            setMemberRemovalPrompt(DEFAULT_MEMBER_REMOVAL_PROMPT);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member from project?</DialogTitle>
            <DialogDescription>
              {memberRemovalPrompt.memberName
                ? `${memberRemovalPrompt.memberName} will be removed from this project. Should they also be removed from the project group chat, or kept in that chat?`
                : 'This person will be removed from the project. Should they also be removed from the project group chat, or kept in that chat?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMemberRemovalPrompt(DEFAULT_MEMBER_REMOVAL_PROMPT)}
              disabled={isRemovingMember}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleRemoveProjectMember(false)}
              disabled={isRemovingMember}
            >
              No, keep in chat
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleRemoveProjectMember(true)}
              disabled={isRemovingMember}
            >
              {isRemovingMember ? 'Removing...' : 'Yes, remove from chat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectChatPanel
        open={isChatPanelOpen}
        onOpenChange={setIsChatPanelOpen}
        conversationId={projectChatConversationId}
      />
    </>
  );
}
