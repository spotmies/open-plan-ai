import { useState } from 'react';
import { format } from 'date-fns';
import { TaskFilter, Milestone, ModuleType, TaskStatus, Priority } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Filter, Flag, Clock, User, Boxes, Target, Tag, CalendarIcon } from 'lucide-react';

interface TaskFiltersDropdownProps {
  filters: TaskFilter;
  onFiltersChange: (filters: TaskFilter) => void;
  milestones: Milestone[];
  modules: { id: string; name: string; type: ModuleType }[];
  teamMembers: { id: string; name: string; initials: string }[];
  allTags: string[];
  activeFilterCount: number;
  statusOptions?: { value: string; label: string; color?: string }[];
}

// Fallback used only when the caller hasn't loaded the project's dynamic
// task buckets yet (e.g. no projectId). See TaskFilters for the same pattern.
const DEFAULT_STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

const priorityOptions = [
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'trivial', label: 'Trivial' },
];

const dueDateOptions = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'this-week', label: 'This Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'no-date', label: 'No Date' },
];

export function TaskFiltersDropdown({
  filters,
  onFiltersChange,
  milestones,
  modules,
  teamMembers,
  allTags,
  activeFilterCount,
  statusOptions,
}: TaskFiltersDropdownProps) {
  const [open, setOpen] = useState(false);
  const clearAll = () => {
    onFiltersChange({});
    setOpen(false);
  };
  const effectiveStatusOptions = statusOptions?.length ? statusOptions : DEFAULT_STATUS_OPTIONS;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9 rounded-lg">
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

          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              Status
            </Label>
            <MultiSelect
              options={effectiveStatusOptions}
              selected={filters.status || []}
              onChange={(values) => onFiltersChange({ ...filters, status: values.length ? (values as TaskStatus[]) : undefined })}
              placeholder="All Status"
            />
          </div>

          {/* Priority Filter */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Flag className="h-3 w-3" />
              Priority
            </Label>
            <MultiSelect
              options={priorityOptions}
              selected={filters.priority || []}
              onChange={(values) => onFiltersChange({ ...filters, priority: values.length ? (values as Priority[]) : undefined })}
              placeholder="All Priorities"
            />
          </div>

          {/* Module Filter */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Boxes className="h-3 w-3" />
              Module
            </Label>
            <MultiSelect
              options={modules.map(m => ({ value: m.id, label: m.name }))}
              selected={filters.moduleIds || []}
              onChange={(values) => onFiltersChange({ ...filters, moduleIds: values.length ? values : undefined })}
              placeholder="All Modules"
            />
          </div>

          {/* Milestone Filter */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Target className="h-3 w-3" />
              Milestone
            </Label>
            <Select
              value={filters.milestoneId ?? 'all'}
              onValueChange={(v) => onFiltersChange({ ...filters, milestoneId: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="All Milestones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Milestones</SelectItem>
                <SelectItem value="none">No Milestone</SelectItem>
                {milestones.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date Filter */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Due Date
            </Label>
            <div className="flex items-center gap-1">
              <Select
                value={filters.dueDate ?? 'all'}
                onValueChange={(v) => onFiltersChange({
                  ...filters,
                  dueDate: v === 'all' ? undefined : v as TaskFilter['dueDate'],
                  dueDateCustom: undefined,
                })}
              >
                <SelectTrigger className="h-8 flex-1">
                  <SelectValue placeholder="Any Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Date</SelectItem>
                  {dueDateOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant={filters.dueDateCustom ? 'secondary' : 'outline'}
                    size="icon"
                    className="h-8 w-8 shrink-0"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarPicker
                    mode="single"
                    selected={filters.dueDateCustom ? new Date(filters.dueDateCustom) : undefined}
                    onSelect={(date) => onFiltersChange({
                      ...filters,
                      dueDateCustom: date ? format(date, 'yyyy-MM-dd') : undefined,
                      dueDate: date ? undefined : filters.dueDate,
                    })}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {filters.dueDateCustom && (
              <div className="flex items-center justify-between pl-1">
                <span className="text-xs text-muted-foreground">{format(new Date(filters.dueDateCustom), 'PPP')}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-xs"
                  onClick={() => onFiltersChange({ ...filters, dueDateCustom: undefined })}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          {/* Assigned To Filter */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <User className="h-3 w-3" />
              Assigned To
            </Label>
            <MultiSelect
              options={[
                { value: 'unassigned', label: 'Unassigned' },
                ...teamMembers.map(m => ({ value: m.id, label: m.name })),
              ]}
              selected={filters.assignee || []}
              onChange={(values) => onFiltersChange({ ...filters, assignee: values.length ? values : undefined })}
              placeholder="All Assignees"
            />
          </div>

          {/* Assigned By Filter */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <User className="h-3 w-3" />
              Assigned By
            </Label>
            <MultiSelect
              options={teamMembers.map(m => ({ value: m.id, label: m.name }))}
              selected={filters.assignedBy || []}
              onChange={(values) => onFiltersChange({ ...filters, assignedBy: values.length ? values : undefined })}
              placeholder="All Members"
            />
          </div>

          {/* Updated By Filter */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <User className="h-3 w-3" />
              Updated By
            </Label>
            <MultiSelect
              options={teamMembers.map(m => ({ value: m.id, label: m.name }))}
              selected={filters.updatedBy || []}
              onChange={(values) => onFiltersChange({ ...filters, updatedBy: values.length ? values : undefined })}
              placeholder="All Members"
            />
          </div>

          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Tags
              </Label>
              <MultiSelect
                options={allTags.map(t => ({ value: t, label: t }))}
                selected={filters.tags || []}
                onChange={(values) => onFiltersChange({ ...filters, tags: values.length ? values : undefined })}
                placeholder="All Tags"
              />
            </div>
          )}

          {/* Show Only Blocked Tasks */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <Checkbox
              checked={filters.hasBlockers || false}
              onCheckedChange={(checked) => onFiltersChange({
                ...filters,
                hasBlockers: checked ? true : undefined,
              })}
            />
            <span className="text-sm">Show Only Blocked Tasks</span>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
