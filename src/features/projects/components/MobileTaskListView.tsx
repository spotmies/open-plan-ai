import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Task, ModuleType, TeamMember, Milestone } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, CheckSquare, Plus } from 'lucide-react';
import { cn, getDisplayId } from '@/lib/utils';
import { AttachmentBadges } from '@/components/shared/AttachmentBadges';
import { resolveFileUrl } from '@/utils/fileUrl';
import { getFallbackTagColor } from '@/lib/tagColors';
import { formatModuleType } from '../utils/projectUtils';
import { TaskDetailModal } from './TaskDetailModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ColorSwatchPicker } from '@/components/shared/ColorSwatchPicker';
import { BUCKET_COLOR_OPTIONS } from '@/lib/bucketColors';
import { useProjectTaskColumns, useCreateTaskColumn } from '@/hooks/useProjectTaskColumns';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { playCompleteSound } from '@/lib/playSound';
import { DEFAULT_COLUMNS, type ProjectTaskColumn } from '@/services/projectTaskColumns.service';

interface MobileTaskListViewProps {
  projectId?: string;
  projectCode?: string;
  tasks: Task[];
  allTasks?: Task[];
  modules?: { id: string; name: string; type: ModuleType }[];
  milestones?: Milestone[];
  assignableMembers?: TeamMember[];
  onTaskUpdate?: (task: Task, onError?: () => void) => void;
  onBatchTaskUpdate?: (updates: Array<{ id: string; updates: Partial<Task> }>) => void;
  onTaskDelete?: (taskId: string) => void;
  userProjectRole?: string;
  onAddModule?: () => void;
}

const priorityColors: Record<string, string> = {
  critical: 'bg-priority-critical/20 text-priority-critical',
  major: 'bg-priority-high/20 text-priority-high',
  minor: 'bg-priority-medium/20 text-priority-medium',
  trivial: 'bg-priority-low/20 text-priority-low',
};

const moduleTextColors: Record<string, string> = {
  hardware: 'text-module-hardware',
  software: 'text-module-software',
  firmware: 'text-module-firmware',
  testing: 'text-module-testing',
};

const moduleDotColors: Record<string, string> = {
  hardware: 'bg-module-hardware',
  software: 'bg-module-software',
  firmware: 'bg-module-firmware',
  testing: 'bg-module-testing',
};

/** Renders a coloured dot for a bucket/column — works with both hex colours and Tailwind classes. */
function ColumnDot({ color }: { color: string }) {
  if (!color) return <span className="h-2 w-2 rounded-full shrink-0 inline-block bg-muted-foreground/40" />;
  if (color.startsWith('#') || color.startsWith('rgb')) {
    return <span className="h-2 w-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: color }} />;
  }
  return <span className={cn('h-2 w-2 rounded-full shrink-0 inline-block', color)} />;
}

