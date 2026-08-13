import React from 'react';
import { Filter, Boxes, Layers, Flag, ShieldAlert, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { CalendarFilter, Priority, Project, TeamMember } from '@/types';

interface CalendarFiltersProps {
  filters: CalendarFilter;
  onFiltersChange: (filters: CalendarFilter) => void;
  projects: Project[];
  teamMembers: TeamMember[];
  hideTrigger?: boolean;
  hideActiveFilters?: boolean;
}

const entityTypeOptions: { value: 'task' | 'milestone' | 'issue' | 'meeting'; label: string }[] = [
  { value: 'task', label: 'Tasks' },
  { value: 'milestone', label: 'Milestones' },
  { value: 'issue', label: 'Issues' },
  { value: 'meeting', label: 'Meetings' },
];

const priorityOptions: { value: Priority; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'trivial', label: 'Trivial' },
];

const dependencyOptions = [
  { value: 'blocked', label: 'Blocked Only' },
  { value: 'unblocked', label: 'Unblocked Only' },
];

export const CalendarFilters: React.FC<CalendarFiltersProps> = ({
  filters,
  onFiltersChange,
  projects,
  teamMembers,
  hideTrigger,
  hideActiveFilters,
}) => {
  const [open, setOpen] = React.useState(false);

  const activeFilterCount = [
    filters.projectIds?.length,
    filters.entityType?.length,
    filters.priority?.length,
    filters.isBlocked !== undefined ? 1 : 0,
    filters.assignedBy?.length,
  ].filter(Boolean).length;

  const clearAll = () => {
    onFiltersChange({});
    setOpen(false);
  };

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const memberMap = new Map(teamMembers.map((m) => [m.id, m.name]));

  return (
    <div className="flex items-center gap-2">
      {!hideTrigger && (
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
                <h4 className="font-medium text-sm">Filters</h4>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 px-2 text-xs">
                    Clear all
                  </Button>
                )}
              </div>

              {/* Project Filter */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Boxes className="h-3 w-3" />
                  Project
                </Label>
                <MultiSelect
                  options={projects.map((p) => ({ value: p.id, label: p.name }))}
                  selected={filters.projectIds || []}
                  onChange={(values) => onFiltersChange({ ...filters, projectIds: values.length ? values : undefined })}
                  placeholder="All Projects"
                />
              </div>

              {/* Type Filter */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  Type
                </Label>
                <MultiSelect
                  options={entityTypeOptions}
                  selected={filters.entityType || []}
                  onChange={(values) =>
                    onFiltersChange({
                      ...filters,
                      entityType: values.length ? (values as ('task' | 'milestone' | 'issue' | 'meeting')[]) : undefined,
                    })
                  }
                  placeholder="All Types"
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

              {/* Dependency State Filter */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Dependency State
                </Label>
                <Select
                  value={filters.isBlocked === undefined ? 'all' : filters.isBlocked ? 'blocked' : 'unblocked'}
                  onValueChange={(v) =>
                    onFiltersChange({ ...filters, isBlocked: v === 'all' ? undefined : v === 'blocked' })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {dependencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned By Filter */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Assigned By
                </Label>
                <MultiSelect
                  options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
                  selected={filters.assignedBy || []}
                  onChange={(values) => onFiltersChange({ ...filters, assignedBy: values.length ? values : undefined })}
                  placeholder="All Members"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Active filter pills */}
      {!hideActiveFilters && activeFilterCount > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {filters.projectIds?.map((projectId) => (
            <Badge key={projectId} variant="secondary" className="h-6 gap-1 text-xs">
              {projectMap.get(projectId) || projectId}
              <X
                className="h-3 w-3 cursor-pointer hover:text-foreground"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    projectIds: filters.projectIds!.filter((id) => id !== projectId).length
                      ? filters.projectIds!.filter((id) => id !== projectId)
                      : undefined,
                  })
                }
              />
            </Badge>
          ))}
          {filters.entityType?.map((type) => (
            <Badge key={type} variant="secondary" className="h-6 gap-1 text-xs">
              {type}
              <X
                className="h-3 w-3 cursor-pointer hover:text-foreground"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    entityType: filters.entityType!.filter((t) => t !== type).length
                      ? filters.entityType!.filter((t) => t !== type)
                      : undefined,
                  })
                }
              />
            </Badge>
          ))}
          {filters.priority?.map((priority) => (
            <Badge key={priority} variant="secondary" className="h-6 gap-1 text-xs">
              {priority}
              <X
                className="h-3 w-3 cursor-pointer hover:text-foreground"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    priority: filters.priority!.filter((p) => p !== priority).length
                      ? filters.priority!.filter((p) => p !== priority)
                      : undefined,
                  })
                }
              />
            </Badge>
          ))}
          {filters.isBlocked !== undefined && (
            <Badge variant="secondary" className="h-6 gap-1 text-xs">
              {filters.isBlocked ? 'Blocked' : 'Unblocked'}
              <X
                className="h-3 w-3 cursor-pointer hover:text-foreground"
                onClick={() => onFiltersChange({ ...filters, isBlocked: undefined })}
              />
            </Badge>
          )}
          {filters.assignedBy?.map((memberId) => (
            <Badge key={memberId} variant="secondary" className="h-6 gap-1 text-xs">
              {memberMap.get(memberId) || memberId}
              <X
                className="h-3 w-3 cursor-pointer hover:text-foreground"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    assignedBy: filters.assignedBy!.filter((id) => id !== memberId).length
                      ? filters.assignedBy!.filter((id) => id !== memberId)
                      : undefined,
                  })
                }
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
