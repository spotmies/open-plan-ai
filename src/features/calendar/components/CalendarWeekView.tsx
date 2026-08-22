import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarEvent, CalendarDay, getEventsForDate } from '../utils/calendarUtils';
import { CalendarEventCard } from './CalendarEventCard';
import { CalendarEventPreview } from './CalendarEventPreview';

interface CalendarWeekViewProps {
  days: CalendarDay[];
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  days,
  events,
  onDayClick,
  onEventClick,
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {days.map((day, index) => (
          <div
            key={index}
            className={cn(
              'py-3 text-center border-r border-border last:border-r-0',
              day.isToday && 'bg-primary/5'
            )}
          >
            <div className="text-xs font-medium text-muted-foreground">
              {format(day.date, 'EEE')}
            </div>
            <div
              className={cn(
                'text-lg font-semibold mt-1 w-8 h-8 mx-auto flex items-center justify-center rounded-full',
                day.isToday && 'bg-primary text-primary-foreground'
              )}
            >
              {format(day.date, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Day columns with events */}
      <div className="grid grid-cols-7 flex-1 min-h-0">
        {days.map((day, index) => {
          const dayEvents = getEventsForDate(events, day.date);

          // Sort events: meetings first, then milestones, then issues, then tasks
          const sortedEvents = [...dayEvents].sort((a, b) => {
            const typeOrder = { meeting: 0, milestone: 1, issue: 2, task: 3 };
            return typeOrder[a.type] - typeOrder[b.type];
          });

          return (
            <div
              key={index}
              className={cn(
                'border-r border-border last:border-r-0 flex flex-col min-h-0 overflow-hidden',
                day.isToday && 'bg-primary/5'
              )}
            >
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-1.5">
                  {sortedEvents.map((event) => (
                    <CalendarEventPreview key={event.id} event={event}>
                      <div onClick={() => onEventClick(event)}>
                        <CalendarEventCard event={event} variant="full" />
                      </div>
                    </CalendarEventPreview>
                  ))}
                  {sortedEvents.length === 0 && (
                    <div
                      className="h-16 flex items-center justify-center cursor-pointer hover:bg-accent/50 rounded transition-colors"
                      onClick={() => onDayClick(day.date)}
                    >
                      <span className="text-xs text-muted-foreground">No events</span>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
};
