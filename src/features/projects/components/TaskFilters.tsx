import { TaskFilter, Milestone, ModuleType, TaskStatus, Priority } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskFiltersProps {
  filters: TaskFilter;
  onFiltersChange: (filters: TaskFilter) => void;
  milestones: Milestone[];
  modules: { id: string; name: string; type: ModuleType }[];
  teamMembers: { id: string; name: string; initials: string }[];
  allTags: string[];
  statusOptions?: { value: string; label: string; color?: string }[];
}

// Fallback used only when the caller hasn't loaded the project's dynamic
// task buckets yet (e.g. no projectId). See TaskFiltersDropdown for the same pattern.
const DEFAULT_STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'todo', label: 'To Do', color: 'bg-status-todo' },
  { value: 'in-progress', label: 'In Progress', color: 'bg-status-in-progress' },
  { value: 'review', label: 'Review', color: 'bg-status-review' },
  { value: 'done', label: 'Done', color: 'bg-status-done' },
  { value: 'blocked', label: 'Blocked', color: 'bg-status-blocked' },
];

function StatusDot({ color }: { color?: string }) {
  if (!color) return <div className="w-2 h-2 rounded-full bg-muted-foreground/60" />;
  if (color.startsWith('#') || color.startsWith('rgb')) {
    return <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />;
  }
  return <div className={cn('w-2 h-2 rounded-full', color)} />;
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: 'bg-priority-critical' },
  { value: 'major', label: 'Major', color: 'bg-priority-high' },
  { value: 'minor', label: 'Minor', color: 'bg-priority-medium' },
  { value: 'trivial', label: 'Trivial', color: 'bg-priority-low' },
];

const dueDateOptions = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'this-week', label: 'This Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'no-date', label: 'No Date' },
];

