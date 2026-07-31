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
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {WEEKDAY_HEADERS.map((day) => (
          <div
            key={day}
            className="py-3 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid — rows share available height equally */}
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
                !day.isCurrentMonth && 'bg-muted/30',
                day.isToday && day.isCurrentMonth && 'bg-primary/5'
              )}
              onClick={() => onDayClick(day.date)}
            >
              {/* Date number */}
              <div className="flex items-center justify-start mb-1 shrink-0">
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
