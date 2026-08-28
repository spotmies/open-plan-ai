import { useState, useLayoutEffect, useRef } from 'react';
import { format, parseISO, startOfMonth, startOfToday } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import {
  Calendar as CalendarIcon,
  AlertTriangle,
  ListTodo,
  Box,
  Plus,
  X,
  User,
  Trash2,
  ChevronLeft,
  MoreVertical,
  Check,
  Search,
  Pencil,
  CheckCircle2,
} from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Milestone, MilestoneStatus, Task, Issue, Module, TeamMember } from '@/types';
import { getMilestoneTasks, getMilestoneModules, getMilestoneStatus, getModuleProgress, sortByAssignee } from '../utils/projectUtils';
import { resolveFileUrl } from '@/utils/fileUrl';
import { useIsMobile } from '@/hooks/use-mobile';

interface MilestoneDetailModalProps {
  milestone: Milestone | null;
  tasks: Task[];
  issues: Issue[];
  modules?: Module[];
  assignableMembers?: TeamMember[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (milestone: Milestone) => void;
  onDelete?: (milestoneId: string) => void;
  onIssueUpdate?: (issue: Issue) => void;
}

const statusConfig = {
  completed: { color: 'bg-status-done', textColor: 'text-status-done', label: 'Completed' },
  blocked: { color: 'bg-destructive', textColor: 'text-destructive', label: 'Blocked' },
  'at-risk': { color: 'bg-orange-500', textColor: 'text-orange-500', label: 'At Risk' },
  'on-track': { color: 'bg-chart-2', textColor: 'text-chart-2', label: 'On Track' },
};

// Hex colors for the mobile pill badges (inline style tint, matching ModuleDetailMobileView's approach).
const severityHex: Record<string, string> = {
  critical: '#EF4444',
  major: '#F97316',
  minor: '#EAB308',
  trivial: '#94A3B8',
};

const serializeMilestoneForDirtyCheck = (m: Milestone): string => JSON.stringify({
  title: m.title || '',
  description: m.description || '',
  date: m.date || '',
  status: m.status,
  completed: m.completed,
  linkedTaskIds: [...(m.linkedTaskIds || [])].sort(),
  linkedModuleIds: [...(m.linkedModuleIds || [])].sort(),
  assigneeId: m.assignee?.id || null,
});

export function MilestoneDetailModal({
  milestone,
  tasks,
  issues,
  modules = [],
  assignableMembers = [],
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onIssueUpdate,
}: MilestoneDetailModalProps) {
  const isMobile = useIsMobile();
  const [editedMilestone, setEditedMilestone] = useState<Milestone | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMilestoneDateOpen, setIsMilestoneDateOpen] = useState(false);
  const [isAssigneePopoverOpen, setIsAssigneePopoverOpen] = useState(false);
  const [milestoneDateCalendarMonth, setMilestoneDateCalendarMonth] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [issueSearchQuery, setIssueSearchQuery] = useState('');
  const [isAddTasksDrawerOpen, setIsAddTasksDrawerOpen] = useState(false);
  const [isAddModulesDrawerOpen, setIsAddModulesDrawerOpen] = useState(false);
  const [isAddIssuesDrawerOpen, setIsAddIssuesDrawerOpen] = useState(false);
  const [isMobileEditMode, setIsMobileEditMode] = useState(false);
  // Issue linking lives on the ISSUE side (issue.blocksMilestoneIds), not on the
  // milestone itself, so — unlike linkedTaskIds/linkedModuleIds, which are staged
  // on editedMilestone and only committed via onUpdate — it needs its own local
  // staging map: issueId -> desired linked state, only flushed as real
  // onIssueUpdate calls when "Update Milestone" is actually clicked. Without
  // this, toggling a linked issue was writing straight to the issue immediately,
  // so Cancel/close couldn't discard it.
  const [pendingIssueLinks, setPendingIssueLinks] = useState<Map<string, boolean>>(new Map());
  const initialSnapshotRef = useRef<string>('');
  // On mobile, the core fields (title, dates, status, description) stay read-only until
  // "Edit Milestone" is tapped — but linking/unlinking tasks, modules, and issues is always
  // available (mirrors ModuleDetailMobileView, where relationship management isn't gated
  // behind the name/description edit lock).
  const isMobileFieldsLocked = isMobile && !isMobileEditMode;

  useLayoutEffect(() => {
    if (!editedMilestone?.date) return;
    setMilestoneDateCalendarMonth(startOfMonth(parseISO(editedMilestone.date)));
  }, [editedMilestone?.id, editedMilestone?.date, isMilestoneDateOpen]);

