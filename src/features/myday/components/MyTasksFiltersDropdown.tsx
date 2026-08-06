import { useMemo, useState } from 'react';
import { Filter, Flag, CheckSquare, FolderKanban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MultiSelect } from '@/components/ui/multi-select';
import { cn } from '@/lib/utils';
import { MyDayItem, MyDayItemType, MyTasksColumnFilters } from '@/types';

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

const statusOptions = [
  { value: 'todo', label: 'Todo' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.type?.length) count++;
    if (filters.status?.length) count++;
    if (filters.priority?.length) count++;
    if (filters.projectIds?.length) count++;
    return count;
  }, [filters]);

  const [open, setOpen] = useState(false);
  const clearAll = () => {
    onFiltersChange({});
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
              onChange={(values) => onFiltersChange({ ...filters, type: values.length ? (values as MyDayItemType[]) : undefined })}
              placeholder="All Types"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Status</Label>
            <MultiSelect
              options={statusOptions}
              selected={filters.status || []}
              onChange={(values) => onFiltersChange({ ...filters, status: values.length ? values : undefined })}
              placeholder="All Status"
            />
          </div>

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
        </div>
      </PopoverContent>
    </Popover>
  );
}
