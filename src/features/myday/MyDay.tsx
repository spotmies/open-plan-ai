import { useState, useMemo, useEffect } from 'react';
// import { LayoutGrid, List } from 'lucide-react'; // Kanban view hidden — re-enable if Kanban toggle is restored
import { MyDayStats } from './components/MyDayStats';
// import { MyDayKanbanView } from './components/MyDayKanbanView'; // Kanban view hidden
import { MyDayListView } from './components/MyDayListView';
import { MyDayGroupBySelector } from './components/MyDayGroupBySelector';
import { MyTasksFiltersDropdown } from './components/MyTasksFiltersDropdown';
import { TaskDetailModal } from '@/features/projects/components/TaskDetailModal';
import { IssueDetailModal } from '@/features/projects/components/IssueDetailModal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';
import { categorizeMyDayItems, MyDayItem } from './utils/myDayUtils';
import { Task, Issue, TaskStatus, IssueStatus, MyDayGroupBy, MyDayFilter, MyTasksColumnFilters } from '@/types';
import { useMyDayTasks, useCompletedTodayCount } from '@/hooks/useMyDayTasks';
import { useUpdateTask, useBatchUpdateTasks } from '@/hooks/useTasks';
import { useUpdateIssue } from '@/hooks/useIssues';
import { useProjects } from '@/hooks/useProjects';
import { useProjectMembers } from '@/hooks/useProjectTeam';
import { toast } from 'sonner';
import { logger } from '@/services/monitoring/logger';

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
  const [columnFilters, setColumnFilters] = useState<MyTasksColumnFilters>({});

  // Fetch dynamic data
  const { data: userTasks = [], isLoading: tasksLoading } = useMyDayTasks(filter);
  const { data: overdueTasks = [] } = useMyDayTasks('overdue');
  // Stat tiles reflect the full assigned set, not just the active tab — otherwise
  // e.g. the default "today" tab makes every surviving item `isDueToday`, which the
  // categorizer treats as "needs attention", so "Ready to Work" could never be > 0.
  const { data: allDayItems = [] } = useMyDayTasks('all');
  const { data: completedTodayCount = 0 } = useCompletedTodayCount();
  const { data: projects = [] } = useProjects();
  const updateTaskMutation = useUpdateTask();
  const batchUpdateTasksMutation = useBatchUpdateTasks();
  const updateIssueMutation = useUpdateIssue();

  const allTasks = useMemo(() => {
    return projects.flatMap(p => p.tasks || []);
  }, [projects]);

  // Column filters (type/status/priority/project) apply on top of the date filter
  const filteredTasks = useMemo(() => {
    return userTasks.filter((item) => {
      if (columnFilters.type?.length && !columnFilters.type.includes(item.itemType)) return false;
      if (columnFilters.status?.length && !columnFilters.status.includes(item.status)) return false;
      if (columnFilters.priority?.length && (!item.priority || !columnFilters.priority.includes(item.priority))) return false;
      if (columnFilters.projectIds?.length && !columnFilters.projectIds.includes(item.projectId)) return false;
      return true;
    });
  }, [userTasks, columnFilters]);

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

  // Kanban view hidden — handleChecklistToggle was only used by MyDayKanbanView
  // const handleChecklistToggle = async (taskId: string, itemId: string) => {
  //   const item = userTasks.find(t => t.id === taskId);
  //   if (!item) return;
  //
  //   try {
  //     const checklist = item.itemType === 'task' ? item.originalTask?.checklist : item.originalIssue?.checklist;
  //     if (!checklist) return;
  //
  //     const updatedChecklist = checklist.map(checklistItem =>
  //       checklistItem.id === itemId ? { ...checklistItem, completed: !checklistItem.completed } : checklistItem
  //     );
  //
  //     if (item.itemType === 'task') {
  //       await updateTaskMutation.mutateAsync({
  //         projectId: item.projectId,
  //         taskId,
  //         updates: { checklist: updatedChecklist },
  //       });
  //     } else {
  //       await updateIssueMutation.mutateAsync({
  //         projectId: item.projectId,
  //         issueId: taskId,
  //         updates: { checklist: updatedChecklist },
  //       });
  //     }
  //   } catch (error) {
  //     logger.error('Failed to toggle checklist item:', error);
  //     toast.error('Failed to update checklist');
  //   }
  // };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
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
  const activeProjectId = selectedTask?.projectId ?? selectedIssue?.projectId;
  const { data: activeProjectMembers = [] } = useProjectMembers(activeProjectId);

  // Early return: show identical skeleton to Suspense fallback while data loads
  if (tasksLoading) {
    return <AppLayoutSkeleton variant="list" />;
  }

  return (
    <>
      <div className="grid grid-cols-1 w-full min-w-0">
        {/* Stats - always visible once data is ready */}
        <MyDayStats
          attentionCount={needsAttention.length}
          readyCount={readyToWork.length}
          blockedCount={waitingBlocked.length}
          completedTodayCount={completedTodayCount}
        />

       {/* View controls - always visible once data is ready */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as MyDayFilter)}>
            <TabsList>
              <TabsTrigger value="today">My Day</TabsTrigger>
              <TabsTrigger value="overdue" className="relative">
                Overdue
                {overdueTasks.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground leading-none">
                    {overdueTasks.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>

          <MyTasksFiltersDropdown
            items={userTasks}
            filters={columnFilters}
            onFiltersChange={setColumnFilters}
          />

          {/* <Tabs value={view} onValueChange={(v) => setView(v as MyDayView)}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs> */}
        </div>

        {/* List content */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-lg font-medium text-foreground mb-2">
              {userTasks.length > 0
                ? 'No matching tasks'
                : filter === 'overdue' ? 'No overdue tasks' : filter === 'today' ? 'Nothing due today' : 'All caught up!'}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {userTasks.length > 0
                ? 'No tasks or issues match the selected filters. Try clearing a filter.'
                : filter === 'overdue'
                  ? "You're all caught up — nothing assigned to you is overdue."
                  : filter === 'today'
                    ? 'No tasks or issues assigned to you are due today.'
                    : 'You have no active tasks assigned to you. Check the Projects page to see available work.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 w-full min-w-0">
            <div className="min-h-[400px] w-full min-w-0">
              {/* Kanban view hidden
              {view === 'kanban' ? (
                <MyDayKanbanView
                  tasks={filteredTasks}
                  groupBy={groupBy}
                  onTaskClick={handleTaskClick}
                  onStatusUpdate={handleStatusUpdate}
                  onChecklistToggle={handleChecklistToggle}
                />
              ) : (
              */}
              <MyDayListView
                tasks={filteredTasks}
                groupBy={groupBy}
                onTaskClick={handleTaskClick}
                onStatusUpdate={handleStatusUpdate}
              />
              {/* )} */}
            </div>
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          allTasks={allTasks}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          assignableMembers={activeProjectMembers}
          projectName={selectedTaskProject?.name}
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
          isOpen={isIssueModalOpen}
          onClose={handleCloseIssueModal}
          onUpdate={handleIssueUpdate}
        />
      )}
    </>
  );
}
