import { useState } from 'react';
import { format } from 'date-fns';
import { TaskFilter, Milestone, ModuleType, TaskStatus, Priority } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Filter, Flag, Clock, User, Boxes, Target, Tag, ChevronDown } from 'lucide-react';

const BASE_DATE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'this-week', label: 'This Week' },
  { value: 'this-month', label: 'This Month' },
];

function DateFilterSelect({
  label,
  preset,
  custom,
  customTo,
  extraOptions = [],
  onChange,
}: {
  label: string;
  preset?: string;
  custom?: string; // start of a custom range (yyyy-MM-dd); same as customTo for a single-day pick
  customTo?: string; // end of a custom range (yyyy-MM-dd), inclusive
  extraOptions?: { value: string; label: string }[];
  onChange: (value: { preset?: string; custom?: string; customTo?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<{ from?: Date; to?: Date }>({});
  const allOptions = [...extraOptions, ...BASE_DATE_OPTIONS];
  const isRange = !!custom && !!customTo && custom !== customTo;
  const displayLabel = custom
    ? (isRange ? `${format(new Date(custom), 'PP')} – ${format(new Date(customTo!), 'PP')}` : format(new Date(custom), 'PPP'))
    : (allOptions.find((o) => o.value === preset)?.label ?? 'Any Date');

  const openCalendar = () => {
    setOpen(false);
    setDraftRange({
      from: custom ? new Date(custom) : undefined,
      to: customTo ? new Date(customTo) : undefined,
    });
    setCalendarOpen(true);
  };

  const applyRange = () => {
    if (!draftRange.from) return;
    const from = format(draftRange.from, 'yyyy-MM-dd');
    const to = format(draftRange.to ?? draftRange.from, 'yyyy-MM-dd');
    onChange({ preset: undefined, custom: from, customTo: to });
    setCalendarOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-full justify-between font-normal"
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end" sideOffset={4}>
          <div className="flex flex-col">
            <button
              type="button"
              className="w-full text-left px-2.5 py-1.5 text-sm rounded-sm hover:bg-accent"
              onClick={() => { onChange({ preset: undefined, custom: undefined, customTo: undefined }); setOpen(false); }}
            >
              Any Date
            </button>
            {allOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="w-full text-left px-2.5 py-1.5 text-sm rounded-sm hover:bg-accent"
                onClick={() => { onChange({ preset: opt.value, custom: undefined, customTo: undefined }); setOpen(false); }}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              className="w-full text-left px-2.5 py-1.5 text-sm rounded-sm hover:bg-accent"
              onClick={openCalendar}
            >
              Custom...
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent
          className="w-auto max-w-fit p-4"
          onPointerDownOutside={() => {}}
          onInteractOutside={() => {}}
        >
          <DialogHeader>
            <DialogTitle className="text-sm">{label}</DialogTitle>
          </DialogHeader>
          <CalendarPicker
            mode="range"
            selected={draftRange}
            onSelect={(range) => setDraftRange(range ?? {})}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs whitespace-nowrap">
              <span>
                <span className="text-muted-foreground">From </span>
                <span className="font-medium">{draftRange.from ? format(draftRange.from, 'PP') : '—'}</span>
              </span>
              <span>
                <span className="text-muted-foreground">To </span>
                <span className="font-medium">
                  {draftRange.to ? format(draftRange.to, 'PP') : (draftRange.from ? format(draftRange.from, 'PP') : '—')}
                </span>
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-7 px-3 text-xs shrink-0"
              disabled={!draftRange.from}
              onClick={applyRange}
            >
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {custom && (
        <div className="flex items-center justify-between pl-1">
          <span className="text-xs text-muted-foreground">{displayLabel}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-xs"
            onClick={() => onChange({ preset: undefined, custom: undefined, customTo: undefined })}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

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

const dueDateExtraOptions = [
  { value: 'overdue', label: 'Overdue' },
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
      <PopoverContent
        className="w-72 p-0 flex flex-col overflow-hidden max-h-[var(--radix-popover-content-available-height)]"
        align="end"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h4 className="font-medium text-sm">Filter Tasks</h4>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 px-2 text-xs">
              Clear all
            </Button>
          )}
        </div>
        <div className="space-y-4 p-4 overflow-y-auto min-h-0">
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
          <DateFilterSelect
            label="Due Date"
            preset={filters.dueDate}
            custom={filters.dueDateCustom}
            customTo={filters.dueDateCustomTo}
            extraOptions={dueDateExtraOptions}
            onChange={({ preset, custom, customTo }) => onFiltersChange({
              ...filters,
              dueDate: preset as TaskFilter['dueDate'],
              dueDateCustom: custom,
              dueDateCustomTo: customTo,
            })}
          />

          {/* Completion Date Filter */}
          <DateFilterSelect
            label="Completion Date"
            preset={filters.completedDate}
            custom={filters.completedDateCustom}
            customTo={filters.completedDateCustomTo}
            onChange={({ preset, custom, customTo }) => onFiltersChange({
              ...filters,
              completedDate: preset as TaskFilter['completedDate'],
              completedDateCustom: custom,
              completedDateCustomTo: customTo,
            })}
          />

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
