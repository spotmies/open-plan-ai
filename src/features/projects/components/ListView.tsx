import { useState } from 'react';
import { Task, Milestone, ModuleType, TeamMember } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ArrowUpDown, AlertTriangle, Link2, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TaskDetailModal } from './TaskDetailModal';
import { formatModuleType } from '../utils/projectUtils';
import { playCompleteSound } from '@/lib/playSound';
import { resolveFileUrl } from '@/utils/fileUrl';

interface ListViewProps {
  projectId?: string;
  tasks: Task[];
  allTasks?: Task[]; // All tasks for dependency resolution
  milestones?: Milestone[];
  modules?: { id: string; name: string; type: ModuleType }[];
  assignableMembers?: TeamMember[];
  onTaskClick?: (task: Task) => void;
  onTaskCreate?: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, files?: File[]) => void;
  onTaskUpdate?: (task: Task) => void;
  onBatchTaskUpdate?: (updates: Array<{ id: string; updates: Partial<Task> }>) => void;
  onTaskDelete?: (taskId: string) => void;
  userProjectRole?: string;
  onAddModule?: () => void;
}

const statusColors = {
  todo: 'bg-status-todo/20 text-muted-foreground',
  'in-progress': 'bg-status-in-progress/20 text-status-in-progress',
  review: 'bg-status-review/20 text-status-review',
  done: 'bg-status-done/20 text-status-done',
  blocked: 'bg-status-blocked/20 text-status-blocked',
};

const priorityColors = {
  critical: 'bg-priority-critical/20 text-priority-critical',
  major: 'bg-priority-high/20 text-priority-high',
  minor: 'bg-priority-medium/20 text-priority-medium',
  trivial: 'bg-priority-low/20 text-priority-low',
};

type SortField = 'title' | 'status' | 'priority' | 'module' | 'dueDate' | 'assignee';
type SortDirection = 'asc' | 'desc';

