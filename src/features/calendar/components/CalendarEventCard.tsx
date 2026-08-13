import React from 'react';
import { format } from 'date-fns';
import { Flag, AlertTriangle, AlertCircle, CheckCircle2, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarEvent } from '../utils/calendarUtils';
import { resolveFileUrl } from '@/utils/fileUrl';

interface CalendarEventCardProps {
  event: CalendarEvent;
  variant?: 'compact' | 'full';
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  'todo': 'border-l-[hsl(var(--status-todo))]',
  'in-progress': 'border-l-[hsl(var(--status-in-progress))]',
  'review': 'border-l-[hsl(var(--status-review))]',
  'done': 'border-l-[hsl(var(--status-done))]',
  'blocked': 'border-l-[hsl(var(--status-blocked))]',
};

const priorityBadgeVariants: Record<string, string> = {
  'critical': 'bg-destructive/10 text-destructive border-destructive/20',
  'major': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
};

const severityColors: Record<string, string> = {
  'critical': 'text-destructive',
  'major': 'text-orange-500',
};

export const CalendarEventCard: React.FC<CalendarEventCardProps> = ({
  event,
  variant = 'compact',
  onClick,
}) => {
  const isCompact = variant === 'compact';

  if (event.type === 'milestone') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors',
          'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30',
          event.completed && 'opacity-60'
        )}
      >
        {event.completed ? (
          <CheckCircle2 className="h-3 w-3 text-amber-600 flex-shrink-0" />
        ) : (
          <Flag className="h-3 w-3 text-amber-600 flex-shrink-0" />
        )}
        <span className={cn(
          'text-xs font-medium text-amber-700 dark:text-amber-400 truncate',
          event.completed && 'line-through'
        )}>
          {event.title}
        </span>
      </div>
    );
  }

  if (event.type === 'meeting') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors',
          'bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30'
        )}
      >
        <Video className="h-3 w-3 text-blue-600 flex-shrink-0" />
        <span className="text-xs font-medium text-blue-700 dark:text-blue-400 truncate flex-1 min-w-0">
          {event.title}
        </span>
        {!isCompact && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {format(event.date, 'h:mm a')}
          </span>
        )}
      </div>
    );
  }

  if (event.type === 'issue') {
    const isResolved = event.issueStatus === 'resolved' || event.issueStatus === 'wont-fix';
    return (
      <div
        onClick={onClick}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors',
          isResolved
            ? 'bg-green-500/5 hover:bg-green-500/10 border border-green-500/20'
            : 'bg-destructive/5 hover:bg-destructive/10 border border-destructive/20'
        )}
      >
        {isResolved ? (
          <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-600" />
        ) : (
          <AlertCircle className={cn('h-3 w-3 flex-shrink-0', severityColors[event.severity || 'major'])} />
        )}
        <span className={cn(
          'text-xs font-medium truncate flex-1 min-w-0',
          isResolved ? 'text-green-600 line-through' : 'text-destructive'
        )}>
          {event.title}
        </span>
        {!isCompact && event.projectName && (
          <Badge variant="outline" className="text-[10px] h-4 ml-auto shrink-0 max-w-[120px] truncate bg-muted/50 text-muted-foreground border-border">
            {event.projectName}
          </Badge>
        )}
        {!isCompact && event.severity && !isResolved && (
          <Badge variant="outline" className="text-[10px] h-4 shrink-0 bg-destructive/10 text-destructive border-destructive/20">
            {event.severity}
          </Badge>
        )}
      </div>
    );
  }

  // Task card
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all',
        'bg-card hover:bg-accent/50 border border-border hover:border-border/80',
        'border-l-2',
        statusColors[event.status || 'todo'] || 'border-l-muted',
        event.isBlocked && 'opacity-60'
      )}
    >
      {event.isBlocked && (
        <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
      )}
      
      <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
        {event.title}
      </span>

      {!isCompact && event.projectName && (
        <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0 max-w-[120px] truncate bg-muted/50 text-muted-foreground border-border">
          {event.projectName}
        </Badge>
      )}

      {!isCompact && (event.priority === 'critical' || event.priority === 'major') && (
        <Badge
          variant="outline"
          className={cn('text-[10px] h-4 px-1 shrink-0', priorityBadgeVariants[event.priority])}
        >
          {event.priority}
        </Badge>
      )}

      {!isCompact && event.assignees && event.assignees.length > 0 && (
        <div className="flex -space-x-1">
          {event.assignees.slice(0, 2).map((assignee) => (
            <Avatar key={assignee.id} className="h-4 w-4 border border-background">
              <AvatarImage src={resolveFileUrl(assignee.avatar) ?? assignee.avatar} alt={assignee.name} />
              <AvatarFallback className="text-[8px] bg-muted">
                {assignee.initials}
              </AvatarFallback>
            </Avatar>
          ))}
          {event.assignees.length > 2 && (
            <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center border border-background">
              <span className="text-[8px] text-muted-foreground">+{event.assignees.length - 2}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
