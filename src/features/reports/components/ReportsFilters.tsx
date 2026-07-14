import { useEffect, useState } from 'react';
import { Filter, ChevronDown, X, Download, FileText } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

  return (
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
              <Button variant="outline" size="sm" className={`shrink-0 ${isMobile ? 'h-8 px-3' : ''}`}>
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 justify-center">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] max-w-80" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Filters</h4>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>

                <Separator />

                {/* Assignee Filter */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-muted-foreground">Assignee</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {teamMembers.slice(0, 6).map(member => (
                      <label
                        key={member.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={filter.assigneeIds?.includes(member.id)}
                          onCheckedChange={() => handleAssigneeToggle(member.id)}
                        />
                        <span className="truncate">{member.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Priority Filter */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-muted-foreground">Priority</h5>
                  <div className="flex flex-wrap gap-2">
                    {priorityOptions.map(priority => (
                      <label
                        key={priority}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={filter.priority?.includes(priority)}
                          onCheckedChange={() => handlePriorityToggle(priority)}
                        />
                        <span className="capitalize">{priority}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Status Filter */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-muted-foreground">Status</h5>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map(status => (
                      <label
                        key={status}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={filter.status?.includes(status)}
                          onCheckedChange={() => handleStatusToggle(status)}
                        />
                        <span className="capitalize">{status.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Module Filter */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-muted-foreground">Module</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {modules.map(module => (
                      <label
                        key={module.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={filter.moduleIds?.includes(module.id)}
                          onCheckedChange={() => handleModuleToggle(module.id)}
                        />
                        <span className="truncate">{module.name}</span>
                      </label>
                    ))}
                  </div>
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
          <Popover>
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
                  }
                }}
                numberOfMonths={isMobile ? 1 : 2}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