export function ListView({ tasks, allTasks: allTasksProp, milestones = [], modules = [], assignableMembers, onTaskClick, onTaskCreate, onTaskUpdate, onBatchTaskUpdate, onTaskDelete, userProjectRole, projectId, onAddModule }: ListViewProps) {
  // Use allTasks prop if provided, otherwise fallback to tasks
  const allTasksForDependencies = allTasksProp || tasks;
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'status': {
        const statusOrder = { 'blocked': 0, 'in-progress': 1, 'review': 2, 'todo': 3, 'done': 4 };
        comparison = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        break;
      }
      case 'priority': {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      }
      case 'module':
        comparison = a.module.localeCompare(b.module);
        break;
      case 'dueDate': {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        comparison = dateA - dateB;
        break;
      }
      case 'assignee':
        const nameA = a.assignees?.[0]?.name || 'zzz';
        const nameB = b.assignees?.[0]?.name || 'zzz';
        comparison = nameA.localeCompare(nameB);
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const getMilestoneName = (milestoneId?: string) => {
    if (!milestoneId) return null;
    const milestone = milestones.find(m => m.id === milestoneId);
    return milestone?.title;
  };

  const getBlockerCount = (task: Task) => {
    const taskBlockers = task.blockedBy?.length || 0;
    const issueBlockers = task.linkedIssueIds?.length || 0;
    return taskBlockers + issueBlockers;
  };

  const handleRowClick = (task: Task) => {
    if (onTaskClick) {
      onTaskClick(task);
    } else {
      setSelectedTask(task);
      setIsModalOpen(true);
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium hover:bg-transparent gap-1"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className={cn(
        'h-3 w-3',
        sortField === field ? 'opacity-100' : 'opacity-30'
      )} />
    </Button>
  );

  // Create a new task template for the create modal
  const newTaskTemplate: Task = {
    id: '',
    title: '',
    description: '',
    status: 'todo',
    priority: 'minor',
    module: '' as ModuleType,
    blockedBy: [],
    tags: [],
    assignees: [],
    checklist: [],
    comments: [],
    attachments: [],
    linkedIssueIds: [],
    moduleId: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const handleCompleteTask = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const updatedTask = { ...task, status: 'done' as const };
    playCompleteSound();
    if (onTaskUpdate) {
      onTaskUpdate(updatedTask);
    }
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    // Only update selected task if it's the one currently being viewed
    if (selectedTask && selectedTask.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }
    // Call the parent callback
    if (onTaskUpdate) {
      onTaskUpdate(updatedTask);
    }
  };

  const handleTaskCreate = (newTask: Task, pendingFiles?: File[]) => {
    if (onTaskCreate) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, createdAt, updatedAt, ...taskWithoutIds } = newTask;
      onTaskCreate(taskWithoutIds, pendingFiles);
    }
    setIsCreateModalOpen(false);
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <p className="text-muted-foreground">No tasks to display</p>
        {onTaskCreate && (
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Task
          </Button>
        )}
        {/* Create Task Modal */}
        <TaskDetailModal
          task={newTaskTemplate}
          allTasks={allTasksForDependencies}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onUpdate={() => { }}
          mode="create"
          onCreate={handleTaskCreate}
          modules={modules}
          projectId={projectId}
          onAddModule={onAddModule}
          assignableMembers={assignableMembers}
        />
      </div>
    );
  }

  return (
    <>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">
                <SortableHeader field="title">Task</SortableHeader>
              </TableHead>
              <TableHead>
                <SortableHeader field="status">Status</SortableHeader>
              </TableHead>
              <TableHead>
                <SortableHeader field="priority">Priority</SortableHeader>
              </TableHead>
              <TableHead>
                <SortableHeader field="module">Module</SortableHeader>
              </TableHead>
              <TableHead>Milestone</TableHead>
              <TableHead>
                <SortableHeader field="assignee">Assignee</SortableHeader>
              </TableHead>
              <TableHead>
                <SortableHeader field="dueDate">Due Date</SortableHeader>
              </TableHead>
              <TableHead className="w-[80px] text-center">Blockers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTasks.map((task) => {
              const blockerCount = getBlockerCount(task);
              const milestoneName = getMilestoneName(task.milestoneId);

              return (
                <TableRow
                  key={task.id}
                  className="cursor-pointer hover:bg-muted/50 h-[72px]"
                  onClick={() => handleRowClick(task)}
                >
                  <TableCell className="align-middle">
                    <div className="flex items-start gap-2">
                      {blockerCount > 0 && (
                        <AlertTriangle className="h-4 w-4 text-status-blocked shrink-0 mt-0.5" />
                      )}
                      {task.status === 'done' ? (
                        <div className="h-4 w-4 rounded-full bg-status-done/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="h-3 w-3 text-status-done" />
                        </div>
                      ) : (
                        <button
                          onClick={(e) => handleCompleteTask(e, task)}
                          className="h-4 w-4 rounded-full border border-foreground/30 flex items-center justify-center hover:border-foreground hover:bg-muted transition-all bg-background shrink-0 mt-0.5"
                        >
                          <Check className="h-3 w-3 text-foreground opacity-0 hover:opacity-100" />
                        </button>
                      )}
                      <div className="min-w-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="font-medium line-clamp-2 cursor-pointer">{task.title}</p>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            {task.title}
                          </TooltipContent>
                        </Tooltip>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn('capitalize', statusColors[task.status])}>
                      {task.status.replace('-', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn('capitalize', priorityColors[task.priority])}>
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {task.moduleIds && task.moduleIds.length > 0 ? (
                        task.moduleIds.map((id) => {
                          const module = modules.find(m => m.id === id);
                          return module ? (
                            <Badge key={id} variant="outline" className="text-[10px] px-1 py-0 h-5">
                              {module.name}
                            </Badge>
                          ) : null;
                        })
                      ) : (
                        <span className="text-sm">{formatModuleType(task.module)}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {milestoneName ? (
                      <Badge variant="outline" className="text-xs">
                        {milestoneName}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.assignees && task.assignees.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={resolveFileUrl(task.assignees[0].avatar) ?? task.assignees[0].avatar} alt={task.assignees[0].name} />
                          <AvatarFallback className="text-[10px]">
                            {task.assignees[0].initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {task.assignees[0].name}
                          {task.assignees.length > 1 && ` +${task.assignees.length - 1}`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.dueDate ? (
                      <span className="text-sm">
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">No date</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {blockerCount > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <Link2 className="h-3 w-3" />
                        {blockerCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Task Detail Modal */}
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
        projectId={projectId}
        onAddModule={onAddModule}
        assignableMembers={assignableMembers}
      />

      {/* Create Task Modal */}
      <TaskDetailModal
        task={newTaskTemplate as Task}
        allTasks={allTasksForDependencies}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onUpdate={() => { }} // Not used in create mode
        onBatchUpdate={onBatchTaskUpdate}
        mode="create"
        onCreate={handleTaskCreate}
        modules={modules}
        projectId={projectId}
        onAddModule={onAddModule}
        assignableMembers={assignableMembers}
      />
    </>
  );
}
