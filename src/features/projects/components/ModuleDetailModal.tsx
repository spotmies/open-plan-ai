import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveFileUrl } from '@/utils/fileUrl';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  ListTodo,
  Users,
  Calendar,
  Edit2,
  Trash2,
  ExternalLink,
  X,
  Link,
  Plus,
} from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Module, Task, Issue, ModuleType, TeamMember } from '@/types';
import { formatModuleType, getModuleColor, getModuleTasks, getModuleProgress } from '../utils/projectUtils';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ModuleWithStats extends Module {
  taskCount: number;
  progress: number;
  openIssues: number;
  tasks: Task[];
}

interface ModuleDetailModalProps {
  module: ModuleWithStats | null;
  allTasks: Task[];
  allIssues: Issue[];
  teamMembers: TeamMember[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (module: Module) => Promise<boolean> | boolean | void;
  onDelete?: (moduleId: string) => void;
  onTaskClick?: (task: Task) => void;
  onIssueClick?: (issue: Issue) => void;
  onLinkTask?: (taskId: string, moduleId: string) => void;
  onUnlinkTask?: (taskId: string, moduleId: string) => void;
  onLinkIssue?: (issueId: string, moduleId: string) => void;
  onUnlinkIssue?: (issueId: string, moduleId: string) => void;
}

const moduleTypes: ModuleType[] = [
  'hardware', 'software', 'firmware', 'testing', 'design',
  'procurement', 'manufacturing', 'qa', 'logistics', 'enclosure', 'pcb', 'power'
];

export function ModuleDetailModal({
  module,
  allTasks,
  allIssues,
  teamMembers,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onTaskClick,
  onIssueClick,
  onLinkTask,
  onUnlinkTask,
  onLinkIssue,
  onUnlinkIssue,
}: ModuleDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedModule, setEditedModule] = useState<Module | null>(null);
  const [isLinkingTasks, setIsLinkingTasks] = useState(false);
  const [isLinkingIssues, setIsLinkingIssues] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Baseline snapshot to diff against so blurring/tabbing without changing a
  // field's value doesn't fire an unnecessary update.
  const savedModuleRef = useRef<Module | null>(null);

