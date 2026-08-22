import { useEffect, useState } from 'react';
import { Filter, ChevronDown, X, Download, FileText, User, Flag, AlertTriangle, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Project, TeamMember, Module, Milestone, Priority, TaskStatus } from '@/types';
import { ReportTimeRange, ReportFilter } from '../utils/reportsUtils';
import { format } from 'date-fns';

interface ReportsFiltersProps {
  projects: Project[];
  teamMembers: TeamMember[];
  modules: Module[];
  milestones: Milestone[];
  filter: ReportFilter;
  onFilterChange: (filter: ReportFilter) => void;
  onExport?: (format: 'csv' | 'pdf') => void;
}

const timeRangeOptions: { value: ReportTimeRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'custom', label: 'Custom' },
];

const priorityOptions: Priority[] = ['critical', 'major', 'minor', 'trivial'];
const statusOptions: TaskStatus[] = ['todo', 'in-progress', 'review', 'done', 'blocked'];

export function ReportsFilters({
  projects,
  teamMembers,
  modules,
  milestones,
  filter,
  onFilterChange,
  onExport,
}: ReportsFiltersProps) {
  const isMobile = useIsMobile();
  const [showCustomDate, setShowCustomDate] = useState(filter.timeRange === 'custom');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [customDateOpen, setCustomDateOpen] = useState(false);

  useEffect(() => {
    setShowCustomDate(filter.timeRange === 'custom');
  }, [filter.timeRange]);

  const activeFilterCount = [
    filter.moduleIds?.length,
    filter.milestoneIds?.length,
    filter.assigneeIds?.length,
    filter.priority?.length,
    filter.status?.length,
    filter.tags?.length,
  ].filter(Boolean).length;

  const handleTimeRangeChange = (value: ReportTimeRange) => {
    setShowCustomDate(value === 'custom');
    if (value === 'custom') {
      // Open the picker right away so the user isn't left staring at a
      // "Select dates" button with no indication a range is needed.
      setCustomDateOpen(true);
    }
    onFilterChange({ ...filter, timeRange: value });
  };

  const handleProjectChange = (value: string) => {
    onFilterChange({
      ...filter,
      projectId: value === 'all' ? undefined : value
    });
  };

  const handleAssigneeToggle = (memberId: string) => {
    const current = filter.assigneeIds || [];
    const updated = current.includes(memberId)
      ? current.filter(id => id !== memberId)
      : [...current, memberId];
    onFilterChange({ ...filter, assigneeIds: updated.length ? updated : undefined });
  };

  const handlePriorityToggle = (priority: Priority) => {
    const current = filter.priority || [];
    const updated = current.includes(priority)
      ? current.filter(p => p !== priority)
      : [...current, priority];
    onFilterChange({ ...filter, priority: updated.length ? updated : undefined });
  };

  const handleStatusToggle = (status: TaskStatus) => {
    const current = filter.status || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    onFilterChange({ ...filter, status: updated.length ? updated : undefined });
  };

  const handleModuleToggle = (moduleId: string) => {
    const current = filter.moduleIds || [];
    const updated = current.includes(moduleId)
      ? current.filter(id => id !== moduleId)
      : [...current, moduleId];
    onFilterChange({ ...filter, moduleIds: updated.length ? updated : undefined });
  };

  const clearFilters = () => {
    onFilterChange({
      projectId: filter.projectId,
      timeRange: filter.timeRange,
      customDateRange: filter.customDateRange,
    });
  };

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [
    ...(filter.assigneeIds?.map(id => ({
      key: `assignee-${id}`,
      label: `Assignee: ${teamMembers.find(m => m.id === id)?.name ?? id}`,
      onRemove: () => handleAssigneeToggle(id),
    })) ?? []),
    ...(filter.priority?.map(p => ({
      key: `priority-${p}`,
      label: `Priority: ${p}`,
      onRemove: () => handlePriorityToggle(p),
    })) ?? []),
    ...(filter.status?.map(s => ({
      key: `status-${s}`,
      label: `Status: ${s.replace('-', ' ')}`,
      onRemove: () => handleStatusToggle(s),
    })) ?? []),
    ...(filter.moduleIds?.map(id => ({
      key: `module-${id}`,
      label: `Module: ${modules.find(m => m.id === id)?.name ?? id}`,
      onRemove: () => handleModuleToggle(id),
    })) ?? []),
  ];

  return (
    <div className="flex flex-col gap-2">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
      {/* Project Selector - Left Side */}
      <div className="flex items-center w-full md:w-auto">
        <Select
          value={filter.projectId || 'all'}
          onValueChange={handleProjectChange}
        >
          <SelectTrigger className="w-full md:w-[220px] max-w-full [&>span]:truncate">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent
            className={
              isMobile
                ? "w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] max-h-60 [&_[data-radix-select-viewport]]:max-h-56 [&_[data-radix-select-viewport]]:overflow-y-auto [&_[data-radix-select-viewport]]:overflow-x-hidden [&_[data-radix-select-viewport]]:overscroll-contain [&_[data-radix-select-viewport]]:touch-pan-y [&_[data-radix-select-viewport]]:scroll-smooth [&_[data-radix-select-viewport]]:[-webkit-overflow-scrolling:touch] [&_[data-radix-select-viewport]]:[scrollbar-width:thin]"
                : "w-[min(560px,calc(100vw-8rem))] max-h-72 [&_[data-radix-select-viewport]]:max-h-64 [&_[data-radix-select-viewport]]:overflow-y-auto [&_[data-radix-select-viewport]]:overflow-x-auto [&_[data-radix-select-viewport]]:overscroll-contain [&_[data-radix-select-viewport]]:scroll-smooth [&_[data-radix-select-viewport]]:[scrollbar-width:thin]"
            }
          >
            <SelectItem value="all" className="max-w-full">
              <span className={isMobile ? "block leading-snug break-words" : "block whitespace-nowrap"}>All Projects</span>
            </SelectItem>
            {projects.map(project => (
              <SelectItem key={project.id} value={project.id} className="max-w-full items-start">
                <span
                  className={
                    isMobile
                      ? "block leading-snug break-all whitespace-normal"
                      : "block whitespace-nowrap min-w-max"
                  }
                  title={project.name}
                >
                  {project.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Right Side Controls */}
      <div className="w-full md:w-auto flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
        {/* Time range + Filters on one compact row for mobile */}
        <div className="w-full flex items-center gap-2">
          {/* Time range */}
          <div className="flex-1 min-w-0 flex items-center rounded-md border bg-background overflow-x-auto whitespace-nowrap">
            {timeRangeOptions.map((option) => (
              <Button
                key={option.value}
                variant={filter.timeRange === option.value ? 'secondary' : 'ghost'}
                size="sm"
                className={`rounded-none first:rounded-l-md last:rounded-r-md shrink-0 ${isMobile ? 'h-8 px-2 text-xs' : ''}`}
                onClick={() => handleTimeRangeChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {/* Advanced Filters */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={`gap-2 rounded-lg shrink-0 ${isMobile ? 'h-8 px-3' : 'h-9'}`}>
                <Filter className="h-4 w-4" />
                {!isMobile && 'Filter'}
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Filter Reports</h4>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearFilters}>
                      Clear all
                    </Button>
                  )}
                </div>

                {/* Assignee Filter */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Assignee
                  </Label>
                  <MultiSelect
                    options={teamMembers.map(member => ({ value: member.id, label: member.name }))}
                    selected={filter.assigneeIds || []}
                    onChange={(values) => onFilterChange({ ...filter, assigneeIds: values.length ? values : undefined })}
                    placeholder="All assignees"
                  />
                </div>

                {/* Priority Filter */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Flag className="h-3 w-3" />
                    Priority
                  </Label>
                  <MultiSelect
                    options={priorityOptions.map(priority => ({ value: priority, label: priority.charAt(0).toUpperCase() + priority.slice(1) }))}
                    selected={filter.priority || []}
                    onChange={(values) => onFilterChange({ ...filter, priority: values.length ? values as Priority[] : undefined })}
                    placeholder="All priorities"
                  />
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Status
                  </Label>
                  <MultiSelect
                    options={statusOptions.map(status => ({ value: status, label: status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()) }))}
                    selected={filter.status || []}
                    onChange={(values) => onFilterChange({ ...filter, status: values.length ? values as TaskStatus[] : undefined })}
                    placeholder="All statuses"
                  />
                </div>

                {/* Module Filter */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Boxes className="h-3 w-3" />
                    Module
                  </Label>
                  <MultiSelect
                    options={modules.map(module => ({ value: module.id, label: module.name }))}
                    selected={filter.moduleIds || []}
                    onChange={(values) => onFilterChange({ ...filter, moduleIds: values.length ? values : undefined })}
                    placeholder="All modules"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={`shrink-0 ${isMobile ? 'h-8 px-2.5' : 'h-9'}`}>
                <Download className="h-4 w-4" />
                {!isMobile && <span className="ml-2 hidden xs:inline">Export</span>}
                <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-popover border border-border shadow-md z-50">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => onExport?.('csv')}
              >
                <Download className="h-4 w-4 mr-2 text-muted-foreground" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => onExport?.('pdf')}
              >
                <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Custom Date Range */}
        {showCustomDate && (
          <Popover open={customDateOpen} onOpenChange={setCustomDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                {dateRange.from && dateRange.to
                  ? `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd')}`
                  : 'Select dates'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  setDateRange({ from: range?.from, to: range?.to });
                  if (range?.from && range?.to) {
                    onFilterChange({
                      ...filter,
                      customDateRange: {
                        start: format(range.from, 'yyyy-MM-dd'),
                        end: format(range.to, 'yyyy-MM-dd'),
                      },
                    });
                    setCustomDateOpen(false);
                  }
                }}
                numberOfMonths={isMobile ? 1 : 2}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>

    {activeChips.length > 0 && (
      <div className="flex flex-wrap items-center gap-2">
        {activeChips.map(chip => (
          <Badge
            key={chip.key}
            variant="secondary"
            className="capitalize flex items-center gap-1 pr-1"
          >
            {chip.label}
            <button
              type="button"
              onClick={chip.onRemove}
              className="ml-1 rounded-full hover:bg-muted p-0.5"
              aria-label={`Remove ${chip.label} filter`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {activeChips.length > 1 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearFilters}>
            Clear all
          </Button>
        )}
      </div>
    )}
    </div>
  );
}
