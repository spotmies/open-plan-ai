import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { Plus, LayoutGrid, List, Search } from 'lucide-react';
import { MyDayStats } from './components/MyDayStats';
import { MyDayKanbanView } from './components/MyDayKanbanView';
import { MyDayListView } from './components/MyDayListView';
import { MyDayGroupBySelector } from './components/MyDayGroupBySelector';
import { MyTasksFiltersDropdown } from './components/MyTasksFiltersDropdown';
import { TaskDetailModal } from '@/features/projects/components/TaskDetailModal';
import { IssueDetailModal } from '@/features/projects/components/IssueDetailModal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';
import { categorizeMyDayItems, getCompletedDate, getItemTags, getReportedDate, MyDayItem } from './utils/myDayUtils';
import { Task, Issue, TaskStatus, IssueStatus, MyDayGroupBy, MyDayFilter, MyTasksColumnFilters } from '@/types';
import { useMyDayTasks, useCompletedTodayCount } from '@/hooks/useMyDayTasks';
import { useUpdateTask, useBatchUpdateTasks, useCreatePersonalTask, useDeleteTask } from '@/hooks/useTasks';
import { useUpdateIssue } from '@/hooks/useIssues';
import { useProjects } from '@/hooks/useProjects';
import { useProjectMembers } from '@/hooks/useProjectTeam';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { attachmentsService } from '@/services/attachments.service';
import { commentsService } from '@/services/comments.service';
import { toast } from 'sonner';
import { logger } from '@/services/monitoring/logger';

// Personal (no-project) tasks only accept this fixed status set — mirrors
// MY_DAY_STANDARD_STATUSES in the backend (tasks.service.ts), since there's
// no project task_columns to offer a custom status from.
const PERSONAL_TASK_STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do', color: 'bg-[#3b82f6]' },
  { value: 'in-progress', label: 'In Progress', color: 'bg-[#f59e0b]' },
  { value: 'blocked', label: 'Blocked', color: 'bg-[#ef4444]' },
  { value: 'done', label: 'Done', color: 'bg-[#10b981]' },
];

