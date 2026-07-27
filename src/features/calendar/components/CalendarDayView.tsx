import React from 'react';
import { format } from 'date-fns';
import { Flag, AlertCircle, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarEvent, getEventsForDate } from '../utils/calendarUtils';
import { CalendarEventCard } from './CalendarEventCard';
import { CalendarEventPreview } from './CalendarEventPreview';

interface CalendarDayViewProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  date,
  events,
  onEventClick,
}) => {
  const dayEvents = getEventsForDate(events, date);
  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

  // Group by type
  const milestones = dayEvents.filter((e) => e.type === 'milestone');
  const issues = dayEvents.filter((e) => e.type === 'issue');
  const tasks = dayEvents.filter((e) => e.type === 'task');

  const EventSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    items: CalendarEvent[];
    className?: string;
  }> = ({ title, icon, items, className }) => {
    if (items.length === 0) return null;

    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <div className="grid gap-2">
          {items.map((event) => (
            <CalendarEventPreview key={event.id} event={event} side="bottom">
              <div className="min-w-0" onClick={() => onEventClick(event)}>
                <CalendarEventCard event={event} variant="full" />
              </div>
            </CalendarEventPreview>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Day header */}
      <div className="py-3 px-4 border-b border-border">
        <div className="text-2xl font-semibold">{format(date, 'EEEE')}</div>
        <div className="text-sm text-muted-foreground">{format(date, 'MMMM d, yyyy')}</div>
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
                ? 'There were no tasks, milestones, or issues on this day.'
                : 'There are no tasks, milestones, or issues due on this day.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6 px-4">
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
