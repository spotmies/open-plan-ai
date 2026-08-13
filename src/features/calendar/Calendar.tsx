import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarHeader } from './components/CalendarHeader';
import { CalendarFilters } from './components/CalendarFilters';
import { ScheduleMeetDialog } from './components/ScheduleMeetDialog';
import { CalendarMonthView } from './components/CalendarMonthView';
import { CalendarWeekView } from './components/CalendarWeekView';
import { CalendarDayView } from './components/CalendarDayView';
import { MobileCalendar } from './components/MobileCalendar';
import { TaskDetailModal } from '@/features/projects/components/TaskDetailModal';
import { MilestoneDetailModal } from '@/features/projects/components/MilestoneDetailModal';
import { IssueDetailModal } from '@/features/projects/components/IssueDetailModal';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  getMonthDays,
  getWeekDays,
  navigatePrevious,
  navigateNext,
  filterCalendarEvents,
  CalendarEvent,
} from './utils/calendarUtils';
import { CalendarFilter, CalendarViewMode, Task, Milestone, Issue } from '@/types';
import { useProjects } from '@/hooks/useProjects';
import { useAllTasks, useUpdateTask, useBatchUpdateTasks } from '@/hooks/useTasks';
import { useAllIssues, useUpdateIssue } from '@/hooks/useIssues';
import { useAllMilestones, useUpdateMilestone } from '@/hooks/useMilestones';
import { useAllMeetings, Meeting } from '@/hooks/useMeetings';
import { useOrganizationMembers } from '@/hooks/useProjectTeam';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { parse, format as formatDate, isValid } from 'date-fns';
import { toast } from 'sonner';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';
import { logger } from '@/services/monitoring/logger';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';

// Convert a DB milestone row to calendar event
function dbMilestoneToCalendarEvent(m: any, projectName: string): CalendarEvent | null {
  const dateStr = m.due_date;
  if (!dateStr) return null;
  let date: Date;
  try {
    date = parse(dateStr, 'yyyy-MM-dd', new Date());
  } catch {
    return null;
  }
  return {
    id: m.id,
    title: m.name,
    date,
    type: 'milestone',
    projectId: m.project_id,
    projectName,
    completed: m.status === 'completed',
    description: m.description,
  };
}

// Convert a DB task to a calendar event
function taskToCalendarEvent(task: Task, projectName: string): CalendarEvent | null {
  if (!task.dueDate) return null;
  let date: Date;
  try {
    date = parse(task.dueDate, 'yyyy-MM-dd', new Date());
  } catch {
    return null;
  }
  return {
    id: task.id,
    title: task.title,
    date,
    type: 'task',
    projectId: task.projectId || '',
    projectName,
    status: task.status,
    priority: task.priority,
    assignees: task.assignees?.map(a => ({ id: a.id, name: a.name, initials: a.initials })),
    isBlocked: task.status === 'blocked' || (task.blockedBy && task.blockedBy.length > 0),
    startDate: task.startDate ? parse(task.startDate, 'yyyy-MM-dd', new Date()) : undefined,
    description: task.description,
    tags: task.tags,
    createdBy: task.createdBy ? { id: task.createdBy.id, name: task.createdBy.name } : undefined,
  };
}

// Convert a frontend Issue to a calendar event
function issueToCalendarEvent(issue: Issue, projectName: string): CalendarEvent | null {
  if (!issue.dueDate) return null;
  let date: Date;
  try {
    date = parse(issue.dueDate, 'yyyy-MM-dd', new Date());
  } catch {
    return null;
  }
  return {
    id: issue.id,
    title: issue.title,
    date,
    type: 'issue',
    projectId: issue.projectId,
    projectName,
    severity: issue.severity,
    issueStatus: issue.status,
    description: issue.description,
    tags: issue.tags,
    createdBy: issue.reportedBy ? { id: issue.reportedBy.id, name: issue.reportedBy.name } : undefined,
  };
}

// Convert a persisted meeting to a calendar event
function meetingToCalendarEvent(meeting: Meeting): CalendarEvent {
  return {
    id: meeting.id,
    title: meeting.title,
    date: new Date(meeting.startTime),
    endDate: new Date(meeting.endTime),
    type: 'meeting',
    projectId: '',
    projectName: '',
    meetingUri: meeting.meetingUri,
    htmlLink: meeting.htmlLink,
    attendeeEmails: meeting.attendeeEmails,
  };
}

