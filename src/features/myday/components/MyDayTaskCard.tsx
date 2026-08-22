import { useState, memo, useCallback } from 'react';
import { 
  Calendar, 
  AlertTriangle, 
  Lock, 
  Link2, 
  CheckSquare,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  MyDayTask, 
  getModuleInfo, 
  getPriorityInfo, 
  formatDueDate,
  formatTaskDateRange,
  getDueDateStatus 
} from '../utils/myDayUtils';
import { TaskStatus, ChecklistItem } from '@/types';

interface MyDayTaskCardProps {
  task: MyDayTask;
  variant: 'attention' | 'ready' | 'blocked';
  onTaskClick: (task: MyDayTask) => void;
  onStatusUpdate: (taskId: string, status: TaskStatus) => void;
  onChecklistToggle: (taskId: string, itemId: string) => void;
}

export const MyDayTaskCard = memo(function MyDayTaskCard({
  task,
  variant,
  onTaskClick,
  onStatusUpdate,
  onChecklistToggle,
}: MyDayTaskCardProps) {
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  
  const moduleInfo = getModuleInfo(task.module);
  const priorityInfo = getPriorityInfo(task.priority);
  const dueDateStatus = getDueDateStatus(task.dueDate);
  
  const completedItems = task.checklist?.filter(item => item.completed).length || 0;
  const totalItems = task.checklist?.length || 0;
  const checklistProgress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  const variantStyles = {
    attention: 'border-l-4 border-l-destructive bg-destructive/5 hover:bg-destructive/10',
    ready: 'border-l-4 border-l-status-done bg-status-done/5 hover:bg-status-done/10',
    blocked: 'border-l-4 border-l-muted bg-muted/30 opacity-75 hover:opacity-100',
  };

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Don't trigger if clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, [role="combobox"], input')) {
      return;
    }
    onTaskClick(task);
  }, [onTaskClick, task]);

  const handleChecklistToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setChecklistExpanded(prev => !prev);
  }, []);

  const handleStatusChange = useCallback((value: TaskStatus) => {
    onStatusUpdate(task.id, value);
  }, [onStatusUpdate, task.id]);

  const handleChecklistItemToggle = useCallback((itemId: string) => {
    onChecklistToggle(task.id, itemId);
  }, [onChecklistToggle, task.id]);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200',
        variantStyles[variant]
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-3">
        {/* Header: Title and Priority */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h4 className="font-medium text-sm text-foreground leading-tight flex-1 truncate">
            {task.title}
          </h4>
          <Badge className={cn('text-xs shrink-0 py-0 h-5', priorityInfo.color)}>
            {priorityInfo.label}
          </Badge>
        </div>

        {/* Project, Module, and Date on one row */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <Badge variant="outline" className="text-xs py-0 h-5">
            {task.projectName}
          </Badge>
          <Badge className={cn('text-xs py-0 h-5', moduleInfo.color)}>
            {moduleInfo.label}
          </Badge>
          <div className={cn(
            'flex items-center gap-1 text-xs ml-auto shrink-0',
            dueDateStatus === 'overdue' && 'text-destructive',
            dueDateStatus === 'today' && 'text-priority-high',
            (dueDateStatus === 'upcoming' || dueDateStatus === 'none') && 'text-muted-foreground',
          )}>
            {dueDateStatus === 'overdue' ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            <span>
              {task.startDate && task.dueDate
                ? formatTaskDateRange(task.startDate, task.dueDate)
                : formatDueDate(task.dueDate)}
            </span>
          </div>
        </div>

        {/* Dependency indicators — only when present */}
        {(task.isBlocked || task.isBlockingOthers) && (
          <div className="flex items-center gap-3 mb-2 text-xs">
            {task.isBlocked && (
              <div className="flex items-center gap-1 text-status-blocked">
                <Lock className="h-3 w-3" />
                <span>Blocked</span>
              </div>
            )}
            {task.isBlockingOthers && !task.isBlocked && (
              <div className="flex items-center gap-1 text-priority-high">
                <Link2 className="h-3 w-3" />
                <span>Blocking others</span>
              </div>
            )}
          </div>
        )}

        {/* Checklist Progress (if applicable) */}
        {totalItems > 0 && (
          <div className="mb-2">
            <button
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground w-full"
              onClick={handleChecklistToggle}
            >
              <CheckSquare className="h-3 w-3" />
              <span>{completedItems}/{totalItems} completed</span>
              <Progress value={checklistProgress} className="h-1 flex-1" />
              {checklistExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {/* Expanded Checklist */}
            {checklistExpanded && (
              <div className="mt-2 space-y-1 pl-5">
                {task.checklist?.map((item: ChecklistItem) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 text-xs cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => handleChecklistItemToggle(item.id)}
                      className="h-3 w-3"
                    />
                    <span className={cn(item.completed && 'line-through text-muted-foreground')}>
                      {item.text}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions Footer */}
        <div className="flex items-center justify-between pt-1.5 border-t border-border">
          <Select
            value={task.status}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger 
              className="h-7 w-auto text-xs border-0 bg-transparent hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>

          {task.assignees && task.assignees.length > 0 && (
            <div className="flex -space-x-1">
              {task.assignees.slice(0, 3).map((assignee) => (
                <div key={assignee.id} className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-medium border-2 border-background">
                  {assignee.initials}
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[8px] border-2 border-background">
                  +{task.assignees.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
