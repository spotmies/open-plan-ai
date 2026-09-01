import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  MoreVertical,
  Edit2,
  Trash2,
  Save,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Plus,
  X,
  Search,
  ExternalLink,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { resolveFileUrl } from '@/utils/fileUrl';
import { format } from 'date-fns';
import { Module, Task, Issue, ModuleType, TeamMember } from '@/types';
import { formatModuleType, getModuleColor } from '../utils/projectUtils';
import { useProjectTaskColumns } from '@/hooks/useProjectTaskColumns';
import { DEFAULT_COLUMNS, type ProjectTaskColumn } from '@/services/projectTaskColumns.service';
import { useUIChromeStore } from '@/stores/useUIChromeStore';

interface ModuleWithStats extends Module {
  taskCount: number;
  progress: number;
  openIssues: number;
  tasks: Task[];
}

interface ModuleDetailMobileViewProps {
  module: ModuleWithStats;
  allTasks: Task[];
  allIssues: Issue[];
  teamMembers: TeamMember[];
  projectId?: string;
  onBack: () => void;
  onUpdate?: (module: Module) => Promise<boolean> | boolean | void;
  onDelete?: (moduleId: string) => void;
  onTaskClick?: (task: Task) => void;
  onIssueClick?: (issue: Issue) => void;
  onLinkTask?: (taskId: string, moduleId: string) => void;
  onLinkIssue?: (issueId: string, moduleId: string) => void;
}

const moduleTypes: ModuleType[] = [
  'hardware', 'software', 'firmware', 'testing', 'design',
  'procurement', 'manufacturing', 'qa', 'logistics', 'enclosure', 'pcb', 'power'
];

// Sentinel Select value for clearing the owner — Radix Select can't use an empty string.
const UNASSIGNED_OWNER = '__unassigned__';

const severityMeta: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#EF4444' },
  major: { label: 'Major', color: '#F97316' },
  minor: { label: 'Minor', color: '#EAB308' },
  trivial: { label: 'Trivial', color: '#94A3B8' },
};

function getSeverityMeta(severity: string) {
  return severityMeta[severity] || { label: severity, color: '#94A3B8' };
}