// Convert DB milestone to frontend Milestone shape for the modal
function dbMilestoneToFrontend(m: any): Milestone {
  return {
    id: m.id,
    title: m.name,
    description: m.description,
    date: m.due_date || '',
    completed: m.status === 'completed',
    completedAt: undefined,
    linkedTaskIds: [],
    linkedModuleIds: [],
  };
}

const CalendarPage: React.FC = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();

  // Real data hooks
  const { data: projects = [] } = useProjects();
  const { data: allTasks = [], isLoading: tasksLoading } = useAllTasks();
  const { data: allMilestones = [], isLoading: milestonesLoading } = useAllMilestones();
  const { data: allIssues = [], isLoading: issuesLoading } = useAllIssues();
  const { data: allMeetings = [] } = useAllMeetings();
  const { data: teamMembers = [] } = useOrganizationMembers(currentOrganization?.id);

  // Mutations
  const updateTaskMutation = useUpdateTask();
  const updateMilestoneMutation = useUpdateMilestone();
  const batchUpdateTasksMutation = useBatchUpdateTasks();
  const updateIssueMutation = useUpdateIssue();

  const isLoading = tasksLoading || milestonesLoading || issuesLoading;

  // Derived state from search params
  const validViewModes: CalendarViewMode[] = ['month', 'week', 'day'];
  const viewParam = searchParams.get('view');
  const viewMode: CalendarViewMode =
    viewParam && validViewModes.includes(viewParam as CalendarViewMode)
      ? (viewParam as CalendarViewMode)
      : 'month';
  const dateParam = searchParams.get('date');
  const currentDate = useMemo(() => {
    if (!dateParam) return new Date();
    try {
      const parsed = parse(dateParam, 'yyyy-MM-dd', new Date());
      if (!isValid(parsed)) throw new Error('Invalid date');
      return parsed;
    } catch (e) {
      logger.warn('[Calendar] Invalid date param, using today:', dateParam, e);
      return new Date();
    }
  }, [dateParam]);

  // Selected entities for modals from search params
  const taskId = searchParams.get('task');
  const milestoneId = searchParams.get('milestone');
  const issueId = searchParams.get('issue');

  const selectedTask = useMemo(() => 
    taskId ? allTasks.find(t => t.id === taskId) || null : null
  , [taskId, allTasks]);
  
  const selectedMilestone = useMemo(() => {
    if (!milestoneId) return null;
    const dbM = allMilestones.find((m: any) => m.id === milestoneId);
    return dbM ? dbMilestoneToFrontend(dbM) : null;
  }, [milestoneId, allMilestones]);

  const selectedIssue = useMemo(() => 
    issueId ? allIssues.find(i => i.id === issueId) || null : null
  , [issueId, allIssues]);

  // Filter state remains local as it's complex and might be too long for URL
  const [filters, setFilters] = React.useState<CalendarFilter>({});

  // "Schedule a meet" dialog state
  const [scheduleMeetOpen, setScheduleMeetOpen] = React.useState(false);
  const [scheduleMeetDate, setScheduleMeetDate] = React.useState<Date | undefined>(undefined);

  const handleScheduleMeeting = (date?: Date) => {
    setScheduleMeetDate(date);
    setScheduleMeetOpen(true);
  };

  // Build project map for lookups
  const projectMap = useMemo(
    () => new Map(projects.map(p => [p.id, p.name])),
    [projects]
  );

  // Aggregate all events from real data
  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    // Tasks assigned to the current user only
    allTasks
      .filter(task => task.assignees?.some(a => a.id === user?.id))
      .forEach(task => {
        const projectName = task.projectId ? projectMap.get(task.projectId) || 'Unknown Project' : 'Personal';
        const event = taskToCalendarEvent(task, projectName);
        if (event) events.push(event);
      });

    // Milestones (DB shape) — project-level, not assigned to individuals
    allMilestones.forEach((m: any) => {
      const projectName = projectMap.get(m.project_id) || 'Unknown Project';
      const event = dbMilestoneToCalendarEvent(m, projectName);
      if (event) events.push(event);
    });

    // Issues assigned to the current user only
    allIssues
      .filter(issue => issue.assignees?.some(a => a.id === user?.id))
      .forEach(issue => {
        const projectName = projectMap.get(issue.projectId) || 'Unknown Project';
        const event = issueToCalendarEvent(issue, projectName);
        if (event) events.push(event);
      });

    // Meetings — organized by or inviting the current user (already scoped
    // server-side); no project association.
    allMeetings.forEach((meeting) => {
      events.push(meetingToCalendarEvent(meeting));
    });

    return events;
  }, [allTasks, allMilestones, allIssues, allMeetings, projectMap, user?.id]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return filterCalendarEvents(allEvents, filters);
  }, [allEvents, filters]);

  // Get days for current view
  const days = useMemo(() => {
    if (viewMode === 'month') {
      return getMonthDays(currentDate);
    }
    return getWeekDays(currentDate);
  }, [currentDate, viewMode]);

  // Navigation handlers – safely update query params (handles null/undefined)
  const updateUrlParams = (updates: Record<string, string | null | undefined>, replace = false) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        newParams.delete(key);
      } else {
        newParams.set(key, String(value));
      }
    });
    setSearchParams(newParams, { replace });
  };

  const handleNavigatePrevious = () => {
    const nextDate = navigatePrevious(currentDate, viewMode);
    updateUrlParams({ date: formatDate(nextDate, 'yyyy-MM-dd') }, true);
  };

  const handleNavigateNext = () => {
    const nextDate = navigateNext(currentDate, viewMode);
    updateUrlParams({ date: formatDate(nextDate, 'yyyy-MM-dd') }, true);
  };

  const handleNavigateToday = () => {
    updateUrlParams({ date: formatDate(new Date(), 'yyyy-MM-dd') }, true);
  };

  const setViewMode = (mode: CalendarViewMode) => {
    updateUrlParams({ view: mode }, true);
  };

  // Day click handler - switch to day view
  const handleDayClick = (date: Date) => {
    updateUrlParams({ 
      view: 'day',
      date: formatDate(date, 'yyyy-MM-dd')
    });
  };

  // Event click handler - open appropriate modal by adding ID to URL
  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === 'task') {
      updateUrlParams({ task: event.id });
    } else if (event.type === 'milestone') {
      updateUrlParams({ milestone: event.id });
    } else if (event.type === 'issue') {
      updateUrlParams({ issue: event.id });
    } else if (event.type === 'meeting') {
      window.open(event.htmlLink || event.meetingUri, '_blank', 'noopener,noreferrer');
    }
  };

  type ModalType = 'task' | 'milestone' | 'issue';
  const handleModalClose = (modalType?: ModalType) => {
    const newParams = new URLSearchParams(searchParams);
    if (modalType) {
      newParams.delete(modalType);
    } else {
      newParams.delete('task');
      newParams.delete('milestone');
      newParams.delete('issue');
    }
    setSearchParams(newParams);
  };

  // Get tasks for the same project (for modal context)
  const getProjectTasks = (projectId: string): Task[] => {
    return allTasks.filter(t => t.projectId === projectId);
  };

  // Build a project-like object for filters (needs id + name)
  const projectsForFilter = projects.map(p => ({
    ...p,
    tasks: [],
    milestones: [],
    issues: [],
  }));

  // Early return: show identical skeleton to Suspense fallback while data loads
  if (isLoading) {
    return <AppLayoutSkeleton variant="calendar" />;
  }

  // ── Shared modals (used by both mobile and desktop) ──────────────────────
  const sharedModals = (
    <>
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => handleModalClose('task')}
          onUpdate={async (updatedTask) => {
            try {
              if (updatedTask.projectId && updatedTask.id) {
                await updateTaskMutation.mutateAsync({
                  projectId: updatedTask.projectId,
                  taskId: updatedTask.id,
                  updates: updatedTask,
                });
                toast.success('Task updated successfully');
              } else {
                toast.error('Missing project ID or task ID');
              }
            } catch (error) {
              logger.error('Failed to update task:', error);
              toast.error(error instanceof Error ? error.message : 'Failed to update task');
            }
          }}
          onBatchUpdate={async (updates) => {
            try {
              if (!selectedTask.projectId) {
                toast.error('Missing project ID');
                return;
              }
              await batchUpdateTasksMutation.mutateAsync({
                projectId: selectedTask.projectId,
                updates,
              });
            } catch (error) {
              logger.error('Failed to batch update tasks:', error);
              toast.error('Failed to update dependent tasks');
            }
          }}
          allTasks={getProjectTasks(selectedTask.projectId || '')}
        />
      )}

      {selectedMilestone && (
        <MilestoneDetailModal
          milestone={selectedMilestone}
          isOpen={!!selectedMilestone}
          onClose={() => handleModalClose('milestone')}
          onUpdate={async (updatedMilestone) => {
            try {
              await updateMilestoneMutation.mutateAsync({
                id: updatedMilestone.id,
                updates: {
                  name: updatedMilestone.title,
                  description: updatedMilestone.description,
                  due_date: updatedMilestone.date,
                  status: updatedMilestone.completed ? 'completed' : 'pending',
                },
              });
              toast.success('Milestone updated successfully');
            } catch (error) {
              logger.error('Failed to update milestone:', error);
              toast.error('Failed to update milestone');
            }
          }}
          tasks={[]}
          issues={[]}
          modules={[]}
        />
      )}

      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          isOpen={!!selectedIssue}
          onClose={() => handleModalClose('issue')}
          onUpdate={async (updatedIssue) => {
            try {
              if (updatedIssue.projectId && updatedIssue.id) {
                await updateIssueMutation.mutateAsync({
                  projectId: updatedIssue.projectId,
                  issueId: updatedIssue.id,
                  updates: updatedIssue,
                });
                toast.success('Issue updated successfully');
              } else {
                toast.error('Missing project ID or issue ID');
              }
            } catch (error) {
              logger.error('Failed to update issue:', error);
              toast.error('Failed to update issue');
            }
          }}
          tasks={getProjectTasks(selectedIssue.projectId)}
        />
      )}
    </>
  );

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <MobileCalendar
          currentDate={currentDate}
          events={filteredEvents}
          onDateChange={(date) => updateUrlParams({ date: formatDate(date, 'yyyy-MM-dd') }, true)}
          onEventClick={handleEventClick}
        />
        {sharedModals}
      </>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <>
      <div className="h-full flex flex-col gap-6 animate-fade-in px-6 py-6">
        {/* Page Header */}
        {/* <div className="shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage project timelines, milestones, and tasks.
          </p>
        </div> */}

        {/* Controls Layout */}
        <div className="flex flex-col shrink-0">
          {/* Header */}
          <CalendarHeader
            currentDate={currentDate}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onNavigatePrevious={handleNavigatePrevious}
            onNavigateNext={handleNavigateNext}
            onNavigateToday={handleNavigateToday}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-9 rounded-lg"
                  onClick={() => handleScheduleMeeting()}
                >
                  <Video className="h-4 w-4" />
                  <span className="hidden sm:inline">Schedule a meet</span>
                </Button>
                <CalendarFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  projects={projectsForFilter as any}
                  teamMembers={teamMembers}
                  hideActiveFilters
                />
              </>
            }
          />

          {/* Active Filters */}
          <div className="py-2 empty:hidden">
            <CalendarFilters
              filters={filters}
              onFiltersChange={setFilters}
              projects={projectsForFilter as any}
              teamMembers={teamMembers}
              hideTrigger
            />
          </div>
        </div>

        {/* Calendar View */}
        <div className="flex-1 min-h-0 border border-border rounded-lg overflow-hidden bg-card flex flex-col">
          <>
            {viewMode === 'month' && (
              <CalendarMonthView
                days={days}
                events={filteredEvents}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
              />
            )}
            {viewMode === 'week' && (
              <CalendarWeekView
                days={days}
                events={filteredEvents}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
              />
            )}
            {viewMode === 'day' && (
              <CalendarDayView
                date={currentDate}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onScheduleMeeting={handleScheduleMeeting}
              />
            )}
          </>
        </div>
      </div>

      {sharedModals}
      <ScheduleMeetDialog
        open={scheduleMeetOpen}
        onOpenChange={setScheduleMeetOpen}
        teamMembers={teamMembers}
        initialDate={scheduleMeetDate}
      />
    </>
  );
};

export default CalendarPage;
