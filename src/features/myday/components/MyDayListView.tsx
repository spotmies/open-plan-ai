import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { format, parse } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { resolveFileUrl } from '@/utils/fileUrl';
import { useIsMobile } from '@/hooks/use-mobile';
import { CheckSquare, Bug, Check, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import {
  MyDayItem,
  groupTasksByProject,
  groupTasksByProgress,
  groupTasksByDueDate,
  groupTasksByPriority,
} from '../utils/myDayUtils';
import { MyDayGroupBy, TaskStatus } from '@/types';

interface MyDayListViewProps {
  tasks: MyDayItem[];
  groupBy: MyDayGroupBy;
  onTaskClick: (item: MyDayItem) => void;
  onStatusUpdate: (taskId: string, status: TaskStatus) => void;
}

const statusColors: Record<string, string> = {
  todo: 'bg-status-todo/20 text-muted-foreground',
  'in-progress': 'bg-status-in-progress/20 text-status-in-progress',
  review: 'bg-status-review/20 text-status-review',
  done: 'bg-status-done/20 text-status-done',
  blocked: 'bg-status-blocked/20 text-status-blocked',
  // Issue statuses
  open: 'bg-destructive/20 text-destructive',
  resolved: 'bg-status-done/20 text-status-done',
  'wont-fix': 'bg-muted-foreground/20 text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  todo: 'Todo',
  'in-progress': 'In Progress',
  review: 'Review',
  done: 'Done',
  blocked: 'Blocked',
  // Issue statuses
  open: 'Open',
  resolved: 'Resolved',
  'wont-fix': "Won't Fix",
};

const priorityColors: Record<string, string> = {
  critical: 'bg-priority-critical/20 text-priority-critical',
  high: 'bg-priority-high/20 text-priority-high',
  medium: 'bg-priority-medium/20 text-priority-medium',
  low: 'bg-priority-low/20 text-priority-low',
  // Issue severities
  major: 'bg-orange-500/20 text-orange-600',
  minor: 'bg-yellow-500/20 text-yellow-700',
  trivial: 'bg-muted-foreground/20 text-muted-foreground',
};

// Lower number = higher urgency, sorts first in ascending order
const priorityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  major: 1, // Issue severity
  medium: 2,
  minor: 2, // Issue severity
  low: 3,
  trivial: 3, // Issue severity
};

// Workflow order, not alphabetical
const statusOrder: Record<string, number> = {
  blocked: 0,
  todo: 1,
  open: 1,
  'in-progress': 2,
  review: 3,
  done: 4,
  resolved: 4,
  'wont-fix': 5,
};

type SortField = 'title' | 'type' | 'status' | 'priority' | 'project' | 'dueDate';
type SortDirection = 'asc' | 'desc';

const DESKTOP_PAGE_SIZE = 10;