  // Reset transient editing state when dialog closes or when selecting a different module.
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setEditedModule(null);
      setIsLinkingTasks(false);
      setIsLinkingIssues(false);
      setIsSaving(false);
      return;
    }

    setIsEditing(false);
    setEditedModule(null);
    setIsLinkingTasks(false);
    setIsLinkingIssues(false);
  }, [isOpen, module?.id]);

  // Get available tasks and issues that can be linked (must be before early return)
  const availableTasks = useMemo(() =>
    module
      ? allTasks.filter(t => t.moduleId !== module.id && !(t.moduleIds || []).includes(module.id))
      : [],
    [allTasks, module]
  );

  const availableIssues = useMemo(() =>
    module ? allIssues.filter(i => i.moduleId !== module.id) : [],
    [allIssues, module]
  );

  const moduleTasks = useMemo(() =>
    module
      ? allTasks.filter(t => t.moduleId === module.id || (t.moduleIds || []).includes(module.id))
      : [],
    [allTasks, module]
  );
  const moduleIssues = useMemo(() =>
    module
      ? allIssues.filter(i => i.moduleId === module.id && i.status !== 'resolved')
      : [],
    [allIssues, module]
  );

  if (!module) return null;

  const moduleColor = getModuleColor(module.type);
  const completedTasks = moduleTasks.filter(t => t.status === 'done').length;
  const progress = moduleTasks.length > 0 ? (completedTasks / moduleTasks.length) * 100 : 0;

  const handleEdit = () => {
    const snapshot = { ...module };
    setEditedModule(snapshot);
    savedModuleRef.current = snapshot;
    setIsEditing(true);
  };

  // Persists a field change immediately so there's no separate "Update Module" step.
  const commitFieldUpdate = async (updated: Module) => {
    if (!onUpdate) return;
    setIsSaving(true);
    try {
      await onUpdate(updated);
      savedModuleRef.current = updated;
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (patch: Partial<Module>) => {
    if (!editedModule) return;
    setEditedModule({ ...editedModule, ...patch });
  };

  const handleFieldBlur = () => {
    if (!editedModule) return;
    const saved = savedModuleRef.current;
    // Tabbing/clicking away without actually editing shouldn't fire an update.
    if (saved && saved.name === editedModule.name && saved.description === editedModule.description) {
      return;
    }
    commitFieldUpdate(editedModule);
  };

  const handleSelectFieldChange = (patch: Partial<Module>) => {
    if (!editedModule) return;
    const updated = { ...editedModule, ...patch };
    setEditedModule(updated);
    commitFieldUpdate(updated);
  };

  const handleDone = () => {
    // Flush any change still pending from the field that just lost focus —
    // don't rely on the blur handler having already resolved, since Done can
    // be reached via keyboard/synthetic activation without a prior blur.
    if (editedModule) {
      const saved = savedModuleRef.current;
      if (!saved || saved.name !== editedModule.name || saved.description !== editedModule.description) {
        commitFieldUpdate(editedModule);
      }
    }
    setEditedModule(null);
    setIsLinkingTasks(false);
    setIsLinkingIssues(false);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(module.id);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  const handleLinkTask = (taskId: string) => {
    if (onLinkTask) {
      onLinkTask(taskId, module.id);
    }
  };

  const handleUnlinkTask = (taskId: string) => {
    if (onUnlinkTask) {
      onUnlinkTask(taskId, module.id);
    }
  };

  const handleLinkIssue = (issueId: string) => {
    if (onLinkIssue) {
      onLinkIssue(issueId, module.id);
    }
  };

  const handleUnlinkIssue = (issueId: string) => {
    if (onUnlinkIssue) {
      onUnlinkIssue(issueId, module.id);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-status-done text-white';
      case 'in-progress': return 'bg-status-in-progress text-white';
      case 'review': return 'bg-status-review text-white';
      case 'blocked': return 'bg-status-blocked text-white';
      default: return 'bg-status-todo text-white';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'major': return 'bg-orange-500 text-white';
      case 'minor': return 'bg-yellow-500 text-black';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[90vh] p-0 flex flex-col gap-0 overflow-hidden [&>button]:hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogDescription className="sr-only">
            View and edit module details, linked tasks, and linked issues.
          </DialogDescription>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: moduleColor }}
              />
              {isEditing && editedModule ? (
                <Input
                  value={editedModule.name}
                  onChange={(e) => handleFieldChange({ name: e.target.value })}
                  onBlur={handleFieldBlur}
                  className="text-lg font-semibold h-8 min-w-0"
                />
              ) : (
                <DialogTitle className="text-xl truncate max-w-full" title={module.name}>{module.name}</DialogTitle>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isEditing ? (
                <Button variant="outline" size="sm" onClick={handleDone}>
                  {isSaving ? 'Saving...' : 'Done'}
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-destructive border-destructive/30 hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close module details"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-6 pb-6 space-y-6">
              {/* Overview Section */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    {isEditing && editedModule ? (
                      <Textarea
                        value={editedModule.description || ''}
                        onChange={(e) => handleFieldChange({ description: e.target.value })}
                        onBlur={handleFieldBlur}
                        className="mt-1"
                        rows={3}
                      />
                    ) : (
                      <p className="text-sm mt-1 break-words whitespace-pre-wrap">
                        {module.description || <span className="text-muted-foreground">No description</span>}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Module Type</Label>
                    {isEditing && editedModule ? (
                      <Select
                        value={editedModule.type}
                        onValueChange={(value) => handleSelectFieldChange({ type: value as ModuleType })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {moduleTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {formatModuleType(type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1">
                        <Badge variant="secondary" className="capitalize">
                          {formatModuleType(module.type)}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Owner</Label>
                    {isEditing && editedModule ? (
                      <Select
                        value={editedModule.owner?.id || ''}
                        onValueChange={(value) => {
                          const owner = teamMembers.find(m => m.id === value);
                          handleSelectFieldChange({ owner });
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select owner" />
                        </SelectTrigger>
                        <SelectContent>
                          {teamMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={resolveFileUrl(member.avatar) ?? member.avatar} alt={member.name} />
                                  <AvatarFallback className="text-[9px]">{member.initials}</AvatarFallback>
                                </Avatar>
                                {member.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : module.owner ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={resolveFileUrl(module.owner.avatar) ?? module.owner.avatar} alt={module.owner.name} />
                          <AvatarFallback className="text-[10px]">{module.owner.initials}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{module.owner.name}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">Unassigned</p>
                    )}
                  </div>

                  {module.createdAt && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Created</Label>
                      <p className="text-sm mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(module.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}

                  {module.createdBy && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Created By</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={resolveFileUrl(module.createdBy.avatar) ?? module.createdBy.avatar} alt={module.createdBy.name} />
                          <AvatarFallback className="text-[9px]">{module.createdBy.initials}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{module.createdBy.name}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Statistics */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium text-sm">Statistics</h4>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <ListTodo className="h-4 w-4" />
                        Total Tasks
                      </span>
                      <span className="font-medium">{moduleTasks.length}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        Completed
                      </span>
                      <span className="font-medium">{completedTasks} / {moduleTasks.length}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Progress</span>
                        <span className="font-medium">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {moduleIssues.length > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          Open Issues
                        </span>
                        <Badge variant="destructive">{moduleIssues.length}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Related Tasks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Related Tasks</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{moduleTasks.length}</Badge>
                    {onLinkTask && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsLinkingTasks(!isLinkingTasks)}
                        className="h-7"
                      >
                        <Link className="h-3.5 w-3.5 mr-1" />
                        {isLinkingTasks ? 'Done' : 'Link'}
                      </Button>
                    )}
                  </div>
                </div>

                {isLinkingTasks && availableTasks.length > 0 && (
                  <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                    <Label className="text-xs font-medium">Link Tasks to Module</Label>
                    <Select onValueChange={handleLinkTask}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select task to link..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            <div className="flex items-center gap-2">
                              <Badge className={cn('text-[10px]', getStatusBadgeColor(task.status))}>
                                {task.status.replace('-', ' ')}
                              </Badge>
                              <span className="truncate">{task.title}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {moduleTasks.length > 0 ? (
                  <div className="space-y-2">
                    {moduleTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                      >
                        <div
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                          onClick={() => onTaskClick?.(task)}
                        >
                          <Badge className={cn('text-[10px] shrink-0', getStatusBadgeColor(task.status))}>
                            {task.status.replace('-', ' ')}
                          </Badge>
                          <span className="text-sm truncate">{task.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(task.assignees?.length ?? 0) > 0 && (
                            <div className="flex -space-x-2">
                              {task.assignees!.slice(0, 3).map((assignee) => (
                                <Avatar key={assignee.id} className="h-5 w-5 border-2 border-background">
                                  <AvatarImage src={resolveFileUrl(assignee.avatar) ?? assignee.avatar} alt={assignee.name} />
                                  <AvatarFallback className="text-[9px]">
                                    {assignee.initials}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {task.assignees!.length > 3 && (
                                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center border-2 border-background z-10">
                                  <span className="text-[8px] text-muted-foreground font-medium">
                                    +{task.assignees!.length - 3}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          {onUnlinkTask && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlinkTask(task.id);
                              }}
                            >
                              Unlink
                            </Button>
                          )}
                          <ExternalLink
                            className="h-3.5 w-3.5 text-muted-foreground cursor-pointer"
                            onClick={() => onTaskClick?.(task)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No tasks linked to this module
                  </p>
                )}
              </div>

              {/* Related Issues */}
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Open Issues
                  </h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{moduleIssues.length}</Badge>
                    {onLinkIssue && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsLinkingIssues(!isLinkingIssues)}
                        className="h-7"
                      >
                        <Link className="h-3.5 w-3.5 mr-1" />
                        {isLinkingIssues ? 'Done' : 'Link'}
                      </Button>
                    )}
                  </div>
                </div>

                {isLinkingIssues && availableIssues.length > 0 && (
                  <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                    <Label className="text-xs font-medium">Link Issues to Module</Label>
                    <Select onValueChange={handleLinkIssue}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select issue to link..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableIssues.map((issue) => (
                          <SelectItem key={issue.id} value={issue.id}>
                            <div className="flex items-center gap-2">
                              <Badge className={cn('text-[10px]', getSeverityBadgeColor(issue.severity))}>
                                {issue.severity}
                              </Badge>
                              <span className="truncate">{issue.title}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {moduleIssues.length > 0 ? (
                  <div className="space-y-2">
                    {moduleIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors group"
                      >
                        <div
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                          onClick={() => onIssueClick?.(issue)}
                        >
                          <Badge className={cn('text-[10px] shrink-0', getSeverityBadgeColor(issue.severity))}>
                            {issue.severity}
                          </Badge>
                          <span className="text-sm truncate">{issue.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {onUnlinkIssue && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlinkIssue(issue.id);
                              }}
                            >
                              Unlink
                            </Button>
                          )}
                          <ExternalLink
                            className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-pointer"
                            onClick={() => onIssueClick?.(issue)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No issues linked to this module
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

      </DialogContent>
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDelete}
        title="Delete Module"
        description="Are you sure you want to delete this module? This action cannot be undone and may affect associated tasks."
        confirmText="Delete"
        variant="destructive"
      />
    </Dialog>
  );
}
