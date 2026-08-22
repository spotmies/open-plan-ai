import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarEvent, CalendarDay, getEventsForDate } from '../utils/calendarUtils';
import { CalendarEventCard } from './CalendarEventCard';
import { CalendarEventPreview } from './CalendarEventPreview';

interface CalendarMonthViewProps {
  days: CalendarDay[];
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_EVENTS = 3;

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  days,
  events,
  onDayClick,
  onEventClick,
}) => {
  return (
    <div className="h-full flex flex-col">
      {/* Calendar grid — rows share available height equally. The weekday name
          sits inside the first row's cells rather than in a band above the
          grid, so it reads as one column heading with the date. */}
      <div className="flex-1 min-h-0 grid grid-cols-7 auto-rows-[1fr]">
        {days.map((day, index) => {
          const dayEvents = getEventsForDate(events, day.date);
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const remainingCount = dayEvents.length - MAX_VISIBLE_EVENTS;

          return (
            <div
              key={index}
              className={cn(
                'min-w-0 p-1 border-b border-r border-border cursor-pointer transition-colors',
                'flex flex-col overflow-hidden',
                'hover:bg-accent/30',
                // The container draws the outer frame; without this the last
                // column and last row double it up with their own edge.
                (index + 1) % 7 === 0 && 'border-r-0',
                index >= days.length - 7 && 'border-b-0',
                !day.isCurrentMonth && 'bg-muted/30',
                day.isToday && day.isCurrentMonth && 'bg-primary/5'
              )}
              onClick={() => onDayClick(day.date)}
            >
              {/* Weekday name — first row only, directly above the date */}
              {index < 7 && (
                <div className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground shrink-0">
                  {WEEKDAY_HEADERS[index]}
                </div>
              )}

              {/* Date number */}
              <div className="flex items-center justify-center mb-1 shrink-0">
                <span
                  className={cn(
                    'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all',
                    !day.isCurrentMonth && 'text-muted-foreground/60',
                    day.isToday && day.isCurrentMonth
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-accent'
                  )}
                >
                  {format(day.date, 'd')}
                </span>
              </div>

              {/* Events */}
              <div className="flex-1 min-h-0 space-y-0.5 overflow-y-auto custom-scrollbar pr-0.5 pb-0.5">
                {visibleEvents.map((event) => (
                  <CalendarEventPreview key={event.id} event={event}>
                    <div onClick={(e) => { e.stopPropagation(); onEventClick(event); }}>
                      <CalendarEventCard event={event} variant="compact" />
                    </div>
                  </CalendarEventPreview>
                ))}
                {remainingCount > 0 && (
                  <button
                    className="w-full text-left px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDayClick(day.date);
                    }}
                  >
                    +{remainingCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
