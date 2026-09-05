import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Filter, Flag, CheckSquare, FolderKanban, UserCheck, CalendarClock, CalendarIcon, Tag, CalendarPlus, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { MyDayItem, MyDayItemType, MyTasksColumnFilters } from '@/types';
import { getItemTags } from '../utils/myDayUtils';

/** Shared "pick an exact date" control for the Reported Date / Completed Date filters. */
function DateFilterField({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-9 w-full justify-start gap-2 text-left font-normal">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {value ? (
              <span className="truncate">{format(new Date(value), 'PPP')}</span>
            ) : (
              <span className="truncate text-muted-foreground">Any date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarPicker
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : undefined)}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={() => onChange(undefined)}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

interface MyTasksFiltersDropdownProps {
  items: MyDayItem[];
  filters: MyTasksColumnFilters;
  onFiltersChange: (filters: MyTasksColumnFilters) => void;
  className?: string;
}

const typeOptions = [
  { value: 'task', label: 'Task' },
  { value: 'issue', label: 'Issue' },
];

const taskStatusOptions = [
  { value: 'todo', label: 'Todo' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

const issueStatusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'wont-fix', label: "Won't Fix" },
];

const priorityOptions = [
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'trivial', label: 'Trivial' },
];

const dueDateOptions = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'no-date', label: 'No Date' },
  { value: 'custom', label: 'Custom' },
];

export function MyTasksFiltersDropdown({ items, filters, onFiltersChange, className }: MyTasksFiltersDropdownProps) {
  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    items.forEach((item) => {
      if (item.projectId && !seen.has(item.projectId)) {
        seen.set(item.projectId, item.projectName || item.projectId);
      }
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [items]);

  const tagOptions = useMemo(() => {
    const seen = new Set<string>();
    items.forEach((item) => {
      getItemTags(item).forEach((tag) => seen.add(tag));
    });
    return Array.from(seen)
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ value: tag, label: tag }));
  }, [items]);

  const assignedByOptions = useMemo(() => {
    const seen = new Map<string, string>();
    items.forEach((item) => {
      const assignedBy = item.itemType === 'task' ? item.originalTask?.createdBy : item.originalIssue?.reportedBy;
      if (assignedBy?.id && !seen.has(assignedBy.id)) {
        seen.set(assignedBy.id, assignedBy.name || assignedBy.email || assignedBy.id);
      }
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [items]);

  const statusOptions = useMemo(() => {
    const selectedTypes = filters.type || [];
    const includeTask = selectedTypes.includes('task');
    const includeIssue = selectedTypes.includes('issue');
    if (includeTask && includeIssue) return [...taskStatusOptions, ...issueStatusOptions];
    if (includeIssue) return issueStatusOptions;
    if (includeTask) return taskStatusOptions;
    return [];
  }, [filters.type]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.type?.length) count++;
    if (filters.status?.length) count++;
    if (filters.priority?.length) count++;
    if (filters.projectIds?.length) count++;
    if (filters.assignedByIds?.length) count++;
    if (filters.dueDate || filters.dueDateCustom) count++;
    if (filters.tags?.length) count++;
    if (filters.reportedDateCustom) count++;
    if (filters.completedDateCustom) count++;
    return count;
  }, [filters]);

  const [open, setOpen] = useState(false);
  const [showCustomDueDate, setShowCustomDueDate] = useState(!!filters.dueDateCustom);
  const clearAll = () => {
    onFiltersChange({});
    setShowCustomDueDate(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2 h-9 rounded-lg", className)}>
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filter</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Filter Tasks</h4>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 px-2 text-xs">
                Clear all
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              Type
            </Label>
            <MultiSelect
              options={typeOptions}
              selected={filters.type || []}
              onChange={(values) => {
                const nextTypes = values.length ? (values as MyDayItemType[]) : undefined;
                const allowedStatuses = new Set(
                  [
                    ...(nextTypes?.includes('task') ? taskStatusOptions : []),
                    ...(nextTypes?.includes('issue') ? issueStatusOptions : []),
                  ].map((option) => option.value)
                );
                const nextStatus = filters.status?.filter((value) => allowedStatuses.has(value));
                onFiltersChange({
                  ...filters,
                  type: nextTypes,
                  status: nextStatus?.length ? nextStatus : undefined,
                });
              }}
              placeholder="All Types"
            />
          </div>

          {statusOptions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <MultiSelect
                options={statusOptions}
                selected={filters.status || []}
                onChange={(values) => onFiltersChange({ ...filters, status: values.length ? values : undefined })}
                placeholder="All Status"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Flag className="h-3 w-3" />
              Priority
            </Label>
            <MultiSelect
              options={priorityOptions}
              selected={filters.priority || []}
              onChange={(values) => onFiltersChange({ ...filters, priority: values.length ? values : undefined })}
              placeholder="All Priorities"
            />
          </div>

          {projectOptions.length > 1 && (
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <FolderKanban className="h-3 w-3" />
                Project
              </Label>
              <MultiSelect
                options={projectOptions}
                selected={filters.projectIds || []}
                onChange={(values) => onFiltersChange({ ...filters, projectIds: values.length ? values : undefined })}
                placeholder="All Projects"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <UserCheck className="h-3 w-3" />
              Assigned By
            </Label>
            <MultiSelect
              options={assignedByOptions}
              selected={filters.assignedByIds || []}
              onChange={(values) => onFiltersChange({ ...filters, assignedByIds: values.length ? values : undefined })}
              placeholder="Anyone"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              Due Date
            </Label>
            <Select
              value={showCustomDueDate ? 'custom' : (filters.dueDate || 'all')}
              onValueChange={(value) => {
                if (value === 'custom') {
                  setShowCustomDueDate(true);
                  onFiltersChange({ ...filters, dueDate: undefined });
                } else {
                  setShowCustomDueDate(false);
                  onFiltersChange({
                    ...filters,
                    dueDate: value === 'all' ? undefined : (value as MyTasksColumnFilters['dueDate']),
                    dueDateCustom: undefined,
                  });
                }
              }}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Any Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Date</SelectItem>
                {dueDateOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showCustomDueDate && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full justify-start gap-2 text-left font-normal"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {filters.dueDateCustom ? (
                      <span className="truncate">{format(new Date(filters.dueDateCustom), 'PPP')}</span>
                    ) : (
                      <span className="truncate text-muted-foreground">Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={filters.dueDateCustom ? new Date(filters.dueDateCustom) : undefined}
                    onSelect={(date) =>
                      onFiltersChange({
                        ...filters,
                        dueDateCustom: date ? format(date, 'yyyy-MM-dd') : undefined,
                        dueDate: undefined,
                      })
                    }
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {tagOptions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Tags
              </Label>
              <MultiSelect
                options={tagOptions}
                selected={filters.tags || []}
                onChange={(values) => onFiltersChange({ ...filters, tags: values.length ? values : undefined })}
                placeholder="Any Tag"
              />
            </div>
          )}

          <DateFilterField
            label="Reported Date"
            icon={CalendarPlus}
            value={filters.reportedDateCustom}
            onChange={(value) => onFiltersChange({ ...filters, reportedDateCustom: value })}
          />

          <DateFilterField
            label="Completed Date"
            icon={CheckCircle2}
            value={filters.completedDateCustom}
            onChange={(value) => onFiltersChange({ ...filters, completedDateCustom: value })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