export function TaskFilters({
  filters,
  onFiltersChange,
  milestones,
  modules,
  teamMembers,
  allTags,
  statusOptions,
}: TaskFiltersProps) {
  const effectiveStatusOptions = statusOptions?.length ? statusOptions : DEFAULT_STATUS_OPTIONS;

  const toggleStatus = (status: TaskStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    onFiltersChange({ ...filters, status: updated.length ? updated : undefined });
  };

  const togglePriority = (priority: Priority) => {
    const current = filters.priority || [];
    const updated = current.includes(priority)
      ? current.filter(p => p !== priority)
      : [...current, priority];
    onFiltersChange({ ...filters, priority: updated.length ? updated : undefined });
  };

  const toggleModule = (moduleId: string) => {
    const current = filters.moduleIds || [];
    const updated = current.includes(moduleId)
      ? current.filter(id => id !== moduleId)
      : [...current, moduleId];
    onFiltersChange({ ...filters, moduleIds: updated.length ? updated : undefined });
  };

  const toggleAssignee = (assigneeId: string) => {
    const current = filters.assignee || [];
    const updated = current.includes(assigneeId)
      ? current.filter(a => a !== assigneeId)
      : [...current, assigneeId];
    onFiltersChange({ ...filters, assignee: updated.length ? updated : undefined });
  };

  const toggleAssignedBy = (memberId: string) => {
    const current = filters.assignedBy || [];
    const updated = current.includes(memberId)
      ? current.filter(a => a !== memberId)
      : [...current, memberId];
    onFiltersChange({ ...filters, assignedBy: updated.length ? updated : undefined });
  };

  const toggleTag = (tag: string) => {
    const current = filters.tags || [];
    const updated = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag];
    onFiltersChange({ ...filters, tags: updated.length ? updated : undefined });
  };

  return (
    <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg border">
      {/* Status Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Status
            {filters.status?.length ? (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {filters.status.length}
              </Badge>
            ) : (
              <ChevronDown className="h-3 w-3 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-2">
            {effectiveStatusOptions.map(option => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                <Checkbox
                  checked={filters.status?.includes(option.value) || false}
                  onCheckedChange={() => toggleStatus(option.value)}
                />
                <StatusDot color={option.color} />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Priority Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Priority
            {filters.priority?.length ? (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {filters.priority.length}
              </Badge>
            ) : (
              <ChevronDown className="h-3 w-3 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-2">
            {priorityOptions.map(option => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                <Checkbox
                  checked={filters.priority?.includes(option.value) || false}
                  onCheckedChange={() => togglePriority(option.value)}
                />
                <div className={cn('w-2 h-2 rounded-full', option.color)} />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Module Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Module
            {filters.moduleIds?.length ? (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {filters.moduleIds.length}
              </Badge>
            ) : (
              <ChevronDown className="h-3 w-3 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {modules.length === 0 ? (
              <div className="text-sm text-muted-foreground p-1">No modules created</div>
            ) : (
              modules.map(module => (
                <label key={module.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                  <Checkbox
                    checked={filters.moduleIds?.includes(module.id) || false}
                    onCheckedChange={() => toggleModule(module.id)}
                  />
                  <span className="text-sm">{module.name}</span>
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Milestone Filter */}
      <Select
        value={filters.milestoneId || 'all'}
        onValueChange={(value) => onFiltersChange({ ...filters, milestoneId: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="w-[140px] h-8 text-sm">
          <SelectValue placeholder="Milestone" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Milestones</SelectItem>
          <SelectItem value="none">No Milestone</SelectItem>
          {milestones.map(m => (
            <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Due Date Filter */}
      <Select
        value={filters.dueDate || 'all'}
        onValueChange={(value) => onFiltersChange({ 
          ...filters, 
          dueDate: value === 'all' ? undefined : value as TaskFilter['dueDate'] 
        })}
      >
        <SelectTrigger className="w-[130px] h-8 text-sm">
          <SelectValue placeholder="Due Date" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any Date</SelectItem>
          {dueDateOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Assigned To Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Assigned To
            {filters.assignee?.length ? (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {filters.assignee.length}
              </Badge>
            ) : (
              <ChevronDown className="h-3 w-3 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            <label className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
              <Checkbox
                checked={filters.assignee?.includes('unassigned') || false}
                onCheckedChange={() => toggleAssignee('unassigned')}
              />
              <span className="text-sm text-muted-foreground">Unassigned</span>
            </label>
            {teamMembers.map(member => (
              <label key={member.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                <Checkbox
                  checked={filters.assignee?.includes(member.id) || false}
                  onCheckedChange={() => toggleAssignee(member.id)}
                />
                <span className="text-sm">{member.name}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Assigned By Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Assigned By
            {filters.assignedBy?.length ? (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {filters.assignedBy.length}
              </Badge>
            ) : (
              <ChevronDown className="h-3 w-3 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {teamMembers.map(member => (
              <label key={member.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                <Checkbox
                  checked={filters.assignedBy?.includes(member.id) || false}
                  onCheckedChange={() => toggleAssignedBy(member.id)}
                />
                <span className="text-sm">{member.name}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              Tags
              {filters.tags?.length ? (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {filters.tags.length}
                </Badge>
              ) : (
                <ChevronDown className="h-3 w-3 opacity-50" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allTags.map(tag => (
                <label key={tag} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                  <Checkbox
                    checked={filters.tags?.includes(tag) || false}
                    onCheckedChange={() => toggleTag(tag)}
                  />
                  <span className="text-sm">{tag}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Has Blockers Toggle */}
      <Button
        variant={filters.hasBlockers ? "secondary" : "outline"}
        size="sm"
        onClick={() => onFiltersChange({ 
          ...filters, 
          hasBlockers: filters.hasBlockers === undefined ? true : undefined 
        })}
        className="gap-1"
      >
        Blocked
        {filters.hasBlockers && <X className="h-3 w-3" />}
      </Button>
    </div>
  );
}
