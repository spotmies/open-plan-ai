import React from 'react';
import { format } from 'date-fns';
import { Flag, AlertCircle, CheckSquare, Users, Calendar, Folder, Video } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '../utils/calendarUtils';
import { resolveFileUrl } from '@/utils/fileUrl';

interface CalendarEventPreviewProps {
  event: CalendarEvent;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

const typeLabels: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  task: {
    label: 'Task',
    icon: <CheckSquare className="h-3 w-3" />,
    className: 'bg-primary/10 text-primary',
  },
  milestone: {
    label: 'Milestone',
    icon: <Flag className="h-3 w-3" />,
    className: 'bg-amber-500/10 text-amber-600',
  },
  issue: {
    label: 'Issue',
    icon: <AlertCircle className="h-3 w-3" />,
    className: 'bg-destructive/10 text-destructive',
  },
  meeting: {
    label: 'Meeting',
    icon: <Video className="h-3 w-3" />,
    className: 'bg-blue-500/10 text-blue-600',
  },
};

const statusLabels: Record<string, { label: string; className: string }> = {
  'todo': { label: 'To Do', className: 'bg-muted text-muted-foreground' },
  'in-progress': { label: 'In Progress', className: 'bg-blue-500/10 text-blue-600' },
  'review': { label: 'Review', className: 'bg-purple-500/10 text-purple-600' },
  'done': { label: 'Done', className: 'bg-green-500/10 text-green-600' },
  'blocked': { label: 'Blocked', className: 'bg-destructive/10 text-destructive' },
};

const priorityLabels: Record<string, { label: string; className: string }> = {
  'critical': { label: 'Critical', className: 'bg-destructive/10 text-destructive' },
  'major': { label: 'Major', className: 'bg-orange-500/10 text-orange-600' },
  'minor': { label: 'Minor', className: 'bg-yellow-500/10 text-yellow-600' },
  'trivial': { label: 'Trivial', className: 'bg-muted text-muted-foreground' },
};

const issueStatusLabels: Record<string, { label: string; className: string }> = {
  'open': { label: 'Open', className: 'bg-destructive/10 text-destructive' },
  'in-progress': { label: 'In Progress', className: 'bg-blue-500/10 text-blue-600' },
  'resolved': { label: 'Resolved', className: 'bg-green-500/10 text-green-600' },
  'wont-fix': { label: "Won't Fix", className: 'bg-muted text-muted-foreground' },
};

export const CalendarEventPreview: React.FC<CalendarEventPreviewProps> = ({
  event,
  children,
  side = 'right',
}) => {
  const typeInfo = typeLabels[event.type];
  const statusInfo = event.status ? statusLabels[event.status] : null;
  const priorityInfo = event.priority ? priorityLabels[event.priority] : null;

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80 p-4" side={side} align="start" collisionPadding={12}>
        <div className="space-y-3">
          {/* Type badge */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn('gap-1', typeInfo.className)}>
              {typeInfo.icon}
              {typeInfo.label}
            </Badge>
            {event.type === 'milestone' && event.completed && (
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                Completed
              </Badge>
            )}
            {event.type === 'issue' && event.issueStatus && issueStatusLabels[event.issueStatus] && (
              <Badge variant="secondary" className={issueStatusLabels[event.issueStatus].className}>
                {issueStatusLabels[event.issueStatus].label}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h4 className="font-semibold text-sm leading-tight">{event.title}</h4>

          {/* Status and Priority row */}
          {(statusInfo || priorityInfo) && (
            <div className="flex items-center gap-2">
              {statusInfo && (
                <Badge variant="secondary" className={cn('text-xs', statusInfo.className)}>
                  {statusInfo.label}
                </Badge>
              )}
              {priorityInfo && (
                <Badge variant="secondary" className={cn('text-xs', priorityInfo.className)}>
                  {priorityInfo.label}
                </Badge>
              )}
            </div>
          )}

          {/* Issue severity */}
          {event.type === 'issue' && event.severity && (
            <Badge 
              variant="secondary" 
              className={cn(
                'text-xs',
                event.severity === 'critical' && 'bg-destructive/10 text-destructive',
                event.severity === 'major' && 'bg-orange-500/10 text-orange-600'
              )}
            >
              {event.severity.charAt(0).toUpperCase() + event.severity.slice(1)} Priority
            </Badge>
          )}

          {/* Description */}
          {event.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {event.description}
            </p>
          )}

          {/* Meta info */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
            {/* Project */}
            {event.type !== 'meeting' && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Folder className="h-3 w-3" />
                <span>{event.projectName}</span>
              </div>
            )}

            {/* Date */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {event.type === 'meeting' ? (
                  <>
                    {format(event.date, 'MMM d, yyyy · h:mm a')}
                    {event.endDate && ` – ${format(event.endDate, 'h:mm a')}`}
                  </>
                ) : (
                  <>
                    {event.type === 'milestone' ? 'Target: ' : 'Due: '}
                    {format(event.date, 'MMM d, yyyy')}
                  </>
                )}
              </span>
            </div>

            {/* Meeting attendees */}
            {event.type === 'meeting' && event.attendeeEmails && event.attendeeEmails.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span className="truncate">
                  {event.attendeeEmails.length} invited
                </span>
              </div>
            )}

            {/* Assignees */}
            {event.assignees && event.assignees.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-muted-foreground" />
                <div className="flex items-center gap-1">
                  {event.assignees.map((assignee) => (
                    <Avatar key={assignee.id} className="h-5 w-5">
                      <AvatarImage src={resolveFileUrl(assignee.avatar) ?? assignee.avatar} alt={assignee.name} />
                      <AvatarFallback className="text-[10px] bg-muted">
                        {assignee.initials}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {event.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] h-5">
                  {tag}
                </Badge>
              ))}
              {event.tags.length > 4 && (
                <Badge variant="outline" className="text-[10px] h-5">
                  +{event.tags.length - 4}
                </Badge>
              )}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