const parseDateForDisplay = (value?: string): Date | null => {
  if (!value) return null;
  const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnlyRegex.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    const localDate = new Date(y, m - 1, d);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatTaskDateRange = (startDate?: string, dueDate?: string): string => {
  const start = parseDateForDisplay(startDate);
  const due = parseDateForDisplay(dueDate);
  if (!start && !due) return '';
  if (start && due) return `${format(start, 'MMM dd')} – ${format(due, 'MMM dd')}`;
  return format((start || due)!, 'MMM dd');
};

export function MobileTaskListView({
  projectId,
  projectCode,
  tasks,
  allTasks,
  modules = [],
  milestones = [],
  assignableMembers,
  onTaskUpdate,
  onBatchTaskUpdate,
  onTaskDelete,
  userProjectRole,
  onAddModule,
}: MobileTaskListViewProps) {
  const allTasksForDependencies = allTasks && allTasks.length > 0 ? allTasks : tasks;
  const { canEditResource } = useProjectPermissions(projectId);

  // Buckets are project-specific and dynamic (renamed/added/removed per project),
  // so mirror KanbanView: pull the same persisted columns rather than assuming a
  // fixed 5-status enum — otherwise tasks sitting in a custom bucket vanish here.
  const { data: persistedColumns } = useProjectTaskColumns(projectId);
  const columns: ProjectTaskColumn[] = useMemo(() => {
    if (!projectId || !persistedColumns || persistedColumns.length === 0) return DEFAULT_COLUMNS;
    return persistedColumns;
  }, [projectId, persistedColumns]);

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnColor, setNewColumnColor] = useState(BUCKET_COLOR_OPTIONS[0].value);

  const createTaskColumn = useCreateTaskColumn(projectId);

  const handleAddColumn = () => {
    if (!newColumnName.trim() || !projectId) return;
    createTaskColumn.mutate(
      { label: newColumnName, color: newColumnColor },
      {
        onSuccess: () => {
          setNewColumnName('');
          setNewColumnColor(BUCKET_COLOR_OPTIONS[0].value);
          setIsAddColumnOpen(false);
        },
      }
    );
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((task) => {
      counts[task.status] = (counts[task.status] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  // Only surface buckets that actually have tasks in them right now.
  const visibleColumns = columns.filter((column) => (statusCounts[column.status] || 0) > 0);

  const displayedTasks = selectedStatus === 'all'
    ? tasks
    : tasks.filter((task) => task.status === selectedStatus);

  const groupedSections = useMemo(() => {
    return visibleColumns
      .map((column) => ({ column, items: displayedTasks.filter((task) => task.status === column.status) }))
      .filter((group) => group.items.length > 0);
  }, [visibleColumns, displayedTasks]);

  const getModuleInfo = (task: Task) => {
    if (task.moduleIds && task.moduleIds.length > 0) {
      const found = modules.find((m) => m.id === task.moduleIds![0]);
      if (found) return { label: found.name, type: found.type as string };
    }
    return { label: formatModuleType(task.module), type: task.module as string };
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    if (selectedTask && selectedTask.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }
    onTaskUpdate?.(updatedTask);
  };

  const handleCompleteTask = (task: Task) => {
    if (!canEditResource({ createdBy: task.createdBy?.id, assigneeIds: task.assignees?.map((a) => a.id) })) return;
    playCompleteSound();
    onTaskUpdate?.({ ...task, status: 'done' });
  };

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => setSelectedStatus('all')}
          className={cn(
            'shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors',
            selectedStatus === 'all'
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background text-foreground border-border'
          )}
        >
          All
          <span className={cn('text-xs', selectedStatus === 'all' ? 'opacity-70' : 'text-muted-foreground')}>
            {tasks.length}
          </span>
        </button>
        {visibleColumns.map((column) => (
          <button
            key={column.id}
            type="button"
            onClick={() => setSelectedStatus(column.status)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors',
              selectedStatus === column.status
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-border'
            )}
          >
            {column.label}
            <span className={cn('text-xs', selectedStatus === column.status ? 'opacity-70' : 'text-muted-foreground')}>
              {statusCounts[column.status] || 0}
            </span>
          </button>
        ))}
        {projectId && (
          <button
            type="button"
            onClick={() => setIsAddColumnOpen(true)}
            aria-label="Add New Bucket"
            className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground active:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {groupedSections.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          No tasks to display
        </div>
      ) : (
        <div className="space-y-5">
          {groupedSections.map(({ column, items }) => (
            <div key={column.id} className="space-y-3">
              <div className="flex items-center gap-2 px-0.5">
                <ColumnDot color={column.color} />
                <h3 className="text-sm font-semibold">{column.label}</h3>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>

              <div className="space-y-3">
                {items.map((task) => {
                  const checklist = task.checklist || [];
                  const completedCount = checklist.filter((item) => item.completed).length;
                  const moduleInfo = getModuleInfo(task);
                  const dateRange = formatTaskDateRange(task.startDate, task.dueDate);
                  const primaryAssignee = task.assignees?.[0];

                  return (
                    <Card
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className="p-4 rounded-2xl cursor-pointer active:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompleteTask(task);
                          }}
                          disabled={task.status === 'done' || !canEditResource({ createdBy: task.createdBy?.id, assigneeIds: task.assignees?.map((a) => a.id) })}
                          title={canEditResource({ createdBy: task.createdBy?.id, assigneeIds: task.assignees?.map((a) => a.id) }) ? undefined : 'You can only complete tasks you created or are assigned to'}
                          aria-label={task.status === 'done' ? 'Task complete' : 'Mark task complete'}
                          className={cn(
                            'mt-1 shrink-0 h-5 w-5 rounded-full border flex items-center justify-center transition-all',
                            task.status === 'done'
                              ? 'bg-status-done/20 border-status-done'
                              : 'border-foreground/30 bg-background hover:border-foreground hover:bg-muted disabled:opacity-40 disabled:hover:border-foreground/30 disabled:hover:bg-background'
                          )}
                        >
                          {task.status === 'done' && <Check className="h-3 w-3 text-status-done" />}
                        </button>
                        <div className="min-w-0 flex-1 space-y-2">
                          {getDisplayId(projectCode, 'T', task.number) && (
                            <span className="font-mono font-semibold text-[11px] text-blue-500 block">
                              {getDisplayId(projectCode, 'T', task.number)}
                            </span>
                          )}
                          <h4 className="font-semibold text-[15px] leading-snug">{task.title}</h4>

                          {task.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                          )}

                          <div className="flex items-center flex-wrap gap-2 pt-0.5">
                            <Badge
                              variant="secondary"
                              className={cn('capitalize text-xs px-2 py-0.5 font-medium', priorityColors[task.priority])}
                            >
                              {task.priority}
                            </Badge>
                            <span
                              className={cn(
                                'flex items-center gap-1.5 text-xs font-medium',
                                moduleTextColors[moduleInfo.type] || 'text-muted-foreground'
                              )}
                            >
                              <span className={cn('h-1.5 w-1.5 rounded-full', moduleDotColors[moduleInfo.type] || 'bg-muted-foreground')} />
                              {moduleInfo.label}
                            </span>
                          </div>

                          <Separator />

                          <div className="flex items-center justify-between pt-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {checklist.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <CheckSquare className="h-3.5 w-3.5" />
                                  {completedCount}/{checklist.length}
                                </span>
                              )}
                              {checklist.length > 0 && dateRange && <span>&middot;</span>}
                              {dateRange && <span>{dateRange}</span>}
                              <AttachmentBadges
                                attachmentCounts={task.attachmentCounts}
                                videoLinksCount={task.videoLinks?.length ?? 0}
                              />
                            </div>
                            {primaryAssignee && (
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage
                                  src={resolveFileUrl(primaryAssignee.avatar) ?? primaryAssignee.avatar}
                                  alt={primaryAssignee.name}
                                />
                                <AvatarFallback
                                  className="text-[10px] text-white"
                                  style={{ backgroundColor: getFallbackTagColor(primaryAssignee.id || primaryAssignee.name) }}
                                >
                                  {primaryAssignee.initials}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Bucket Dialog — mirrors the board's "Add New Bucket" column */}
      <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add New Bucket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Bucket Name</Label>
              <Input
                placeholder="e.g., QA Testing"
                value={newColumnName}
                maxLength={30}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorSwatchPicker value={newColumnColor} onChange={setNewColumnColor} />
            </div>
            <Button
              onClick={handleAddColumn}
              disabled={!newColumnName.trim() || createTaskColumn.isPending}
              className="w-full"
            >
              Add Bucket
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TaskDetailModal
        task={selectedTask}
        allTasks={allTasksForDependencies}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTask(null);
        }}
        onUpdate={handleTaskUpdate}
        onBatchUpdate={onBatchTaskUpdate}
        onDelete={onTaskDelete}
        userProjectRole={userProjectRole}
        modules={modules}
        milestones={milestones}
        projectId={projectId}
        projectCode={projectCode}
        onAddModule={onAddModule}
        assignableMembers={assignableMembers}
      />
    </div>
  );
}
