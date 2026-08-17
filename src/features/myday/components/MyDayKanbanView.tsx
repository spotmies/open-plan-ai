import { useState, useMemo, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { resolveFileUrl } from '@/utils/fileUrl';
import { useIsMobile } from '@/hooks/use-mobile';
import { useKanbanEdgeAutoScroll, resolveKanbanColumnIdAtPoint } from '@/hooks/useKanbanEdgeAutoScroll';
import { MobileKanbanColumn } from '@/components/shared/MobileKanbanColumn';
import { Check, CheckSquare, Bug } from 'lucide-react';
import {
  MyDayItem,
  groupTasksByProject,
  groupTasksByProgress,
  groupTasksByDueDate,
  groupTasksByPriority,
  formatTaskDateRange
} from '../utils/myDayUtils';
import { MyDayGroupBy, TaskStatus } from '@/types';
import { toast } from 'sonner';
import { logger } from '@/services/monitoring/logger';

interface KanbanColumn {
  id: string;
  label: string;
  color: string;
  tasks: MyDayItem[];
}

interface MyDayKanbanViewProps {
  tasks: MyDayItem[];
  groupBy: MyDayGroupBy;
  onTaskClick: (item: MyDayItem) => void;
  onStatusUpdate: (taskId: string, status: TaskStatus) => void;
  onChecklistToggle: (taskId: string, itemId: string) => void;
}

// Maps a My Day progress bucket to the backend status/column key it writes,
// for tasks and issues respectively.
const taskStatusByBucket: Record<string, TaskStatus> = {
  notStarted: 'todo',
  inProgress: 'in-progress',
  completed: 'done',
};

const issueStatusByBucket: Record<string, string> = {
  notStarted: 'open',
  inProgress: 'in-progress',
  completed: 'resolved',
};

const progressColumnConfig = [
  { id: 'dependency', label: 'Dependency', color: 'bg-status-blocked' },
  { id: 'notStarted', label: 'To Do', color: 'bg-status-todo' },
  { id: 'inProgress', label: 'In Progress', color: 'bg-status-in-progress' },
  { id: 'completed', label: 'Done', color: 'bg-status-done' },
];

const dueDateColumnConfig = [
  { id: 'late', label: 'Late', color: 'bg-status-blocked' },
  { id: 'today', label: 'Today', color: 'bg-priority-high' },
  { id: 'tomorrow', label: 'Tomorrow', color: 'bg-priority-medium' },
  { id: 'thisWeek', label: 'This Week', color: 'bg-status-in-progress' },
  { id: 'later', label: 'Later', color: 'bg-status-todo' },
];

const priorityColumnConfig = [
  { id: 'urgent', label: 'Urgent', color: 'bg-priority-critical' },
  { id: 'important', label: 'Important', color: 'bg-priority-high' },
  { id: 'medium', label: 'Medium', color: 'bg-priority-medium' },
  { id: 'low', label: 'Low', color: 'bg-priority-low' },
];

const priorityColors: Record<string, string> = {
  critical: 'bg-priority-critical text-white',
  major: 'bg-priority-high text-white',
  minor: 'bg-priority-medium text-white',
  trivial: 'bg-priority-low text-white',
};

const moduleColors = {
  hardware: 'border-l-module-hardware',
  software: 'border-l-module-software',
  firmware: 'border-l-module-firmware',
  testing: 'border-l-module-testing',
};

export function MyDayKanbanView({
  tasks: initialTasks,
  groupBy,
  onTaskClick,
  onStatusUpdate,
}: MyDayKanbanViewProps) {
  const [localTasks, setLocalTasks] = useState<MyDayItem[]>(initialTasks);
  const isMobile = useIsMobile();
  const [mobileColumnOrder, setMobileColumnOrder] = useState<string[]>([]);

  useEffect(() => {
    setLocalTasks(initialTasks);
  }, [initialTasks]);

  const columns = useMemo((): KanbanColumn[] => {
    switch (groupBy) {
      case 'project': {
        const grouped = groupTasksByProject(localTasks);
        return Array.from(grouped.entries()).map(([id, { name, tasks }], index) => ({
          id,
          label: name,
          color: `bg-chart-${(index % 5) + 1}`,
          tasks,
        }));
      }
      case 'progress': {
        const grouped = groupTasksByProgress(localTasks);
        return progressColumnConfig.map(config => ({
          ...config,
          tasks: grouped[config.id as keyof typeof grouped] || [],
        }));
      }
      case 'dueDate': {
        const grouped = groupTasksByDueDate(localTasks);
        return dueDateColumnConfig.map(config => ({
          ...config,
          tasks: grouped[config.id as keyof typeof grouped] || [],
        }));
      }
      case 'priority': {
        const grouped = groupTasksByPriority(localTasks);
        return priorityColumnConfig.map(config => ({
          ...config,
          tasks: grouped[config.id as keyof typeof grouped] || [],
        }));
      }
      default:
        return [];
    }
  }, [localTasks, groupBy]);

  // Column order is local-only (My Day groupings are computed, not persisted columns).
  // Re-sync whenever the available column ids change (e.g. groupBy switch), keeping
  // any existing relative order and appending newly-seen ids at the end.
  useEffect(() => {
    setMobileColumnOrder((prev) => {
      const currentIds = columns.map((c) => c.id);
      const kept = prev.filter((id) => currentIds.includes(id));
      const missing = currentIds.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
  }, [columns]);

  const orderedColumns = isMobile
    ? mobileColumnOrder.map((id) => columns.find((c) => c.id === id)).filter((c): c is KanbanColumn => Boolean(c))
    : columns;

  const { containerRef: boardScrollRef, handleDragStart, handleDragEnd: handleAutoScrollDragEnd, getLastPointerPosition } = useKanbanEdgeAutoScroll();

  const handleDragEnd = (result: DropResult) => {
    const pointer = getLastPointerPosition();
    handleAutoScrollDragEnd();
    if (!result.destination) return;

    const { source, destination, draggableId, type } = result;

    if (type === 'COLUMN') {
      if (destination.index === source.index) return;
      setMobileColumnOrder((prev) => {
        const next = Array.from(prev);
        const [removed] = next.splice(source.index, 1);
        next.splice(destination.index, 0, removed);
        return next;
      });
      return;
    }

    // Auto-scrolling the board mid-drag leaves @hello-pangea/dnd's cached
    // position for the card stale, so `destination.droppableId` can name a
    // column that's no longer under the pointer. Hit-test the real DOM
    // element at the pointer's last known position and prefer that.
    const hitColumnId = pointer
      ? resolveKanbanColumnIdAtPoint(pointer.x, pointer.y)
      : undefined;
    const destinationColumnId = hitColumnId ?? destination.droppableId;

    // Only allow status updates when grouping by progress
    if (groupBy === 'progress') {
      // 'dependency' is excluded: it's a derived blocked-state, not a real
      // task_columns key on the backend, and isDropDisabled prevents drops there.
      const newStatus = taskStatusByBucket[destinationColumnId];
      if (newStatus) {
        // Optimistic local update to prevent blinking AND maintain new dragging order
        const tasksCopy = [...localTasks];
        // find item in old array
        const itemIndex = tasksCopy.findIndex(t => t.id === draggableId);
        if (itemIndex > -1) {
          const item = tasksCopy[itemIndex];
          // remove item
          tasksCopy.splice(itemIndex, 1);

          let updatedItem = { ...item };
          if (item.itemType === 'task' && item.originalTask) {
            updatedItem = { ...updatedItem, status: newStatus, originalTask: { ...item.originalTask, status: newStatus } };
          } else if (item.itemType === 'issue' && item.originalIssue) {
            const mappedStatus = issueStatusByBucket[destinationColumnId];
            updatedItem = { ...updatedItem, status: mappedStatus, originalIssue: { ...item.originalIssue, status: mappedStatus } };
          }

          // Re-insert at the estimated destination index relative to the whole array.
          // Since localTasks is all items, but destination.index is relative to the group,
          // we need to insert it at a positional index. But inserting it at the end of the array is usually fine
          // if we don't care about intra-column sorting in MyDayKanbanView.
          tasksCopy.push(updatedItem);

          setLocalTasks(tasksCopy);
        }

        if (source.droppableId !== destinationColumnId) {
          const prevTasks = [...localTasks];
          Promise.resolve(onStatusUpdate(draggableId, newStatus)).catch((err) => {
            logger.error('Status update failed', err);
            setLocalTasks(prevTasks);
            toast.error('Failed to update status');
          });
        }
      }
    }
  };

  const handleCompleteTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusUpdate(taskId, 'done');
  };

  if (columns.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No tasks to display
      </div>
    );
  }

  const renderCardsDroppable = (column: KanbanColumn) => (
    <Droppable
      droppableId={column.id}
      type="TASK"
      isDropDisabled={groupBy !== 'progress' || column.id === 'dependency'}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          data-kanban-column-id={column.id}
          className={cn(
            'flex flex-col gap-2 min-h-[200px] h-full p-2 rounded-lg',
            snapshot.isDraggingOver ? 'bg-muted/50' : 'bg-muted/30',
          )}
        >
          {column.tasks.map((task, taskIndex) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id}
                          index={taskIndex}
                          isDragDisabled={groupBy !== 'progress'}
                        >
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={provided.draggableProps.style}
                              className={cn(
                                'p-3 cursor-grab active:cursor-grabbing border-l-4 relative group hover:shadow-md',
                                task.itemType === 'task' && task.originalTask?.module
                                  ? moduleColors[task.originalTask.module as keyof typeof moduleColors] || 'border-l-muted'
                                  : 'border-l-muted',
                                snapshot.isDragging && 'shadow-lg'
                              )}
                              onClick={() => onTaskClick(task)}
                            >
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="relative flex flex-1 items-start min-w-0 overflow-hidden">
                                    {(task.status === 'done' || task.status === 'resolved') ? (
                                      <div className="absolute left-0 top-0 z-10 flex items-center justify-center w-4 h-4">
                                        <div className="h-4 w-4 rounded-full bg-status-done/20 flex items-center justify-center">
                                          <Check className="h-3 w-3 text-status-done" />
                                        </div>
                                      </div>
                                    ) : (
                                      <div
                                        className="absolute left-0 top-0 z-10 flex items-center justify-center w-4 h-4"
                                      >
                                        <button
                                          onClick={(e) => handleCompleteTask(task.id, e)}
                                          className="h-4 w-4 rounded-full border border-foreground/30 flex items-center justify-center hover:border-foreground hover:bg-muted transition-all bg-background"
                                          aria-label="Mark task complete"
                                        >
                                          <span className="sr-only">Mark complete</span>
                                        </button>
                                      </div>
                                    )}
                                    <h4
                                      className="text-sm font-medium leading-tight truncate transition-all duration-300 ease-out translate-x-6"
                                    >
                                      {task.title}
                                    </h4>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* Item Type Badge */}
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-[9px] px-1 py-0 h-4 flex items-center gap-0.5',
                                        task.itemType === 'task' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                                      )}
                                    >
                                      {task.itemType === 'task' ? (
                                        <>
                                          <CheckSquare className="h-2.5 w-2.5" />
                                          <span>Task</span>
                                        </>
                                      ) : (
                                        <>
                                          <Bug className="h-2.5 w-2.5" />
                                          <span>Issue</span>
                                        </>
                                      )}
                                    </Badge>
                                    {/* Priority Badge */}
                                    <Badge
                                      variant="secondary"
                                      className={cn(
                                        'text-[10px] px-1.5 py-0',
                                        priorityColors[task.priority as keyof typeof priorityColors]
                                      )}
                                    >
                                      {task.priority}
                                    </Badge>
                                  </div>
                                </div>

                                {task.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 text-left">
                                    {task.description}
                                  </p>
                                )}

                                <div className="flex items-center justify-between pt-2">
                                  {task.assignees && task.assignees.length > 0 && (
                                    <div className="flex -space-x-2">
                                      {task.assignees.slice(0, 3).map((assignee) => (
                                        <Avatar key={assignee.id} className="h-5 w-5 border-2 border-background">
                                          <AvatarImage src={resolveFileUrl(assignee.avatar) ?? assignee.avatar} alt={assignee.name} />
                                          <AvatarFallback className="text-[9px] bg-muted">
                                            {assignee.initials}
                                          </AvatarFallback>
                                        </Avatar>
                                      ))}
                                      {task.assignees.length > 3 && (
                                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center border-2 border-background z-10">
                                          <span className="text-[8px] text-muted-foreground font-medium">
                                            +{task.assignees.length - 3}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {task.dueDate && (
                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                      {formatTaskDateRange(task.originalTask?.startDate, task.dueDate)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Card>
                          )}
                        </Draggable>
                      ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );

  return (
    <div className="space-y-4">
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {isMobile ? (
          <Droppable droppableId="myday-board" type="COLUMN" direction="vertical">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-3 w-full">
                {orderedColumns.map((column, index) => (
                  <Draggable key={column.id} draggableId={column.id} index={index}>
                    {(dragProvided, dragSnapshot) => (
                      <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className="w-full">
                        <MobileKanbanColumn
                          label={column.label}
                          count={column.tasks.length}
                          countLabel="tasks"
                          dot={<div className={cn('w-2 h-2 rounded-full shrink-0', column.color)} />}
                          dragHandleProps={dragProvided.dragHandleProps}
                          isDragging={dragSnapshot.isDragging}
                        >
                          {renderCardsDroppable(column)}
                        </MobileKanbanColumn>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ) : (
          <div ref={boardScrollRef} className="w-full pb-4 overflow-x-auto md:overflow-visible touch-pan-x">
            <div
              className="flex gap-3 min-w-max snap-x snap-mandatory md:grid md:gap-4 md:min-w-0"
              style={{
                gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
              }}
            >
              {columns.map((column) => (
                <div
                  key={column.id}
                  className="w-[250px] min-w-[250px] flex flex-col snap-start md:w-auto md:min-w-0 md:flex-1 max-h-[calc(100vh-280px)]"
                >
                  {/* Column Header */}
                  <div className="flex-shrink-0 bg-background pb-3 space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <div className={cn('w-2 h-2 rounded-full', column.color)} />
                      <h3 className="font-medium text-sm">{column.label}</h3>
                      <span className="text-xs text-muted-foreground">
                        {column.tasks.length}
                      </span>
                    </div>
                  </div>

                  {/* Tasks Droppable - scrollable */}
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {renderCardsDroppable(column)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DragDropContext>
    </div>
  );
}