  // useLayoutEffect (not useEffect) — this modal instance is reused across
  // different milestones opened one after another, so a regular useEffect
  // (which runs after paint) would show a frame of the PREVIOUS milestone's
  // data before this reset catches up: a visible flash when switching
  // milestones quickly (same fix applied to IssueDetailModal/Content and
  // TaskDetailModal).
  useLayoutEffect(() => {
    // Only set initial state when opening modal with a new milestone.
    // Seed linkedTaskIds/linkedModuleIds from the real link state (which includes
    // tasks/modules linked via their own milestoneId, not just the milestone's own
    // array) so toggling a fallback-linked item to remove it behaves symmetrically
    // instead of silently no-op'ing.
    if (isOpen && milestone) {
      const seeded: Milestone = {
        ...milestone,
        linkedTaskIds: getMilestoneTasks(milestone, tasks).map(t => t.id),
        linkedModuleIds: getMilestoneModules(milestone, modules).map(m => m.id),
      };
      setEditedMilestone(seeded);
      initialSnapshotRef.current = serializeMilestoneForDirtyCheck(seeded);
      setPendingIssueLinks(new Map());
      setTaskSearchQuery('');
      setIssueSearchQuery('');
    }
    if (!isOpen) {
      setIsMobileEditMode(false);
    }
  }, [isOpen, milestone?.id]); // Only depend on isOpen and milestone.id to prevent re-runs

  if (!editedMilestone) return null;

  const isMilestoneDirty =
    (initialSnapshotRef.current !== '' && serializeMilestoneForDirtyCheck(editedMilestone) !== initialSnapshotRef.current) ||
    pendingIssueLinks.size > 0;

  const isIssueLinked = (issue: Issue): boolean =>
    pendingIssueLinks.has(issue.id)
      ? pendingIssueLinks.get(issue.id)!
      : (issue.blocksMilestoneIds?.includes(editedMilestone.id) ?? false);

