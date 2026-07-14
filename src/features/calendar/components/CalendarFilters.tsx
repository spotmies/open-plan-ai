import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarFilter, TaskStatus, Priority, TeamMember, Project } from '@/types';
import { cn } from '@/lib/utils';

interface CalendarFiltersProps {
  filters: CalendarFilter;
  onFiltersChange: (filters: CalendarFilter) => void;
  projects: Project[];
  teamMembers: TeamMember[];
  availableTags: string[];
  hideTrigger?: boolean;
  hideActiveFilters?: boolean;
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

const priorityOptions: { value: Priority; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'trivial', label: 'Trivial' },
];

const entityTypeOptions: { value: 'task' | 'milestone' | 'issue'; label: string }[] = [
  { value: 'task', label: 'Tasks' },
  { value: 'milestone', label: 'Milestones' },
  { value: 'issue', label: 'Issues' },
];

export const CalendarFilters: React.FC<CalendarFiltersProps> = ({
  filters,
  onFiltersChange,
  projects,
  teamMembers,
  availableTags,
  hideTrigger,
  hideActiveFilters,
}) => {
  const activeFilterCount = [
    filters.projectIds?.length,
    filters.assigneeIds?.length,
    filters.status?.length,
    filters.priority?.length,
    filters.entityType?.length,
    filters.isBlocked !== undefined ? 1 : 0,
    filters.tags?.length,
  ].filter(Boolean).length;

  const handleProjectToggle = (projectId: string) => {
    const current = filters.projectIds || [];
    const updated = current.includes(projectId)
      ? current.filter((id) => id !== projectId)
      : [...current, projectId];
    onFiltersChange({ ...filters, projectIds: updated.length ? updated : undefined });
  };

  const handleAssigneeToggle = (assigneeId: string) => {
    const current = filters.assigneeIds || [];
    const updated = current.includes(assigneeId)
      ? current.filter((id) => id !== assigneeId)
      : [...current, assigneeId];
    onFiltersChange({ ...filters, assigneeIds: updated.length ? updated : undefined });
  };

  const handleStatusToggle = (status: TaskStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({ ...filters, status: updated.length ? updated : undefined });
  };

  const handlePriorityToggle = (priority: Priority) => {
    const current = filters.priority || [];
    const updated = current.includes(priority)
      ? current.filter((p) => p !== priority)
      : [...current, priority];
    onFiltersChange({ ...filters, priority: updated.length ? updated : undefined });
  };

  const handleEntityTypeToggle = (type: 'task' | 'milestone' | 'issue') => {
    const current = filters.entityType || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onFiltersChange({ ...filters, entityType: updated.length ? updated : undefined });
  };

  const handleTagToggle = (tag: string) => {
    const current = filters.tags || [];
    const updated = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    onFiltersChange({ ...filters, tags: updated.length ? updated : undefined });
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="flex items-center gap-2">
      {!hideTrigger && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 bg-background border-dashed hover:border-solid transition-all">
              <Filter className="h-3.5 w-3.5" />
              <span className="text-sm font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs ml-0.5 font-normal">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[340px] p-0" align="end" sideOffset={8}>
            <div className="flex flex-col h-full max-h-[80vh]">
              <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                <h4 className="font-medium text-sm">Filter View</h4>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground h-auto font-normal"
                    onClick={clearAllFilters}
                  >
                    Reset all
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                  {/* Projects */}
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Projects
                    </Label>
                    <div className="space-y-2">
                      {projects.map((project) => (
                        <div key={project.id} className="flex items-start gap-2 group">
                          <Checkbox
                            id={`project-${project.id}`}
                            checked={filters.projectIds?.includes(project.id) || false}
                            onCheckedChange={() => handleProjectToggle(project.id)}
                            className="mt-0.5"
                          />
                          <Label
                            htmlFor={`project-${project.id}`}
                            className="text-sm cursor-pointer leading-tight group-hover:text-primary transition-colors font-normal"
                          >
                            {project.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Entity Types */}
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Type
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {entityTypeOptions.map((option) => {
                        const isSelected = filters.entityType?.includes(option.value);
                        return (
                          <div
                            key={option.value}
                            onClick={() => handleEntityTypeToggle(option.value)}
                            className={cn(
                              "cursor-pointer rounded-md px-3 py-1.5 text-sm border transition-all",
                              isSelected
                                ? "bg-primary/5 border-primary/50 text-foreground font-medium"
                                : "bg-card hover:bg-accent hover:text-accent-foreground text-muted-foreground border-border"
                            )}
                          >
                            {option.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Status */}
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {statusOptions.map((option) => {
                        const isSelected = filters.status?.includes(option.value);
                        return (
                          <div
                            key={option.value}
                            onClick={() => handleStatusToggle(option.value)}
                            className={cn(
                              "cursor-pointer rounded-md px-3 py-1.5 text-sm border transition-all",
                              isSelected
                                ? "bg-primary/5 border-primary/50 text-foreground font-medium"
                                : "bg-card hover:bg-accent hover:text-accent-foreground text-muted-foreground border-border"
                            )}
                          >
                            {option.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Priority */}
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Priority
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {priorityOptions.map((option) => {
                        const isSelected = filters.priority?.includes(option.value);
                        return (
                          <div
                            key={option.value}
                            onClick={() => handlePriorityToggle(option.value)}
                            className={cn(
                              "cursor-pointer rounded-md px-3 py-1.5 text-sm border transition-all",
                              isSelected
                                ? "bg-primary/5 border-primary/50 text-foreground font-medium"
                                : "bg-card hover:bg-accent hover:text-accent-foreground text-muted-foreground border-border"
                            )}
                          >
                            {option.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Assignees */}
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Assigned To
                    </Label>
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-2 group">
                          <Checkbox
                            id={`assignee-${member.id}`}
                            checked={filters.assigneeIds?.includes(member.id) || false}
                            onCheckedChange={() => handleAssigneeToggle(member.id)}
                          />
                          <Label
                            htmlFor={`assignee-${member.id}`}
                            className="text-sm cursor-pointer group-hover:text-primary transition-colors font-normal"
                          >
                            {member.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Blocked toggle */}
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Dependency State
                    </Label>
                    <div className="flex gap-2">
                      <div
                        onClick={() => onFiltersChange({ ...filters, isBlocked: filters.isBlocked === true ? undefined : true })}
                        className={cn(
                          "cursor-pointer rounded-md px-3 py-1.5 text-sm border transition-all flex items-center gap-2",
                          filters.isBlocked === true
                            ? "bg-destructive/10 border-destructive/__50 text-destructive font-medium"
                            : "bg-card hover:bg-accent hover:text-accent-foreground text-muted-foreground border-border"
                        )}
                      >
                        <div className={cn("w-2 h-2 rounded-full", filters.isBlocked === true ? "bg-destructive" : "bg-muted-foreground")} />
                        Blocked
                      </div>
                      <div
                        onClick={() => onFiltersChange({ ...filters, isBlocked: filters.isBlocked === false ? undefined : false })}
                        className={cn(
                          "cursor-pointer rounded-md px-3 py-1.5 text-sm border transition-all flex items-center gap-2",
                          filters.isBlocked === false
                            ? "bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400 font-medium"
                            : "bg-card hover:bg-accent hover:text-accent-foreground text-muted-foreground border-border"
                        )}
                      >
                        <div className={cn("w-2 h-2 rounded-full", filters.isBlocked === false ? "bg-green-500" : "bg-muted-foreground")} />
                        Unblocked
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {availableTags.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Tags
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                          {availableTags.slice(0, 10).map((tag) => {
                            const isSelected = filters.tags?.includes(tag);
                            return (
                              <Badge
                                key={tag}
                                variant={isSelected ? 'default' : 'outline'}
                                className={cn(
                                  "cursor-pointer text-xs font-normal border-dashed",
                                  !isSelected && "hover:border-solid hover:bg-muted"
                                )}
                                onClick={() => handleTagToggle(tag)}
                              >
                                {tag}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Active filter pills */}
      {!hideActiveFilters && activeFilterCount > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {filters.entityType?.map((type) => (
            <Badge key={type} variant="secondary" className="h-6 gap-1 text-xs">
              {type}
              <X
                className="h-3 w-3 cursor-pointer hover:text-foreground"
                onClick={() => handleEntityTypeToggle(type)}
              />
            </Badge>
          ))}
          {filters.status?.map((status) => (
            <Badge key={status} variant="secondary" className="h-6 gap-1 text-xs">
              {status}
              <X
                className="h-3 w-3 cursor-pointer hover:text-foreground"
                onClick={() => handleStatusToggle(status)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
