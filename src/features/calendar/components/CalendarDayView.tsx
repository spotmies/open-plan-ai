import React from 'react';
import { format } from 'date-fns';
import { Flag, AlertCircle, CheckSquare, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { CalendarEvent, getEventsForDate } from '../utils/calendarUtils';
import { CalendarEventCard } from './CalendarEventCard';
import { CalendarEventPreview } from './CalendarEventPreview';
import { CalendarMeetingCard } from './CalendarMeetingCard';

interface CalendarDayViewProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onScheduleMeeting?: (date: Date) => void;
}

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  date,
  events,
  onEventClick,
  onScheduleMeeting,
}) => {
  const dayEvents = getEventsForDate(events, date);
  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

  // Group by type
  const milestones = dayEvents.filter((e) => e.type === 'milestone');
  const issues = dayEvents.filter((e) => e.type === 'issue');
  const tasks = dayEvents.filter((e) => e.type === 'task');
  const meetings = dayEvents.filter((e) => e.type === 'meeting');

  const EventSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    items: CalendarEvent[];
    className?: string;
    renderItem?: (event: CalendarEvent) => React.ReactNode;
  }> = ({ title, icon, items, className, renderItem }) => {
    if (items.length === 0) return null;

    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <div className="grid gap-2">
          {items.map((event) =>
            renderItem ? (
              <div key={event.id} className="min-w-0">
                {renderItem(event)}
              </div>
            ) : (
              <CalendarEventPreview key={event.id} event={event} side="bottom">
                <div className="min-w-0" onClick={() => onEventClick(event)}>
                  <CalendarEventCard event={event} variant="full" />
                </div>
              </CalendarEventPreview>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Day header */}
      <div className="py-3 px-4 border-b border-border flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">{format(date, 'EEEE')}</div>
          <div className="text-sm text-muted-foreground">{format(date, 'MMMM d, yyyy')}</div>
        </div>
        {onScheduleMeeting && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9 rounded-lg shrink-0"
            onClick={() => onScheduleMeeting(date)}
          >
            <Video className="h-4 w-4" />
            <span className="hidden sm:inline">Schedule Meeting</span>
          </Button>
        )}
      </div>

      {/* Events */}
      <ScrollArea className="flex-1 py-3">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <CheckSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">No events scheduled</h3>
            <p className="text-sm text-muted-foreground">
              {isPast
                ? 'There were no tasks, milestones, issues, or meetings on this day.'
                : 'There are no tasks, milestones, issues, or meetings due on this day.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6 px-4">
            <EventSection
              title="Meetings"
              icon={<Video className="h-4 w-4 text-blue-600" />}
              items={meetings}
              renderItem={(event) => (
                <CalendarMeetingCard event={event} onClick={() => onEventClick(event)} />
              )}
            />
            <EventSection
              title="Milestones"
              icon={<Flag className="h-4 w-4 text-amber-600" />}
              items={milestones}
            />
            <EventSection
              title="Critical Issues"
              icon={<AlertCircle className="h-4 w-4 text-destructive" />}
              items={issues}
            />
            <EventSection
              title="Tasks"
              icon={<CheckSquare className="h-4 w-4 text-primary" />}
              items={tasks}
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