  const handleFieldChange = <K extends keyof Milestone>(field: K, value: Milestone[K]) => {
    setEditedMilestone(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  };

  const handleToggleComplete = () => {
    setEditedMilestone(prev => {
      if (!prev) return prev;
      const completed = !prev.completed;
      return {
        ...prev,
        completed,
        completedAt: completed ? new Date().toISOString() : undefined,
        status: completed ? 'completed' : prev.status,
      };
    });
  };

  const handleStatusChange = (newStatus: MilestoneStatus) => {
    setEditedMilestone(prev => {
      if (!prev) return prev;
      if (newStatus === 'completed') {
        return { ...prev, completed: true, completedAt: new Date().toISOString(), status: 'completed' };
      }
      return { ...prev, completed: false, completedAt: undefined, status: newStatus };
    });
  };

  // editedMilestone.linkedTaskIds/linkedModuleIds are seeded with the full real
  // link state (fallback-matched) when the modal opens, so from here on they are
  // the sole source of truth for "is this linked in the current edit session" —
  // falling back to the live task/module fields again (via getMilestoneTasks/
  // getMilestoneModules) would make removing a fallback-linked item a no-op,
  // since those live fields don't change until the milestone is saved.
  // Milestone assignee's own tasks/issues are surfaced first in every list below.
  const milestoneTasks = sortByAssignee(
    tasks.filter(t => editedMilestone.linkedTaskIds?.includes(t.id)),
    editedMilestone.assignee?.id,
  );
  // Reflects pendingIssueLinks on top of the real issue.blocksMilestoneIds state —
  // see isIssueLinked's comment above.
  const milestoneIssues = sortByAssignee(
    issues.filter(i => isIssueLinked(i) && i.status !== 'resolved' && i.status !== 'wont-fix'),
    editedMilestone.assignee?.id,
  );
  const status = getMilestoneStatus(editedMilestone, tasks, issues);
  const daysUntil = editedMilestone.date ? Math.ceil((new Date(editedMilestone.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : NaN;

  const completedTasks = milestoneTasks.filter(t => t.status === 'done').length;
  const inProgressTasks = milestoneTasks.filter(t => t.status === 'in-progress').length;
  const blockedTasks = milestoneTasks.filter(t => t.status === 'blocked').length;
  const progress = milestoneTasks.length === 0
    ? (editedMilestone.completed ? 100 : 0)
    : Math.round((completedTasks / milestoneTasks.length) * 100);

  // Get linked modules
  const linkedModules = modules.filter(m => editedMilestone.linkedModuleIds?.includes(m.id));

  // Available items for linking (not already linked)
  const availableTasks = tasks.filter(t => !editedMilestone.linkedTaskIds?.includes(t.id));
  const availableModules = modules.filter(m => !linkedModules.some(lm => lm.id === m.id));
  const availableIssues = issues.filter(i =>
    !milestoneIssues.some(mi => mi.id === i.id) &&
    i.status !== 'resolved' &&
    i.status !== 'wont-fix'
  );

  const filteredAvailableTasks = sortByAssignee(
    availableTasks.filter(t => t.title.toLowerCase().includes(taskSearchQuery.trim().toLowerCase())),
    editedMilestone.assignee?.id,
  );
  const filteredAvailableIssues = sortByAssignee(
    availableIssues.filter(i => i.title.toLowerCase().includes(issueSearchQuery.trim().toLowerCase())),
    editedMilestone.assignee?.id,
  );

  // Handlers for adding/removing linked items
  const handleToggleTask = (taskId: string) => {
    const currentTasks = editedMilestone.linkedTaskIds || [];
    const updated = currentTasks.includes(taskId)
      ? currentTasks.filter(id => id !== taskId)
      : [...currentTasks, taskId];
    handleFieldChange('linkedTaskIds', updated);
  };

  const handleToggleModule = (moduleId: string) => {
    const currentModules = editedMilestone.linkedModuleIds || [];
    const updated = currentModules.includes(moduleId)
      ? currentModules.filter(id => id !== moduleId)
      : [...currentModules, moduleId];
    handleFieldChange('linkedModuleIds', updated);
  };

  const handleToggleIssue = (issueId: string) => {
    if (!onIssueUpdate) return;

    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;

    // Stage only — the real issue.blocksMilestoneIds mutation is flushed in
    // handleUpdateMilestone, so Cancel/close can discard it like every other
    // field on this form.
    const nextLinked = !isIssueLinked(issue);
    setPendingIssueLinks(prev => {
      const next = new Map(prev);
      next.set(issueId, nextLinked);
      return next;
    });
  };

  const handleDelete = () => {
    if (onDelete && editedMilestone) {
      onDelete(editedMilestone.id);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  const handleUpdateMilestone = () => {
    if (editedMilestone) {
      onUpdate(editedMilestone);

      if (onIssueUpdate) {
        pendingIssueLinks.forEach((shouldBeLinked, issueId) => {
          const issue = issues.find(i => i.id === issueId);
          if (!issue) return;
          const currentMilestones = issue.blocksMilestoneIds || [];
          const isActuallyLinked = currentMilestones.includes(editedMilestone.id);
          if (isActuallyLinked === shouldBeLinked) return;
          onIssueUpdate({
            ...issue,
            blocksMilestoneIds: shouldBeLinked
              ? [...currentMilestones, editedMilestone.id]
              : currentMilestones.filter(id => id !== editedMilestone.id),
          });
        });
      }

      onClose();
    }
  };

  const canUpdate = !!editedMilestone.title.trim() && !!editedMilestone.date;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideClose={isMobile}
        className={cn(
          'p-0 flex flex-col gap-0 overflow-hidden',
          isMobile
            ? 'inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none max-h-none rounded-none border-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom duration-300 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100'
            : 'max-w-2xl max-h-[90vh] [&>button]:hidden'
        )}
      >
        {isMobile ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0 bg-background">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground active:bg-muted/70 transition-colors"
                aria-label="Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <DialogTitle className="text-[15px] font-bold truncate">Milestone Details</DialogTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground active:bg-muted/70 transition-colors"
                  aria-label="Milestone actions"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isMobileEditMode && (
                  <DropdownMenuItem onClick={() => setIsMobileEditMode(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Milestone
                  </DropdownMenuItem>
                )}
                {(isMobileEditMode || isMilestoneDirty) && (
                  <DropdownMenuItem onClick={handleUpdateMilestone} disabled={!canUpdate}>
                    <Check className="h-4 w-4 mr-2" />
                    Update Milestone
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Milestone
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between">
            <div>
              <DialogTitle>Milestone Details</DialogTitle>
              <DialogDescription className="sr-only">
                View and edit milestone information, linked tasks, modules, and issues.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label="Delete milestone"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Close milestone details"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
        )}
        {isMobile && (
          <DialogDescription className="sr-only">
            View and edit milestone information, linked tasks, modules, and issues.
          </DialogDescription>
        )}

        <ScrollArea className={cn(
          'flex-1 overflow-y-auto w-full',
          isMobile && ((isMobileEditMode || isMilestoneDirty) ? 'max-h-[calc(100dvh-129px)]' : 'max-h-[calc(100dvh-57px)]')
        )}>
          <div className={cn(isMobile ? 'px-4 py-4 space-y-5' : 'p-3 sm:p-6 space-y-3 sm:space-y-6')}>
            {isMobile ? (
              <>
                {/* Name card */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', statusConfig[status]?.color)} />
                    <Input
                      value={editedMilestone.title}
                      onChange={(e) => handleFieldChange('title', e.target.value)}
                      className="text-lg font-bold h-auto border-none shadow-none p-0 focus-visible:ring-0 flex-1 disabled:opacity-100 disabled:cursor-default"
                      placeholder="Milestone title..."
                      disabled={isMobileFieldsLocked}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="completed"
                      checked={editedMilestone.completed}
                      onCheckedChange={handleToggleComplete}
                      disabled={isMobileFieldsLocked}
                      className="disabled:opacity-100 disabled:cursor-default"
                    />
                    <Label htmlFor="completed" className="text-sm cursor-pointer text-muted-foreground">
                      Mark as complete
                    </Label>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold text-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </div>

                {/* Overview */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-0.5">Overview</h3>
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
                    <div>
                      <Label className="block text-xs text-muted-foreground uppercase tracking-wider font-medium">Description</Label>
                      {isMobileFieldsLocked ? (
                        <p className="text-sm mt-1.5 text-foreground">
                          {editedMilestone.description || <span className="text-muted-foreground">No description</span>}
                        </p>
                      ) : (
                        <Textarea
                          value={editedMilestone.description || ''}
                          onChange={(e) => handleFieldChange('description', e.target.value)}
                          placeholder="Add a description for this milestone..."
                          className="mt-1 min-h-[60px] resize-none"
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="block text-xs text-muted-foreground uppercase tracking-wider font-medium">Target Date</Label>
                        <Popover open={isMilestoneDateOpen} onOpenChange={(open) => !isMobileFieldsLocked && setIsMilestoneDateOpen(open)}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              disabled={isMobileFieldsLocked}
                              className={cn(
                                'mt-1 h-auto w-auto p-0 justify-start text-left font-bold text-sm text-foreground hover:bg-transparent disabled:opacity-100 disabled:pointer-events-none',
                                !editedMilestone.date && 'text-muted-foreground font-normal'
                              )}
                            >
                              {editedMilestone.date ? format(parseISO(editedMilestone.date), 'MMM d') : 'Select date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              month={milestoneDateCalendarMonth}
                              onMonthChange={setMilestoneDateCalendarMonth}
                              selected={editedMilestone.date ? parseISO(editedMilestone.date) : undefined}
                              onSelect={(date) => date && handleFieldChange('date', format(date, 'yyyy-MM-dd'))}
                              disabled={{ before: startOfToday() }}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label className="block text-xs text-muted-foreground uppercase tracking-wider font-medium">Status</Label>
                        <Select value={status} onValueChange={(value) => handleStatusChange(value as MilestoneStatus)} disabled={isMobileFieldsLocked}>
                          <SelectTrigger className="mt-1 h-auto w-auto border-0 p-0 shadow-none bg-transparent focus:ring-0 focus-visible:ring-0 [&>svg]:hidden disabled:opacity-100 disabled:cursor-default">
                            <SelectValue>
                              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                                <span className={cn('h-2 w-2 rounded-full shrink-0', statusConfig[status]?.color)} />
                                {statusConfig[status]?.label ?? status}
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(statusConfig) as MilestoneStatus[]).map((key) => (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <span className={cn('h-2 w-2 rounded-full shrink-0', statusConfig[key].color)} />
                                  {statusConfig[key].label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="block text-xs text-muted-foreground uppercase tracking-wider font-medium">Time Remaining</Label>
                        <p className={cn(
                          'text-sm mt-1.5 font-bold leading-tight',
                          editedMilestone.completed
                            ? 'text-status-done'
                            : daysUntil < 0
                              ? 'text-destructive'
                              : daysUntil < 7
                                ? 'text-orange-500'
                                : 'text-foreground'
                        )}>
                          {editedMilestone.completed
                            ? (editedMilestone.completedAt ? `Done ${format(new Date(editedMilestone.completedAt), 'MMM d')}` : 'Completed')
                            : isNaN(daysUntil)
                              ? 'No date set'
                              : daysUntil < 0
                                ? `${Math.abs(daysUntil)}d overdue`
                                : daysUntil === 0
                                  ? 'Due today'
                                  : `${daysUntil}d left`
                          }
                        </p>
                      </div>

                      {editedMilestone.createdBy && (
                        <div>
                          <Label className="block text-xs text-muted-foreground uppercase tracking-wider font-medium">Created By</Label>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={resolveFileUrl(editedMilestone.createdBy.avatar) ?? editedMilestone.createdBy.avatar} alt={editedMilestone.createdBy.name} />
                              <AvatarFallback className="text-[10px]">
                                {editedMilestone.createdBy.initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-bold text-foreground truncate">{editedMilestone.createdBy.name}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="block text-xs text-muted-foreground uppercase tracking-wider font-medium">Assigned To</Label>
                      <Popover open={isAssigneePopoverOpen} onOpenChange={(open) => !isMobileFieldsLocked && setIsAssigneePopoverOpen(open)}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={isMobileFieldsLocked}
                            className="flex items-center gap-2 mt-1.5 disabled:opacity-100 disabled:pointer-events-none"
                          >
                            {editedMilestone.assignee ? (
                              <>
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={resolveFileUrl(editedMilestone.assignee.avatar) ?? editedMilestone.assignee.avatar} alt={editedMilestone.assignee.name} />
                                  <AvatarFallback className="text-[10px]">{editedMilestone.assignee.initials}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-bold text-foreground truncate">{editedMilestone.assignee.name}</span>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">Unassigned</span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[260px]" align="start">
                          <Command>
                            <CommandInput placeholder="Search members..." />
                            <CommandList>
                              <CommandEmpty>No members found.</CommandEmpty>
                              <CommandGroup>
                                {editedMilestone.assignee && (
                                  <CommandItem
                                    value="unassign"
                                    onSelect={() => {
                                      handleFieldChange('assignee', null);
                                      setIsAssigneePopoverOpen(false);
                                    }}
                                    className="cursor-pointer text-muted-foreground"
                                  >
                                    <X className="h-3.5 w-3.5 mr-1" />
                                    Unassign
                                  </CommandItem>
                                )}
                                {assignableMembers
                                  .slice()
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(member => (
                                    <CommandItem
                                      key={member.id}
                                      value={`${member.id} ${member.name}`}
                                      onSelect={() => {
                                        handleFieldChange('assignee', member);
                                        setIsAssigneePopoverOpen(false);
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-5 w-5">
                                          <AvatarImage src={resolveFileUrl(member.avatar) ?? member.avatar} alt={member.name} />
                                          <AvatarFallback className="text-[9px]">{member.initials}</AvatarFallback>
                                        </Avatar>
                                        {member.name}
                                      </div>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
                      <span className="font-semibold text-sm">{milestoneTasks.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4" />
                        Completed
                      </span>
                      <span className="font-semibold text-sm">{completedTasks} / {milestoneTasks.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground pl-[22px]">In Progress</span>
                      <span className="font-semibold text-sm">{inProgressTasks}</span>
                    </div>
                    {blockedTasks > 0 && (
                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          Blocked
                        </span>
                        <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                          {blockedTasks}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Title Row */}
                <div className="space-y-2 sm:space-y-4">
                  <Input
                    value={editedMilestone.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    className="text-xl font-semibold border-none shadow-none p-0 h-auto focus-visible:ring-0 w-full"
                    placeholder="Milestone title..."
                  />

                  {/* Progress Bar */}
                  <div className="flex items-center gap-3">
                    <Progress value={progress} className="h-2 flex-1" />
                    <span className="text-sm font-medium w-12 text-right">{progress}%</span>
                    <div className="flex items-center gap-2 ml-4">
                      <Checkbox
                        id="completed"
                        checked={editedMilestone.completed}
                        onCheckedChange={handleToggleComplete}
                      />
                      <Label htmlFor="completed" className="text-sm cursor-pointer text-muted-foreground">
                        Mark as complete
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Stats Grid - Equal width/height */}
                <div className="grid grid-cols-4 gap-2 sm:gap-4">
                  <div className="flex flex-col items-center justify-center p-2 sm:p-4 bg-muted/50 rounded-lg min-h-[60px] sm:min-h-[80px]">
                    <div className="text-xl sm:text-2xl font-bold">{milestoneTasks.length}</div>
                    <div className="text-xs text-muted-foreground text-center">Total Tasks</div>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 sm:p-4 bg-status-done/10 rounded-lg min-h-[60px] sm:min-h-[80px]">
                    <div className="text-xl sm:text-2xl font-bold text-status-done">{completedTasks}</div>
                    <div className="text-xs text-muted-foreground text-center">Completed</div>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 sm:p-4 bg-status-in-progress/10 rounded-lg min-h-[60px] sm:min-h-[80px]">
                    <div className="text-xl sm:text-2xl font-bold text-status-in-progress">{inProgressTasks}</div>
                    <div className="text-xs text-muted-foreground text-center">In Progress</div>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 sm:p-4 bg-status-blocked/10 rounded-lg min-h-[60px] sm:min-h-[80px]">
                    <div className="text-xl sm:text-2xl font-bold text-status-blocked">{blockedTasks}</div>
                    <div className="text-xs text-muted-foreground text-center">Blocked</div>
                  </div>
                </div>

                <Separator />

                {/* Date and Time Remaining */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4 items-start">
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CalendarIcon className="h-3 w-3" />
                      Target Date <span className="text-destructive">*</span>
                    </Label>
                    <Popover open={isMilestoneDateOpen} onOpenChange={setIsMilestoneDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal text-xs sm:text-sm px-2 sm:px-4',
                            !editedMilestone.date && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                          {editedMilestone.date
                            ? <><span className="sm:hidden">{format(parseISO(editedMilestone.date), 'MMM d, yy')}</span><span className="hidden sm:inline">{format(parseISO(editedMilestone.date), 'PPP')}</span></>
                            : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          month={milestoneDateCalendarMonth}
                          onMonthChange={setMilestoneDateCalendarMonth}
                          selected={editedMilestone.date ? parseISO(editedMilestone.date) : undefined}
                          onSelect={(date) => date && handleFieldChange('date', format(date, 'yyyy-MM-dd'))}
                          disabled={{ before: startOfToday() }}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs text-muted-foreground">Time Remaining</Label>
                    <div className={cn(
                      'px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium leading-tight',
                      editedMilestone.completed
                        ? 'bg-status-done/10 text-status-done'
                        : daysUntil < 0
                          ? 'bg-destructive/10 text-destructive'
                          : daysUntil < 7
                            ? 'bg-orange-500/10 text-orange-500'
                            : 'bg-muted text-foreground'
                    )}>
                      {editedMilestone.completed
                        ? <><span className="sm:hidden">{editedMilestone.completedAt ? `Done ${format(new Date(editedMilestone.completedAt), 'MMM d')}` : 'Completed'}</span><span className="hidden sm:inline">{`Completed ${editedMilestone.completedAt ? format(new Date(editedMilestone.completedAt), 'MMM d, yyyy') : ''}`}</span></>
                        : isNaN(daysUntil)
                          ? 'No date set'
                          : daysUntil < 0
                            ? `${Math.abs(daysUntil)}d overdue`
                            : daysUntil === 0
                              ? 'Due today'
                              : <><span className="sm:hidden">{`${daysUntil}d left`}</span><span className="hidden sm:inline">{`${daysUntil} days remaining`}</span></>
                      }
                    </div>
                  </div>
                </div>

                {/* Status + Created By */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4 items-start">
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={status} onValueChange={(value) => handleStatusChange(value as MilestoneStatus)}>
                      <SelectTrigger className="w-full h-10 px-3 text-sm font-normal bg-muted/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(statusConfig) as MilestoneStatus[]).map((key) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <span className={cn('h-2 w-2 rounded-full shrink-0', statusConfig[key].color)} />
                              {statusConfig[key].label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editedMilestone.createdBy && (
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        Created By
                      </Label>
                      <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted/30 min-w-0">
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={resolveFileUrl(editedMilestone.createdBy.avatar) ?? editedMilestone.createdBy.avatar} alt={editedMilestone.createdBy.name} />
                          <AvatarFallback className="text-[9px]">
                            {editedMilestone.createdBy.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">{editedMilestone.createdBy.name}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Assigned To */}
                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    Assigned To
                  </Label>
                  <Popover open={isAssigneePopoverOpen} onOpenChange={setIsAssigneePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-10 justify-start px-3 text-sm font-normal bg-muted/30"
                      >
                        {editedMilestone.assignee ? (
                          <span className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={resolveFileUrl(editedMilestone.assignee.avatar) ?? editedMilestone.assignee.avatar} alt={editedMilestone.assignee.name} />
                              <AvatarFallback className="text-[9px]">{editedMilestone.assignee.initials}</AvatarFallback>
                            </Avatar>
                            {editedMilestone.assignee.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[260px]" align="start">
                      <Command>
                        <CommandInput placeholder="Search members..." />
                        <CommandList>
                          <CommandEmpty>No members found.</CommandEmpty>
                          <CommandGroup>
                            {editedMilestone.assignee && (
                              <CommandItem
                                value="unassign"
                                onSelect={() => {
                                  handleFieldChange('assignee', null);
                                  setIsAssigneePopoverOpen(false);
                                }}
                                className="cursor-pointer text-muted-foreground"
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Unassign
                              </CommandItem>
                            )}
                            {assignableMembers
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(member => (
                                <CommandItem
                                  key={member.id}
                                  value={`${member.id} ${member.name}`}
                                  onSelect={() => {
                                    handleFieldChange('assignee', member);
                                    setIsAssigneePopoverOpen(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={resolveFileUrl(member.avatar) ?? member.avatar} alt={member.name} />
                                      <AvatarFallback className="text-[9px]">{member.initials}</AvatarFallback>
                                    </Avatar>
                                    {member.name}
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Description */}
                <div className="space-y-2 sm:space-y-3">
                  <Label className="text-sm font-medium">Description</Label>
                  <Textarea
                    value={editedMilestone.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Add a description for this milestone..."
                    className="min-h-[60px] sm:min-h-[80px] resize-none"
                  />
                </div>
              </>
            )}

            {!isMobile && <Separator />}

            {/* Linked Tasks */}
            <div className="space-y-2 sm:space-y-3">
              {isMobile ? (
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked Tasks</h3>
                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">
                      {milestoneTasks.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddTasksDrawerOpen(true)}
                    className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium active:bg-muted transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Task
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <ListTodo className="h-4 w-4" />
                    Linked Tasks ({milestoneTasks.length})
                  </h3>
                </div>
              )}

              {milestoneTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center bg-muted/30 rounded-lg">
                  No tasks are linked to this milestone
                </p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {milestoneTasks.map(task => (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-center gap-3 transition-colors group',
                        isMobile ? 'rounded-xl border border-border bg-card p-3' : 'p-3 bg-muted/50 rounded-lg hover:bg-muted/70'
                      )}
                    >
                      {isMobile && (
                        <Checkbox
                          checked
                          onCheckedChange={() => handleToggleTask(task.id)}
                          className="shrink-0 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                        />
                      )}
                      {!isMobile && (
                        <div className={cn(
                          'w-2.5 h-2.5 rounded-full shrink-0',
                          task.status === 'done' ? 'bg-status-done' :
                            task.status === 'in-progress' ? 'bg-status-in-progress' :
                              task.status === 'blocked' ? 'bg-status-blocked' :
                                task.status === 'review' ? 'bg-status-review' :
                                  'bg-status-todo'
                        )} />
                      )}
                      {isMobile ? (
                        <span className={cn(
                          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize',
                          task.status === 'done' ? 'bg-status-done/10 text-status-done' :
                            task.status === 'in-progress' ? 'bg-status-in-progress/10 text-status-in-progress' :
                              task.status === 'blocked' ? 'bg-status-blocked/10 text-status-blocked' :
                                task.status === 'review' ? 'bg-status-review/10 text-status-review' :
                                  'bg-status-todo/10 text-status-todo'
                        )}>
                          {task.status.replace('-', ' ')}
                        </span>
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium truncate',
                          task.status === 'done' && 'line-through text-muted-foreground'
                        )}>
                          {task.title}
                        </p>
                        {task.assignees && task.assignees.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {task.assignees[0].name}
                            {task.assignees.length > 1 && ` +${task.assignees.length - 1}`}
                          </p>
                        )}
                      </div>
                      {!isMobile && (
                        <Badge variant="outline" className="text-xs capitalize shrink-0">
                          {task.status.replace('-', ' ')}
                        </Badge>
                      )}
                      {!isMobile && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleToggleTask(task.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Tasks Section — desktop inline; mobile uses the "Add Task" drawer above */}
              {!isMobile && availableTasks.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Add Tasks</Label>
                  <Input
                    value={taskSearchQuery}
                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="h-8 text-sm"
                  />
                  <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                    <div className="p-2 space-y-1">
                      {filteredAvailableTasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic py-2 text-center">
                          No matching tasks
                        </p>
                      ) : (
                        filteredAvailableTasks.map(task => (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleToggleTask(task.id)}
                          >
                            <Checkbox
                              checked={false}
                              onCheckedChange={() => handleToggleTask(task.id)}
                            />
                            <div className={cn(
                              'w-2 h-2 rounded-full shrink-0',
                              task.status === 'done' ? 'bg-status-done' :
                                task.status === 'in-progress' ? 'bg-status-in-progress' :
                                  task.status === 'blocked' ? 'bg-status-blocked' :
                                    'bg-status-todo'
                            )} />
                            <span className="text-sm flex-1 truncate">{task.title}</span>
                            <Badge variant="outline" className="text-xs capitalize shrink-0">
                              {task.status.replace('-', ' ')}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>


            <Separator />

            {/* Linked Modules */}
            <div className="space-y-2 sm:space-y-3">
              {isMobile ? (
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked Modules</h3>
                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">
                      {linkedModules.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddModulesDrawerOpen(true)}
                    className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium active:bg-muted transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Module
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Box className="h-4 w-4" />
                    Linked Modules ({linkedModules.length})
                  </h3>
                </div>
              )}

              {linkedModules.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center bg-muted/30 rounded-lg">
                  No modules are linked to this milestone
                </p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {linkedModules.map(module => {
                    const moduleProgress = getModuleProgress(module.id, tasks);
                    return (
                      <div
                        key={module.id}
                        className={cn(
                          'flex items-center gap-3 transition-colors group',
                          isMobile ? 'rounded-xl border border-border bg-card p-3' : 'p-3 bg-muted/50 rounded-lg hover:bg-muted/70'
                        )}
                      >
                        {isMobile && (
                          <Checkbox
                            checked
                            onCheckedChange={() => handleToggleModule(module.id)}
                            className="shrink-0 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                          />
                        )}
                        <div
                          className={cn('rounded-full shrink-0', isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3')}
                          style={{ backgroundColor: module.color || '#6B7280' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{module.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={moduleProgress} className="h-1.5 flex-1 max-w-[120px]" />
                            <span className="text-xs text-muted-foreground">{moduleProgress}%</span>
                          </div>
                        </div>
                        {isMobile ? (
                          <span
                            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize"
                            style={{ backgroundColor: `${module.color || '#6B7280'}1A`, color: module.color || '#6B7280' }}
                          >
                            {module.type}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-xs capitalize shrink-0">
                            {module.type}
                          </Badge>
                        )}
                        {!isMobile && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleToggleModule(module.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Modules Section — desktop inline; mobile uses the "Add Module" drawer above */}
              {!isMobile && availableModules.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Add Modules</Label>
                  <div className="border rounded-lg max-h-[120px] overflow-y-auto">
                    <div className="p-2 space-y-1">
                      {availableModules.map(module => (
                        <div
                          key={module.id}
                          className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleToggleModule(module.id)}
                        >
                          <Checkbox
                            checked={false}
                            onCheckedChange={() => handleToggleModule(module.id)}
                          />
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: module.color || '#6B7280' }}
                          />
                          <span className="text-sm flex-1 truncate">{module.name}</span>
                          <Badge variant="outline" className="text-xs capitalize shrink-0">
                            {module.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>


            <Separator />

            {/* Linked Issues */}
            <div className="space-y-2 sm:space-y-3">
              {isMobile ? (
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked Issues</h3>
                    {milestoneIssues.length > 0 && (
                      <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold">
                        {milestoneIssues.length}
                      </span>
                    )}
                  </div>
                  {onIssueUpdate && (
                    <button
                      type="button"
                      onClick={() => setIsAddIssuesDrawerOpen(true)}
                      className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium active:bg-muted transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Issue
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Linked Issues ({milestoneIssues.length})
                  </h3>
                </div>
              )}

              {milestoneIssues.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center bg-muted/30 rounded-lg">
                  No issues are linked to this milestone
                </p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {milestoneIssues.map(issue => {
                    const severityColor = severityHex[issue.severity] || severityHex.trivial;
                    return (
                    <div
                      key={issue.id}
                      className={cn(
                        'flex items-center gap-3 transition-colors group',
                        isMobile
                          ? 'rounded-xl border p-3'
                          : 'p-3 bg-destructive/10 rounded-lg border border-destructive/20 hover:bg-destructive/15'
                      )}
                      style={isMobile ? { borderColor: `${severityColor}33`, backgroundColor: `${severityColor}0D` } : undefined}
                    >
                      {isMobile && onIssueUpdate && (
                        <Checkbox
                          checked
                          onCheckedChange={() => handleToggleIssue(issue.id)}
                          className="shrink-0 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                        />
                      )}
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{issue.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{issue.category.replace('-', ' ')}</p>
                      </div>
                      {isMobile ? (
                        <span
                          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize"
                          style={{ backgroundColor: `${severityColor}1A`, color: severityColor }}
                        >
                          {issue.severity}
                        </span>
                      ) : (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs capitalize shrink-0',
                            issue.severity === 'critical' && 'border-destructive text-destructive',
                            issue.severity === 'major' && 'border-orange-500 text-orange-500'
                          )}
                        >
                          {issue.severity}
                        </Badge>
                      )}
                      {onIssueUpdate && !isMobile && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleToggleIssue(issue.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}

              {/* Add Issues Section — desktop inline; mobile uses the "Add Issue" drawer above */}
              {onIssueUpdate && !isMobile && availableIssues.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Add Issues</Label>
                  <Input
                    value={issueSearchQuery}
                    onChange={(e) => setIssueSearchQuery(e.target.value)}
                    placeholder="Search issues..."
                    className="h-8 text-sm"
                  />
                  <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                    <div className="p-2 space-y-1">
                      {filteredAvailableIssues.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic py-2 text-center">
                          No matching issues
                        </p>
                      ) : (
                        filteredAvailableIssues.map(issue => (
                          <div
                            key={issue.id}
                            className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleToggleIssue(issue.id)}
                          >
                            <Checkbox
                              checked={false}
                              onCheckedChange={() => handleToggleIssue(issue.id)}
                            />
                            <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                            <span className="text-sm flex-1 truncate">{issue.title}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs capitalize shrink-0',
                                issue.severity === 'critical' && 'border-destructive text-destructive',
                                issue.severity === 'major' && 'border-orange-500 text-orange-500'
                              )}
                            >
                              {issue.severity}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        {/* Footer actions — always visible on desktop; mobile shows it once "Edit Milestone" is tapped, or as soon as a task/module/issue link is toggled */}
        {(!isMobile || isMobileEditMode || isMilestoneDirty) && (
          <div className={cn(
            'border-t bg-background z-10 shrink-0 flex gap-2',
            isMobile ? 'px-4 py-3' : 'p-4 justify-end'
          )}>
            <Button variant="outline" onClick={onClose} className={cn(isMobile && 'flex-1')}>
              Cancel
            </Button>
            <Button onClick={handleUpdateMilestone} disabled={!canUpdate} className={cn(isMobile && 'flex-1')}>
              Update Milestone
            </Button>
          </div>
        )}
      </DialogContent>
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDelete}
        title="Delete Milestone"
        description="Are you sure you want to delete this milestone? This will not delete the linked tasks but will remove the milestone reference from them."
        confirmText="Delete"
        variant="destructive"
      />

      {/* Mobile "Add Linked X" pickers — bottom sheets with search + checkbox list */}
      <Drawer open={isAddTasksDrawerOpen} onOpenChange={(open) => { setIsAddTasksDrawerOpen(open); if (!open) setTaskSearchQuery(''); }}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="flex flex-row items-center justify-between gap-3 border-b pb-3">
            <DrawerTitle>Add Linked Tasks</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="p-4 space-y-3 overflow-y-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                placeholder="Search linked tasks..."
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="space-y-2 pb-2">
              {filteredAvailableTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-6 text-center">No matching tasks</p>
              ) : (
                filteredAvailableTasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => handleToggleTask(task.id)}
                  >
                    <Checkbox checked={false} onCheckedChange={() => handleToggleTask(task.id)} />
                    <div className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      task.status === 'done' ? 'bg-status-done' :
                        task.status === 'in-progress' ? 'bg-status-in-progress' :
                          task.status === 'blocked' ? 'bg-status-blocked' :
                            task.status === 'review' ? 'bg-status-review' :
                              'bg-status-todo'
                    )} />
                    <span className="text-sm flex-1 truncate">{task.title}</span>
                    <Badge variant="outline" className="text-xs capitalize shrink-0">
                      {task.status.replace('-', ' ')}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={isAddModulesDrawerOpen} onOpenChange={setIsAddModulesDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="flex flex-row items-center justify-between gap-3 border-b pb-3">
            <DrawerTitle>Add Linked Modules</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="p-4 space-y-2 overflow-y-auto pb-6">
            {availableModules.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-6 text-center">No more modules to add</p>
            ) : (
              availableModules.map(module => (
                <div
                  key={module.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleToggleModule(module.id)}
                >
                  <Checkbox checked={false} onCheckedChange={() => handleToggleModule(module.id)} />
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: module.color || '#6B7280' }}
                  />
                  <span className="text-sm flex-1 truncate">{module.name}</span>
                  <Badge variant="outline" className="text-xs capitalize shrink-0">
                    {module.type}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {onIssueUpdate && (
        <Drawer open={isAddIssuesDrawerOpen} onOpenChange={(open) => { setIsAddIssuesDrawerOpen(open); if (!open) setIssueSearchQuery(''); }}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="flex flex-row items-center justify-between gap-3 border-b pb-3">
              <DrawerTitle>Add Linked Issues</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={issueSearchQuery}
                  onChange={(e) => setIssueSearchQuery(e.target.value)}
                  placeholder="Search linked issues..."
                  className="pl-9"
                  autoFocus
                />
              </div>
              <div className="space-y-2 pb-2">
                {filteredAvailableIssues.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-6 text-center">No matching issues</p>
                ) : (
                  filteredAvailableIssues.map(issue => (
                    <div
                      key={issue.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => handleToggleIssue(issue.id)}
                    >
                      <Checkbox checked={false} onCheckedChange={() => handleToggleIssue(issue.id)} />
                      <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                      <span className="text-sm flex-1 truncate">{issue.title}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs capitalize shrink-0',
                          issue.severity === 'critical' && 'border-destructive text-destructive',
                          issue.severity === 'major' && 'border-orange-500 text-orange-500'
                        )}
                      >
                        {issue.severity}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </Dialog>
  );
}