export default function MyDay() {
  useEffect(() => {
    document.title = 'My Tasks | Open Plan AI';
    return () => { document.title = 'Open Plan AI'; };
  }, []);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<MyDayGroupBy>('progress');
  const [filter, setFilter] = useState<MyDayFilter>('today');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [columnFilters, setColumnFilters] = useState<MyTasksColumnFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  // Height of the sticky stats + tabs bar, measured so the table header below
  // it can stick at the right offset instead of overlapping it.
  const topBarRef = useRef<HTMLDivElement>(null);
  const [topBarHeight, setTopBarHeight] = useState(0);
  useLayoutEffect(() => {
    const el = topBarRef.current;
    if (!el) return;
    const updateHeight = () => setTopBarHeight(el.getBoundingClientRect().height);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch dynamic data
  const { data: userTasks = [], isLoading: tasksLoading } = useMyDayTasks(filter, columnFilters.status);
  const { data: overdueTasks = [] } = useMyDayTasks('overdue');
  const { data: todayTasks = [] } = useMyDayTasks('today');
  const todayActiveCount = todayTasks.length;
  // Stat tiles reflect the full assigned set, not just the active tab — otherwise
  // e.g. the default "today" tab makes every surviving item `isDueToday`, which the
  // categorizer treats as "needs attention", so "Ready to Work" could never be > 0.
  const { data: allDayItems = [] } = useMyDayTasks('all');
  const { data: completedTodayCount = 0 } = useCompletedTodayCount();
  const { data: projects = [] } = useProjects();
  const { user: profile } = useAuth();
  const { currentOrganization } = useOrganization();
  const updateTaskMutation = useUpdateTask();
  const batchUpdateTasksMutation = useBatchUpdateTasks();
  const updateIssueMutation = useUpdateIssue();
  const createPersonalTaskMutation = useCreatePersonalTask();
  const deleteTaskMutation = useDeleteTask();

  // The assignee picker for a personal task only ever offers the current
  // user — personal tasks are private to their creator, who is always the
  // sole assignee (enforced server-side regardless of what's picked here).
  const selfAsAssignableMember = useMemo(() => {
    if (!profile) return [];
    return [{
      id: profile.id,
      name: profile.name || profile.email,
      email: profile.email,
      role: 'member',
      initials: profile.initials || (profile.name || profile.email || '?').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
      avatar: profile.avatarUrl || '',
    }];
  }, [profile]);

  const allTasks = useMemo(() => {
    return projects.flatMap(p => p.tasks || []);
  }, [projects]);

  // Column filters (type/status/priority/project/assignedBy/dueDate/tags/reportedDate/completedDate) apply on top of the date filter
  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return userTasks.filter((item) => {
      if (query) {
        const haystack = [
          item.title,
          item.description,
          item.projectName,
          ...item.assignees.map((a) => a.name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (columnFilters.type?.length && !columnFilters.type.includes(item.itemType)) return false;
      if (columnFilters.status?.length && !columnFilters.status.includes(item.status)) return false;
      if (columnFilters.priority?.length && (!item.priority || !columnFilters.priority.includes(item.priority))) return false;
      if (columnFilters.projectIds?.length && !columnFilters.projectIds.includes(item.projectId)) return false;
      if (columnFilters.assignedByIds?.length) {
        const assignedById = item.itemType === 'task' ? item.originalTask?.createdBy?.id : item.originalIssue?.reportedBy?.id;
        if (!assignedById || !columnFilters.assignedByIds.includes(assignedById)) return false;
      }
      if (columnFilters.dueDateCustom) {
        if (!item.dueDate || new Date(item.dueDate).toDateString() !== new Date(columnFilters.dueDateCustom).toDateString()) return false;
      } else if (columnFilters.dueDate) {
        if (columnFilters.dueDate === 'overdue' && !item.isOverdue) return false;
        if (columnFilters.dueDate === 'today' && !item.isDueToday) return false;
        if (columnFilters.dueDate === 'no-date' && item.dueDate) return false;
        if (columnFilters.dueDate === 'upcoming' && (!item.dueDate || item.isOverdue || item.isDueToday)) return false;
      }
      if (columnFilters.tags?.length) {
        const itemTags = getItemTags(item);
        if (!itemTags.some((tag) => columnFilters.tags!.includes(tag))) return false;
      }
      if (columnFilters.reportedDateCustom) {
        const reportedDate = getReportedDate(item);
        if (!reportedDate || new Date(reportedDate).toDateString() !== new Date(columnFilters.reportedDateCustom).toDateString()) return false;
      }
      if (columnFilters.completedDateCustom) {
        const completedDate = getCompletedDate(item);
        if (!completedDate || new Date(completedDate).toDateString() !== new Date(columnFilters.completedDateCustom).toDateString()) return false;
      }
      return true;
    });
  }, [userTasks, columnFilters, searchQuery]);

  const { needsAttention, readyToWork, waitingBlocked } = useMemo(() => {
    return categorizeMyDayItems(allDayItems);
  }, [allDayItems]);

  const handleTaskClick = (item: MyDayItem) => {
    // Only open modal for tasks (issues have their own modal)
    if (item.itemType === 'task' && item.originalTask) {
      setSelectedTask(item.originalTask);
      setIsModalOpen(true);
    } else if (item.itemType === 'issue' && item.originalIssue) {
      setSelectedIssue(item.originalIssue);
      setIsIssueModalOpen(true);
    }
  };

  const handleStatusUpdate = async (taskId: string, status: TaskStatus) => {
    const item = userTasks.find(t => t.id === taskId);
    if (!item) return;

    try {
      if (item.itemType === 'task') {
        await updateTaskMutation.mutateAsync({
          projectId: item.projectId,
          taskId,
          updates: { status },
        });
      } else {
        // 'review' has no meaningful IssueStatus equivalent, so it is not
        // a valid drop target for issue cards. Only map statuses that have
        // a clear 1-to-1 IssueStatus counterpart.
        const issueStatusMap: Partial<Record<TaskStatus, IssueStatus>> = {
          'todo': 'open',
          'in-progress': 'in-progress',
          'done': 'resolved',
          'blocked': 'in-progress',
          // 'review' intentionally omitted — no equivalent IssueStatus exists.
        };
        const mappedStatus = issueStatusMap[status];
        if (!mappedStatus) {
          toast.error(`Cannot set an issue to "${status}" status.`);
          return;
        }
        await updateIssueMutation.mutateAsync({
          projectId: item.projectId,
          issueId: taskId,
          updates: { status: mappedStatus },
        });
      }
      toast.success(`${item.itemType === 'task' ? 'Task' : 'Issue'} status updated`);
    } catch (error) {
      logger.error(`Failed to update ${item.itemType} status:`, error);
      toast.error(`Failed to update ${item.itemType} status`);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const handleCloseAddTaskModal = () => {
    setIsAddTaskOpen(false);
  };

  const handleTaskCreate = async (newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, pendingFiles?: File[]) => {
    if (!currentOrganization) return;
    try {
      const created = await createPersonalTaskMutation.mutateAsync({ organizationId: currentOrganization.id, task: newTask });
      if (pendingFiles && pendingFiles.length > 0 && created?.id) {
        try {
          await Promise.all(
            pendingFiles.map(file =>
              attachmentsService.upload({
                entityId: created.id,
                entityType: 'task',
                file,
              })
            )
          );
        } catch {
          toast.warning('Task created but some attachments failed to upload');
        }
      }
      if (newTask.comments && newTask.comments.length > 0 && created?.id) {
        try {
          await Promise.all(
            newTask.comments.map(comment =>
              commentsService.create({
                content: comment.content,
                entity_id: created.id,
                entity_type: 'task',
              })
            )
          );
        } catch {
          toast.warning('Task created but some comments failed to save');
        }
      }
      toast.success('Task created');
    } catch (error) {
      logger.error('Failed to create task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create task');
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    const item = userTasks.find(t => t.id === taskId) ?? allDayItems.find(t => t.id === taskId);
    // Personal (no-project) tasks carry projectId === '' — only bail if the
    // task itself couldn't be resolved, not on a falsy-but-valid projectId.
    if (!item && selectedTask?.id !== taskId) return;
    const projectId = item?.projectId ?? selectedTask?.projectId ?? '';
    try {
      await deleteTaskMutation.mutateAsync({ projectId, taskId });
      toast.success('Task deleted');
    } catch (error) {
      logger.error('Failed to delete task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete task');
    }
  };

  const handleCloseIssueModal = () => {
    setIsIssueModalOpen(false);
    setSelectedIssue(null);
  };

  const handleIssueUpdate = async (updatedIssue: Issue) => {
    try {
      await updateIssueMutation.mutateAsync({
        projectId: updatedIssue.projectId,
        issueId: updatedIssue.id,
        updates: updatedIssue,
      });
      toast.success('Issue updated');
      // No need to close modal here as IssueDetailModal handles its own state or we might want to keep it open? 
      // Usually IssueDetailModal calls onUpdate. 
      // If we want to behave like TaskDetailModal, we just update.
    } catch (error) {
      logger.error('Failed to update issue:', error);
      toast.error('Failed to update issue');
    }
  };

  // derived data for the open task/issue modal
  const selectedIssueProject = selectedIssue ? projects.find(p => p.id === selectedIssue.projectId) : null;
  const selectedTaskProject = selectedTask ? projects.find(p => p.id === selectedTask.projectId) : null;
  const issueTasks = selectedIssueProject?.tasks || [];

  // My Day aggregates items across projects, so `project.team` (unpopulated for
  // API-backed projects) can't be used for the assignee picker — fetch the real
  // membership list for whichever project the open task/issue belongs to.
  // A personal task (no project) has no membership list to fetch — undefined
  // leaves `activeProjectMembers` empty, which is fine since it isn't used
  // for personal tasks (see selfAsAssignableMember).
  const activeProjectId = selectedTask?.projectId ?? selectedIssue?.projectId ?? undefined;
  const { data: activeProjectMembers = [] } = useProjectMembers(activeProjectId);

  // Early return: show identical skeleton to Suspense fallback while data loads
  if (tasksLoading) {
    return <AppLayoutSkeleton variant="list" />;
  }

  return (
    <>
      <div className="flex flex-col h-full min-h-0 w-full min-w-0 p-4 gap-4 overflow-hidden">
        {/* Top Header: Stats + View controls */}
        <div className="shrink-0 space-y-4">
          {/* Stats - always visible once data is ready */}
          <MyDayStats
            attentionCount={needsAttention.length}
            readyCount={readyToWork.length}
            blockedCount={waitingBlocked.length}
            completedTodayCount={completedTodayCount}
          />

          {/* View controls */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as MyDayFilter)} className="shrink-0">
              <TabsList className="h-9 p-1 shrink-0 gap-1 sm:gap-2">
                <TabsTrigger value="today" className="px-3 sm:px-4 text-xs sm:text-sm shrink-0 gap-1.5">
                  <span>My Day</span>
                  {todayActiveCount > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground leading-none shadow-xs">
                      {todayActiveCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="overdue" className="px-3 sm:px-4 text-xs sm:text-sm shrink-0 gap-1.5">
                  <span>Overdue</span>
                  {overdueTasks.length > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground leading-none shadow-xs">
                      {overdueTasks.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="all" className="px-3 sm:px-4 text-xs sm:text-sm shrink-0">All</TabsTrigger>
                <TabsTrigger value="completed" className="px-3 sm:px-4 text-xs sm:text-sm shrink-0">Completed</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="relative shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-[180px] sm:w-[300px] md:w-[360px] pl-8 text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center rounded-lg border p-0.5 h-9 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={view === 'list' ? 'secondary' : 'ghost'}
                      className="h-8 px-2 rounded-md"
                      onClick={() => setView('list')}
                      aria-label="List view"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">List View</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={view === 'kanban' ? 'secondary' : 'ghost'}
                      className="h-8 px-2 rounded-md"
                      onClick={() => setView('kanban')}
                      aria-label="Kanban view"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Kanban View</TooltipContent>
                </Tooltip>
              </div>

              <MyTasksFiltersDropdown
                items={userTasks}
                filters={columnFilters}
                onFiltersChange={setColumnFilters}
                className="order-2 sm:order-1"
              />

              <Button
                size="sm"
                className="gap-1 h-9 rounded-lg px-2.5 sm:px-3 text-xs sm:text-sm order-1 sm:order-2"
                onClick={() => setIsAddTaskOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add<span className="hidden sm:inline"> Task</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 w-full min-w-0 flex flex-col">
          <div className="h-full min-h-0 w-full min-w-0 flex flex-col flex-1">
            {view === 'kanban' ? (
              <MyDayKanbanView
                tasks={filteredTasks}
                onTaskClick={handleTaskClick}
                onStatusUpdate={handleStatusUpdate}
              />
            ) : (
              <MyDayListView
                tasks={filteredTasks}
                groupBy={groupBy}
                onTaskClick={handleTaskClick}
                onStatusUpdate={handleStatusUpdate}
                emptyMessage={
                  userTasks.length > 0
                    ? 'No tasks or issues match the selected filters. Try clearing a filter.'
                    : filter === 'overdue'
                      ? "You're all caught up — nothing assigned to you is overdue."
                      : filter === 'today'
                        ? 'No tasks or issues assigned to you are due today.'
                        : filter === 'completed'
                          ? "You haven't completed any tasks or issues yet."
                          : 'You have no active tasks assigned to you. Check the Projects page to see available work.'
                }
              />
            )}
          </div>
        </div>
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          allTasks={allTasks}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          assignableMembers={selectedTask.projectId ? activeProjectMembers : selfAsAssignableMember}
          statusOptions={selectedTask.projectId ? undefined : PERSONAL_TASK_STATUS_OPTIONS}
          projectName={selectedTaskProject?.name ?? (selectedTask.projectId ? undefined : 'Personal')}
          projectCode={selectedTaskProject?.code}
          onDelete={handleTaskDelete}
          onUpdate={async (updatedTask) => {
            try {
              const item = userTasks.find(t => t.id === updatedTask.id);
              if (item) {
                await updateTaskMutation.mutateAsync({
                  projectId: item.projectId,
                  taskId: updatedTask.id,
                  updates: updatedTask,
                });
                toast.success('Task updated');
              }
            } catch (error) {
              logger.error('Failed to update task:', error);
              toast.error(error instanceof Error ? error.message : 'Failed to update task');
            }
          }}
          onBatchUpdate={async (updates) => {
            try {
              // Note: useBatchUpdateTasks in useTasks.ts expects {projectId, updates}
              // We'll pick the projectId from the first update (assuming same project for now, 
              // or handle individually if needed, but MyDay has projectId per item)
              if (updates.length === 0) return;
              const firstItem = userTasks.find(t => t.id === updates[0].id);
              if (firstItem) {
                await batchUpdateTasksMutation.mutateAsync({
                  projectId: firstItem.projectId,
                  updates: updates
                });
                toast.success('Dependencies updated');
              }
            } catch (error) {
              logger.error('Failed to batch update tasks:', error);
              toast.error('Failed to update dependent tasks');
            }
          }}
        />
      )}

      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          tasks={issueTasks}
          teamMembers={activeProjectMembers}
          projectName={selectedIssueProject?.name}
          projectCode={selectedIssueProject?.code}
          isOpen={isIssueModalOpen}
          onClose={handleCloseIssueModal}
          onUpdate={handleIssueUpdate}
        />
      )}

      {isAddTaskOpen && (
        <TaskDetailModal
          task={null}
          allTasks={[]}
          isOpen={isAddTaskOpen}
          onClose={handleCloseAddTaskModal}
          onUpdate={() => { }}
          mode="create"
          onCreate={handleTaskCreate}
          modules={[]}
          milestones={[]}
          assignableMembers={selfAsAssignableMember}
          defaultAssignees={selfAsAssignableMember}
          statusOptions={PERSONAL_TASK_STATUS_OPTIONS}
          projectName="Personal"
        />
      )}
    </>
  );
}