export function ModuleDetailMobileView({
  module,
  allTasks,
  allIssues,
  teamMembers,
  projectId,
  onBack,
  onUpdate,
  onDelete,
  onTaskClick,
  onIssueClick,
  onLinkTask,
  onLinkIssue,
}: ModuleDetailMobileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedModule, setEditedModule] = useState<Module | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddIssueOpen, setIsAddIssueOpen] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [issueSearch, setIssueSearch] = useState('');

  // Reset transient state whenever the selected module changes.
  useEffect(() => {
    setIsEditing(false);
    setEditedModule(null);
    setIsSaving(false);
    setShowDeleteConfirm(false);
    setIsAddTaskOpen(false);
    setIsAddIssueOpen(false);
    setTaskSearch('');
    setIssueSearch('');
  }, [module.id]);

  // Hide the global top app bar for the duration this full-screen mobile
  // detail view is mounted — it duplicates the back/title this screen
  // already provides in its own header below.
  useEffect(() => {
    useUIChromeStore.getState().setHideAppHeader(true);
    return () => useUIChromeStore.getState().setHideAppHeader(false);
  }, []);

  const { data: persistedColumns } = useProjectTaskColumns(projectId);
  const columns: ProjectTaskColumn[] = useMemo(() => {
    if (!projectId || !persistedColumns || persistedColumns.length === 0) return DEFAULT_COLUMNS;
    return persistedColumns;
  }, [projectId, persistedColumns]);

  const statusMeta = useMemo(() => {
    const map = new Map<string, ProjectTaskColumn>();
    columns.forEach((c) => map.set(c.status, c));
    return map;
  }, [columns]);

  const getStatusMeta = (status: string) => {
    const found = statusMeta.get(status);
    return { label: found?.label || status.replace('-', ' '), color: found?.color?.startsWith('#') ? found.color : '#94A3B8' };
  };

  const moduleTasks = useMemo(
    () => allTasks.filter((t) => t.moduleId === module.id || (t.moduleIds || []).includes(module.id)),
    [allTasks, module.id]
  );
  const moduleIssues = useMemo(
    () => allIssues.filter((i) => i.moduleId === module.id && i.status !== 'resolved'),
    [allIssues, module.id]
  );

  const availableTasks = useMemo(
    () => allTasks.filter((t) => t.moduleId !== module.id && !(t.moduleIds || []).includes(module.id)),
    [allTasks, module.id]
  );
  const availableIssues = useMemo(
    () => allIssues.filter((i) => i.moduleId !== module.id),
    [allIssues, module.id]
  );

  const filteredAvailableTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return availableTasks;
    return availableTasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [availableTasks, taskSearch]);

  const filteredAvailableIssues = useMemo(() => {
    const q = issueSearch.trim().toLowerCase();
    if (!q) return availableIssues;
    return availableIssues.filter((i) => i.title.toLowerCase().includes(q));
  }, [availableIssues, issueSearch]);

  const moduleColor = getModuleColor(module.type);
  const completedTasks = moduleTasks.filter((t) => t.status === 'done').length;
  const progress = moduleTasks.length > 0 ? (completedTasks / moduleTasks.length) * 100 : 0;

  const handleEdit = () => {
    setEditedModule({ ...module });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedModule(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editedModule || !onUpdate) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      const didSave = await onUpdate(editedModule);
      if (didSave === false) return;
      setIsEditing(false);
      setEditedModule(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    onDelete?.(module.id);
    setShowDeleteConfirm(false);
    onBack();
  };

  return (
    <div className="flex flex-col bg-background">
      {/* Sticky header — offset matches AppLayout's p-4 scroll container padding
          so the sticky boundary lands flush with the true top of the viewport. */}
      <div className="sticky -top-4 z-20 flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0 bg-background">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground active:bg-muted/70 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[15px] font-bold text-foreground truncate">Module Detail</h1>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 h-9 rounded-lg text-sm font-medium text-muted-foreground active:bg-muted transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 h-9 rounded-lg bg-foreground text-background text-sm font-semibold flex items-center gap-1.5 active:opacity-90 transition-opacity disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground active:bg-muted/70 transition-colors"
                aria-label="Module actions"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Name card */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: moduleColor }} />
            {isEditing && editedModule ? (
              <Input
                value={editedModule.name}
                onChange={(e) => setEditedModule({ ...editedModule, name: e.target.value })}
                className="text-lg font-bold h-9"
              />
            ) : (
              <h2 className="text-lg font-bold text-foreground truncate">{module.name}</h2>
            )}
          </div>
          {!isEditing && (
            <span
              className="inline-flex rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: `${moduleColor}1A`, color: moduleColor }}
            >
              {formatModuleType(module.type)}
            </span>
          )}
        </div>

        {/* Overview */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-0.5">Overview</h3>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              {isEditing && editedModule ? (
                <Textarea
                  value={editedModule.description || ''}
                  onChange={(e) => setEditedModule({ ...editedModule, description: e.target.value })}
                  className="mt-1"
                  rows={3}
                />
              ) : (
                <p className="text-sm mt-1 text-foreground break-words whitespace-pre-wrap">
                  {module.description || <span className="text-muted-foreground">No description</span>}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Module Type</Label>
                {isEditing && editedModule ? (
                  <Select
                    value={editedModule.type}
                    onValueChange={(value) => setEditedModule({ ...editedModule, type: value as ModuleType })}
                  >
                    <SelectTrigger className="mt-1 h-9">
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
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: `${moduleColor}1A`, color: moduleColor }}
                    >
                      {formatModuleType(module.type)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Owner</Label>
                {isEditing && editedModule ? (
                  <Select
                    value={editedModule.owner?.id || UNASSIGNED_OWNER}
                    onValueChange={(value) => {
                      const owner = value === UNASSIGNED_OWNER ? undefined : teamMembers.find((m) => m.id === value);
                      setEditedModule({ ...editedModule, owner });
                    }}
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_OWNER}>
                        <span className="text-muted-foreground">Unassigned</span>
                      </SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : module.owner ? (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={resolveFileUrl(module.owner.avatar) ?? module.owner.avatar} alt={module.owner.name} />
                      <AvatarFallback className="text-[10px]">{module.owner.initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">{module.owner.name}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1.5">Unassigned</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {module.createdAt && (
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p className="text-sm mt-1.5 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {format(new Date(module.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
              )}

              {module.createdBy && (
                <div>
                  <Label className="text-xs text-muted-foreground">Created By</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={resolveFileUrl(module.createdBy.avatar) ?? module.createdBy.avatar} alt={module.createdBy.name} />
                      <AvatarFallback className="text-[10px]">{module.createdBy.initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">{module.createdBy.name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-0.5">Statistics</h3>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ListTodo className="h-4 w-4" />
                Total Tasks
              </span>
              <span className="font-semibold text-sm">{moduleTasks.length}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                Completed
              </span>
              <span className="font-semibold text-sm">{completedTasks} / {moduleTasks.length}</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Progress</span>
                <span className="font-semibold text-sm">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {moduleIssues.length > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Open Issues
                </span>
                <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                  {moduleIssues.length}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Related Tasks */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Related Tasks</h3>
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">
                {moduleTasks.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsAddTaskOpen(true)}
              className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium active:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </button>
          </div>

          {moduleTasks.length > 0 ? (
            <div className="space-y-2">
              {moduleTasks.map((task) => {
                const meta = getStatusMeta(task.status);
                const assignee = task.assignees?.[0];
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                  >
                    <button
                      type="button"
                      onClick={() => onTaskClick?.(task)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <span
                        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize"
                        style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      <span className="text-sm truncate">{task.title}</span>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      {assignee && (
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={resolveFileUrl(assignee.avatar) ?? assignee.avatar} alt={assignee.name} />
                          <AvatarFallback className="text-[9px]">{assignee.initials}</AvatarFallback>
                        </Avatar>
                      )}
                      <button
                        type="button"
                        onClick={() => onTaskClick?.(task)}
                        className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 active:bg-muted/70 transition-colors"
                        aria-label={`Open ${task.title}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks linked to this module</p>
          )}
        </div>

        {/* Open Issues */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open Issues</h3>
              {moduleIssues.length > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold">
                  {moduleIssues.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsAddIssueOpen(true)}
              className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium active:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Issue
            </button>
          </div>

          {moduleIssues.length > 0 ? (
            <div className="space-y-2">
              {moduleIssues.map((issue) => {
                const meta = getSeverityMeta(issue.severity);
                return (
                  <div
                    key={issue.id}
                    className="flex items-center justify-between gap-2 rounded-xl border p-3"
                    style={{ borderColor: `${meta.color}33`, backgroundColor: `${meta.color}0D` }}
                  >
                    <button
                      type="button"
                      onClick={() => onIssueClick?.(issue)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <span
                        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
                        style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      <span className="text-sm truncate">{issue.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onIssueClick?.(issue)}
                      className="w-7 h-7 rounded-md bg-background flex items-center justify-center shrink-0 active:bg-muted transition-colors"
                      aria-label={`Open ${issue.title}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No issues linked to this module</p>
          )}
        </div>
      </div>

      {/* Add Task sheet */}
      <Sheet
        open={isAddTaskOpen}
        onOpenChange={(open) => {
          setIsAddTaskOpen(open);
          if (!open) setTaskSearch('');
        }}
      >
        <SheetContent side="bottom" hideClose className="rounded-t-3xl p-0 max-h-[85vh] flex flex-col gap-0">
          <div className="mx-auto mt-2 mb-1 h-1.5 w-10 rounded-full bg-muted shrink-0" />
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h2 className="text-base font-bold text-foreground">Add Task</h2>
            <SheetClose className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
          <div className="p-4 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {filteredAvailableTasks.length > 0 ? (
              filteredAvailableTasks.map((task) => {
                const meta = getStatusMeta(task.status);
                return (
                  <div key={task.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                      <span className="text-sm truncate flex-1">{task.title}</span>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
                        style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onLinkTask?.(task.id, module.id)}
                      className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 active:bg-muted/70 transition-colors"
                      aria-label={`Add ${task.title} to module`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No tasks available to add</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Issue sheet */}
      <Sheet
        open={isAddIssueOpen}
        onOpenChange={(open) => {
          setIsAddIssueOpen(open);
          if (!open) setIssueSearch('');
        }}
      >
        <SheetContent side="bottom" hideClose className="rounded-t-3xl p-0 max-h-[85vh] flex flex-col gap-0">
          <div className="mx-auto mt-2 mb-1 h-1.5 w-10 rounded-full bg-muted shrink-0" />
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h2 className="text-base font-bold text-foreground">Add Issue</h2>
            <SheetClose className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
          <div className="p-4 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search issues..."
                value={issueSearch}
                onChange={(e) => setIssueSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {filteredAvailableIssues.length > 0 ? (
              filteredAvailableIssues.map((issue) => {
                const meta = getSeverityMeta(issue.severity);
                return (
                  <div key={issue.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                      <span className="text-sm truncate flex-1">{issue.title}</span>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onLinkIssue?.(issue.id, module.id)}
                      className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 active:bg-muted/70 transition-colors"
                      aria-label={`Add ${issue.title} to module`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No issues available to add</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDelete}
        title="Delete Module"
        description="Are you sure you want to delete this module? This action cannot be undone and may affect associated tasks."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