export function MyDayListView({
  tasks,
  groupBy,
  onTaskClick,
  onStatusUpdate,
}: MyDayListViewProps) {
  const isMobile = useIsMobile();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Get all tasks in a flat list based on groupBy order
  const groupedTasks = useMemo((): MyDayItem[] => {
    switch (groupBy) {
      case 'project': {
        const grouped = groupTasksByProject(tasks);
        return Array.from(grouped.values()).flatMap(data => data.tasks);
      }
      case 'progress': {
        const grouped = groupTasksByProgress(tasks);
        return [
          ...grouped.dependency,
          ...grouped.notStarted,
          ...grouped.inProgress,
          ...grouped.completed,
        ];
      }
      case 'dueDate': {
        const grouped = groupTasksByDueDate(tasks);
        return [
          ...grouped.late,
          ...grouped.today,
          ...grouped.tomorrow,
          ...grouped.thisWeek,
          ...grouped.later,
        ];
      }
      case 'priority': {
        const grouped = groupTasksByPriority(tasks);
        return [
          ...grouped.urgent,
          ...grouped.important,
          ...grouped.medium,
          ...grouped.low,
        ];
      }
      default:
        return tasks;
    }
  }, [tasks, groupBy]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  // Sorting overrides the groupBy-derived order once a column header is clicked.
  const allTasks = useMemo((): MyDayItem[] => {
    if (!sortField) return groupedTasks;

    const direction = sortDirection === 'asc' ? 1 : -1;

    return [...groupedTasks].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'type':
          comparison = a.itemType.localeCompare(b.itemType);
          break;
        case 'status': {
          const aOrder = statusOrder[a.status] ?? 99;
          const bOrder = statusOrder[b.status] ?? 99;
          comparison = aOrder - bOrder;
          break;
        }
        case 'priority': {
          const aOrder = priorityOrder[a.priority] ?? 99;
          const bOrder = priorityOrder[b.priority] ?? 99;
          comparison = aOrder - bOrder;
          break;
        }
        case 'project':
          comparison = (a.projectName || '').localeCompare(b.projectName || '');
          break;
        case 'dueDate': {
          const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          comparison = aTime - bTime;
          break;
        }
      }

      return comparison * direction;
    });
  }, [groupedTasks, sortField, sortDirection]);

  // Infinite scrolling state for mobile view (displays 10 by 10)
  const [mobileVisibleCount, setMobileVisibleCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement | null>(null);

  // Pagination state for desktop table view
  const [currentPage, setCurrentPage] = useState(1);

  // Reset paging state synchronously during render whenever the underlying task
  // list changes (tab switch, sort, group, or filter change). Doing this in a
  // useEffect would let one render commit with the old page against the new
  // task list first, briefly showing the wrong slice of data.
  const prevAllTasksRef = useRef(allTasks);
  if (prevAllTasksRef.current !== allTasks) {
    prevAllTasksRef.current = allTasks;
    if (currentPage !== 1) setCurrentPage(1);
    if (mobileVisibleCount !== 10) setMobileVisibleCount(10);
    if (isLoadingMore) setIsLoadingMore(false);
  }

  const totalPages = Math.max(1, Math.ceil(allTasks.length / DESKTOP_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTasks = useMemo(
    () => allTasks.slice((safeCurrentPage - 1) * DESKTOP_PAGE_SIZE, safeCurrentPage * DESKTOP_PAGE_SIZE),
    [allTasks, safeCurrentPage]
  );

  // Observer to load 10 more tasks when scrolling near bottom on mobile
  useEffect(() => {
    if (!isMobile) return;
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setMobileVisibleCount((prev) => Math.min(prev + 10, allTasks.length));
            setIsLoadingMore(false);
          }, 350);
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isMobile, allTasks.length, isLoadingMore]);

  const SortableHead = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => handleSort(field)}
      >
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </button>
    </TableHead>
  );

  if (allTasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No tasks to display
      </div>
    );
  }

  if (isMobile) {
    const visibleTasks = allTasks.slice(0, mobileVisibleCount);
    const hasMore = mobileVisibleCount < allTasks.length;

    return (
      <div className="space-y-3">
        <div className="rounded-lg border divide-y divide-border">
          {visibleTasks.map((task) => {
            const isComplete = task.status === 'done' || task.status === 'resolved';
            return (
              <div
                key={task.id}
                className="flex items-start gap-3 px-4 py-3.5 cursor-pointer active:bg-muted/50"
                onClick={() => onTaskClick(task)}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusUpdate(task.id, isComplete ? 'todo' : 'done');
                  }}
                  aria-label={isComplete ? 'Mark as incomplete' : 'Mark as complete'}
                  className={cn(
                    'h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                    isComplete ? 'bg-status-done border-status-done' : 'border-muted-foreground/40'
                  )}
                >
                  {isComplete && <Check className="h-3 w-3 text-white" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[15px] leading-snug truncate">{task.title}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[11px] px-2 py-0.5 flex items-center gap-1 w-fit font-medium',
                        task.itemType === 'task' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                      )}
                    >
                      {task.itemType === 'task' ? (
                        <>
                          <CheckSquare className="h-3 w-3" />
                          <span>Task</span>
                        </>
                      ) : (
                        <>
                          <Bug className="h-3 w-3" />
                          <span>Issue</span>
                        </>
                      )}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={cn('text-[11px] px-2 py-0.5 font-medium capitalize', statusColors[task.status])}
                    >
                      {statusLabels[task.status] || task.status}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sentinel loader element for mobile infinite scroll */}
        {hasMore && (
          <div
            ref={observerTarget}
            className="py-3.5 text-center text-xs text-muted-foreground flex items-center justify-center gap-2 border rounded-lg bg-muted/20 font-medium"
          >
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Loading...</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead field="title" className="w-[300px]">Task</SortableHead>
            <SortableHead field="type" className="w-[60px]">Type</SortableHead>
            <SortableHead field="status">Status</SortableHead>
            <SortableHead field="priority">Priority</SortableHead>
            {/* <TableHead>Module</TableHead> */}
            <SortableHead field="project">Project</SortableHead>
            <TableHead>Assigned By</TableHead>
            <SortableHead field="dueDate">Due Date</SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedTasks.map((task) => (
            <TableRow
              key={task.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onTaskClick(task)}
            >
              <TableCell>
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const isComplete = task.status === 'done' || task.status === 'resolved';
                      onStatusUpdate(task.id, isComplete ? 'todo' : 'done');
                    }}
                    aria-label={(task.status === 'done' || task.status === 'resolved') ? 'Mark as incomplete' : 'Mark as complete'}
                    className={cn(
                      'h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                      (task.status === 'done' || task.status === 'resolved')
                        ? 'bg-status-done border-status-done'
                        : 'border-muted-foreground/40 hover:border-status-done'
                    )}
                  >
                    {(task.status === 'done' || task.status === 'resolved') && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="font-medium truncate max-w-[260px] cursor-pointer">{task.title}</p>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        {task.title}
                      </TooltipContent>
                    </Tooltip>
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 break-all">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] px-1.5 py-0.5 flex items-center gap-1 w-fit',
                    task.itemType === 'task' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                  )}
                >
                  {task.itemType === 'task' ? (
                    <>
                      <CheckSquare className="h-3 w-3" />
                      <span>Task</span>
                    </>
                  ) : (
                    <>
                      <Bug className="h-3 w-3" />
                      <span>Issue</span>
                    </>
                  )}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn('capitalize', statusColors[task.status])}>
                  {statusLabels[task.status] || task.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn('capitalize', priorityColors[task.priority])}>
                  {task.priority}
                </Badge>
              </TableCell>
              {/* <TableCell>
                <span className="text-sm capitalize">{task.itemType === 'task' && task.originalTask?.module ? task.originalTask.module : '-'}</span>
              </TableCell> */}
              <TableCell>
                {task.projectName ? (
                  <Badge variant="outline" className="text-xs">
                    {task.projectName}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell>
                {(() => {
                  const assignedBy = task.itemType === 'task' ? task.originalTask?.createdBy : task.originalIssue?.reportedBy;
                  return assignedBy ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={resolveFileUrl(assignedBy.avatar) ?? assignedBy.avatar} alt={assignedBy.name} />
                        <AvatarFallback className="text-[10px]">
                          {assignedBy.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{assignedBy.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  );
                })()}
              </TableCell>
              <TableCell>
                {task.dueDate ? (
                  <span className="text-sm">
                    {format(new Date(task.dueDate), 'dd/MM/yyyy')}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">No date</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-2 py-4 border-t">
          <p className="text-xs text-muted-foreground">
            Page {safeCurrentPage} of {totalPages} ({allTasks.length} items)
          </p>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (safeCurrentPage > 1) setCurrentPage(safeCurrentPage - 1);
                  }}
                  className={cn(safeCurrentPage <= 1 && 'pointer-events-none opacity-50')}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (safeCurrentPage < totalPages) setCurrentPage(safeCurrentPage + 1);
                  }}
                  className={cn(safeCurrentPage >= totalPages && 'pointer-events-none opacity-50')}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
