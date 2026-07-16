import { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfMonth, startOfToday } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { cn } from '@/lib/utils';
import {
  Calendar as CalendarIcon,
  ListTodo,
  Box,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { Milestone, Task, Issue, Module } from '@/types';

const milestoneSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  date: z.date({ required_error: 'Target date is required' }),
  linkedTaskIds: z.array(z.string()).optional(),
  linkedModuleIds: z.array(z.string()).optional(),
  linkedIssueIds: z.array(z.string()).optional(),
});

type MilestoneFormData = z.infer<typeof milestoneSchema>;

interface AddMilestoneDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (milestone: Omit<Milestone, 'id'>) => void;
  tasks: Task[];
  modules: Module[];
  issues: Issue[];
  /** Aligns the calendar with the project schedule when picking a target date */
  projectStartDate?: Date;
}

export function AddMilestoneDialog({
  isOpen,
  onClose,
  onAdd,
  tasks,
  modules,
  issues,
  projectStartDate,
}: AddMilestoneDialogProps) {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  const [targetDateCalendarMonth, setTargetDateCalendarMonth] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const form = useForm<MilestoneFormData>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: {
      title: '',
      description: '',
      linkedTaskIds: [],
      linkedModuleIds: [],
      linkedIssueIds: [],
    },
  });

  useLayoutEffect(() => {
    if (!isOpen) return;
    const picked = form.getValues('date');
    setTargetDateCalendarMonth(startOfMonth(picked ?? projectStartDate ?? new Date()));
  }, [isOpen, projectStartDate, form]);

  const handleSubmit = (data: MilestoneFormData) => {
    const milestone: Omit<Milestone, 'id'> = {
      title: data.title,
      description: data.description,
      date: format(data.date, 'yyyy-MM-dd'),
      completed: false,
      linkedTaskIds: selectedTasks,
      linkedModuleIds: selectedModules,
      linkedIssueIds: selectedIssues,
    };

    onAdd(milestone);
    onClose();
  };

  const isFormDirty =
    form.formState.isDirty ||
    selectedTasks.length > 0 ||
    selectedModules.length > 0 ||
    selectedIssues.length > 0;

  const resetAndClose = () => {
    form.reset();
    setSelectedTasks([]);
    setSelectedModules([]);
    setSelectedIssues([]);
    setTaskSearch('');
    setModuleSearch('');
    setIssueSearch('');
    onClose();
  };

  const attemptClose = () => {
    if (isFormDirty) {
      setShowDiscardConfirm(true);
    } else {
      resetAndClose();
    }
  };

  const toggleTask = useCallback((taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  }, []);

  const toggleModule = useCallback((moduleId: string) => {
    setSelectedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  }, []);

  const toggleIssue = useCallback((issueId: string) => {
    setSelectedIssues(prev =>
      prev.includes(issueId)
        ? prev.filter(id => id !== issueId)
        : [...prev, issueId]
    );
  }, []);

  const severityColors: Record<string, string> = {
    critical: 'border-destructive text-destructive bg-destructive/10',
    major: 'border-orange-500 text-orange-500 bg-orange-500/10',
    minor: 'border-yellow-500 text-yellow-500 bg-yellow-500/10',
    trivial: 'border-muted-foreground text-muted-foreground bg-muted',
  };

  const openIssues = issues.filter(i =>
    i.status !== 'resolved' && i.status !== 'wont-fix'
  );

  // Filtered lists based on search
  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(taskSearch.toLowerCase())
  );

  const filteredModules = modules.filter(module =>
    module.name.toLowerCase().includes(moduleSearch.toLowerCase())
  );

  const filteredIssues = openIssues.filter(issue =>
    issue.title.toLowerCase().includes(issueSearch.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && attemptClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Add Milestone</DialogTitle>
          {/* <DialogDescription>
            Create a new milestone to track project progress and deadlines.
          </DialogDescription> */}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1">
              <div className="p-6 space-y-6">
                {/* Title Field */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter milestone title..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description Field */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add a description for this milestone..."
                          className="min-h-[80px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Target Date */}
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Target Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            month={targetDateCalendarMonth}
                            onMonthChange={setTargetDateCalendarMonth}
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={{ before: startOfToday() }}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Linked Tasks */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ListTodo className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">
                        Linked Tasks ({selectedTasks.length})
                      </Label>
                    </div>
                  </div>
                  {tasks.length > 0 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search tasks..."
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                  )}
                  <div className="border rounded-lg max-h-[160px] overflow-y-auto">
                    {tasks.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">
                        No tasks available
                      </p>
                    ) : filteredTasks.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">
                        No tasks match your search
                      </p>
                    ) : (
                      <div className="p-2 space-y-1">
                        {filteredTasks.map(task => (
                          <div
                            key={task.id}
                            className={cn(
                              'flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors',
                              selectedTasks.includes(task.id) && 'bg-primary/5'
                            )}
                          >
                            <Checkbox
                              checked={selectedTasks.includes(task.id)}
                              onCheckedChange={() => toggleTask(task.id)}
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
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Linked Modules */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Box className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">
                        Linked Modules ({selectedModules.length})
                      </Label>
                    </div>
                  </div>
                  {modules.length > 0 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search modules..."
                        value={moduleSearch}
                        onChange={(e) => setModuleSearch(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                  )}
                  <div className="border rounded-lg max-h-[160px] overflow-y-auto">
                    {modules.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">
                        No modules available
                      </p>
                    ) : filteredModules.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">
                        No modules match your search
                      </p>
                    ) : (
                      <div className="p-2 space-y-1">
                        {filteredModules.map(module => (
                          <div
                            key={module.id}
                            className={cn(
                              'flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors',
                              selectedModules.includes(module.id) && 'bg-primary/5'
                            )}
                          >
                            <Checkbox
                              checked={selectedModules.includes(module.id)}
                              onCheckedChange={() => toggleModule(module.id)}
                            />
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: module.color || '#6B7280' }}
                            />
                            <span className="text-sm flex-1 truncate">{module.name}</span>
                            <Badge variant="outline" className="text-xs capitalize shrink-0">
                              {module.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Linked Issues */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">
                        Linked Issues ({selectedIssues.length})
                      </Label>
                    </div>
                  </div>
                  {openIssues.length > 0 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search issues..."
                        value={issueSearch}
                        onChange={(e) => setIssueSearch(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                  )}
                  <div className="border rounded-lg max-h-[160px] overflow-y-auto">
                    {openIssues.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">
                        No open issues available
                      </p>
                    ) : filteredIssues.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">
                        No issues match your search
                      </p>
                    ) : (
                      <div className="p-2 space-y-1">
                        {filteredIssues.map(issue => (
                          <div
                            key={issue.id}
                            className={cn(
                              'flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors',
                              selectedIssues.includes(issue.id) && 'bg-primary/5'
                            )}
                          >
                            <Checkbox
                              checked={selectedIssues.includes(issue.id)}
                              onCheckedChange={() => toggleIssue(issue.id)}
                            />
                            <span className="text-sm flex-1 truncate">{issue.title}</span>
                            <Badge className={cn('text-xs capitalize shrink-0', severityColors[issue.severity])}>
                              {issue.severity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t shrink-0">
              <Button type="button" variant="outline" onClick={attemptClose}>
                Cancel
              </Button>
              <Button type="submit">
                Create Milestone
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      <ConfirmationDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        onConfirm={resetAndClose}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to discard them?"
        confirmText="Discard"
        cancelText="Keep Editing"
        variant="destructive"
      />
    </Dialog>
  );
}