import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  format,
  isToday,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addDays,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { Search, Flag, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarEvent, getEventsForDate } from '../utils/calendarUtils';
import { CalendarDayView } from './CalendarDayView';
import { Button } from '@/components/ui/button';

// ─── Types ───────────────────────────────────────────────────────────────────

type MobileTab = 'agenda' | 'day';

interface MobileCalendarProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateChange: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  const tomorrow = addDays(new Date(), 1);
  if (isSameDay(date, tomorrow)) return 'Tomorrow';
  return format(date, 'EEEE');
}

/** Get the accent colour class for an event row's left border */
function eventBorderClass(event: CalendarEvent): string {
  if (event.type === 'milestone') return 'border-l-amber-500';
  if (event.type === 'issue') return 'border-l-destructive';
  if (event.type === 'meeting') return 'border-l-blue-500';
  const statusMap: Record<string, string> = {
    'todo': 'border-l-muted-foreground/40',
    'in-progress': 'border-l-blue-500',
    'review': 'border-l-violet-500',
    'done': 'border-l-green-500',
    'blocked': 'border-l-destructive',
  };
  return statusMap[event.status || 'todo'] ?? 'border-l-border';
}

/** Event type icon + colour */
function EventTypeIcon({ event }: { event: CalendarEvent }) {
  if (event.type === 'milestone')
    return <Flag className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />;
  if (event.type === 'issue')
    return <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />;
  if (event.type === 'meeting')
    return <Video className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />;
  if (event.status === 'done')
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />;
  return (
    <span
      className={cn(
        'h-2 w-2 rounded-full flex-shrink-0 mt-0.5',
        event.status === 'in-progress' && 'bg-blue-500',
        event.status === 'review' && 'bg-violet-500',
        event.status === 'blocked' && 'bg-destructive',
        (!event.status || event.status === 'todo') && 'bg-muted-foreground/40',
      )}
    />
  );
}

// ─── Week Strip ───────────────────────────────────────────────────────────────

interface WeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  expanded: boolean;
  onToggle: () => void;
}

function WeekStrip({ selectedDate, onSelectDate, expanded, onToggle }: WeekStripProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(selectedDate));
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(selectedDate));
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart) });
  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(monthCursor)),
    end: endOfWeek(endOfMonth(monthCursor)),
  });

  // Keep week in sync if selectedDate moves outside current week
  useEffect(() => {
    const ws = startOfWeek(selectedDate);
    if (!isSameDay(ws, weekStart)) setWeekStart(ws);
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep dropdown month in sync with selected date from parent navigation.
  useEffect(() => {
    setMonthCursor(startOfMonth(selectedDate));
  }, [selectedDate]);

  const handlePrevMonth = () => {
    const nextDate = subMonths(selectedDate, 1);
    setMonthCursor(startOfMonth(nextDate));
    onSelectDate(nextDate);
  };

  const handleNextMonth = () => {
    const nextDate = addMonths(selectedDate, 1);
    setMonthCursor(startOfMonth(nextDate));
    onSelectDate(nextDate);
  };

  return (
    <div className="bg-background border-b border-border">
      {/* Week navigation row */}
      <div className="flex items-center px-1">
        <button
          className="p-2 rounded-full hover:bg-accent transition-colors"
          onClick={() => setWeekStart((w) => subWeeks(w, 1))}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex flex-1 justify-around">
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const todayDay = isToday(day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => onSelectDate(day)}
                className="flex flex-col items-center py-2 px-1 min-w-0 flex-1"
              >
                {/* Day letter */}
                <span
                  className={cn(
                    'text-[11px] font-medium uppercase tracking-wide mb-1',
                    todayDay ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {format(day, 'EEEEE')}
                </span>
                {/* Date number inside a circle */}
                <span
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                    isSelected && todayDay && 'bg-primary text-primary-foreground',
                    isSelected && !todayDay && 'bg-foreground text-background',
                    !isSelected && todayDay && 'text-primary',
                    !isSelected && !todayDay && 'text-foreground',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </button>
            );
          })}
        </div>

        <button
          className="p-2 rounded-full hover:bg-accent transition-colors"
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Expand/collapse + month navigation row */}
      <div className="w-full grid grid-cols-[32px_1fr_32px] items-center px-2 py-1 border-t border-border/40">
        {expanded ? (
          <button
            onClick={handlePrevMonth}
            className="h-8 w-8 rounded-full hover:bg-accent transition-colors inline-flex items-center justify-center"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : (
          <span />
        )}

        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 py-1 hover:bg-accent/40 rounded transition-colors"
          aria-label={expanded ? 'Collapse calendar' : 'Expand calendar'}
        >
          {expanded && (
            <span className="text-xs font-medium text-foreground">{format(monthCursor, 'MMMM yyyy')}</span>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        </button>

        {expanded ? (
          <button
            onClick={handleNextMonth}
            className="h-8 w-8 rounded-full hover:bg-accent transition-colors inline-flex items-center justify-center"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : (
          <span />
        )}
      </div>

      {/* Expanded month grid (Teams-like) */}
      {expanded && (
        <div className="px-2 pb-2 border-t border-border/60">
          <div className="grid grid-cols-7 gap-y-1 pt-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
              <div key={day} className="text-[11px] text-muted-foreground text-center">
                {day}
              </div>
            ))}
            {monthDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const todayDay = isToday(day);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => onSelectDate(day)}
                  className="h-9 flex items-center justify-center"
                >
                  <span
                    className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                      !isSameMonth(day, monthCursor) && 'text-muted-foreground/60',
                      isSelected && 'bg-primary text-primary-foreground',
                      !isSelected && todayDay && 'text-primary',
                      !isSelected && isSameMonth(day, monthCursor) && 'text-foreground',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Agenda Event Row ─────────────────────────────────────────────────────────

function AgendaEventRow({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left',
        'bg-card hover:bg-accent/50 transition-colors',
        'border-l-[3px]',
        eventBorderClass(event),
      )}
    >
      {/* Left: type icon */}
      <div className="mt-0.5">
        <EventTypeIcon event={event} />
      </div>

      {/* Middle: title + project */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium text-foreground truncate',
            event.type === 'task' && event.status === 'done' && 'line-through text-muted-foreground',
            event.type === 'milestone' && event.completed && 'line-through text-muted-foreground',
          )}
        >
          {event.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.projectName}</p>
      </div>

      {/* Right: type badge */}
      <span
        className={cn(
          'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 capitalize',
          event.type === 'milestone' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
          event.type === 'issue' && 'bg-destructive/10 text-destructive',
          event.type === 'task' && 'bg-primary/10 text-primary',
        )}
      >
        {event.type}
      </span>
    </button>
  );
}

// ─── Day Group (used in Agenda tab) ───────────────────────────────────────────

function AgendaDayGroup({
  date,
  events,
  onEventClick,
  defaultOpen,
}: {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  defaultOpen?: boolean;
}) {
  const label = getDayLabel(date);
  const [open, setOpen] = useState(defaultOpen ?? true);
  const todayDay = isToday(date);

  return (
    <div>
      {/* Tappable date header — toggles collapse */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 sticky top-0 z-10 border-b border-border/50 text-left transition-colors',
          todayDay ? 'bg-primary/5' : 'bg-muted/30 hover:bg-muted/50',
        )}
      >
        <div className="flex items-baseline gap-2">
          <span className={cn('text-base font-bold', todayDay ? 'text-primary' : 'text-foreground')}>
            {format(date, 'd MMM')}
          </span>
          <span className="text-sm text-muted-foreground">{label}</span>
          {events.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground">· {events.length}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Collapsible events */}
      {open && (
        events.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground italic">No events</div>
        ) : (
          <div className="divide-y divide-border/50">
            {events.map((event) => (
              <AgendaEventRow
                key={event.id}
                event={event}
                onClick={() => onEventClick(event)}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ─── Agenda View ─────────────────────────────────────────────────────────────

function AgendaView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  // Show only the currently selected month in agenda.
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      }),
    [currentDate],
  );

  // Auto-scroll to the selected/current date in the expanded range.
  const focusDayRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    focusDayRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [currentDate]);

  return (
    <div className="flex-1 overflow-y-auto">
      {days.map((day) => {
        const dayEvents = getEventsForDate(events, day);
        return (
          <div key={day.toISOString()} ref={isSameDay(day, currentDate) ? focusDayRef : undefined}>
            <AgendaDayGroup
              date={day}
              events={dayEvents}
              onEventClick={onEventClick}
              defaultOpen={dayEvents.length > 0 || isToday(day)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MobileCalendar({
  currentDate,
  events,
  onDateChange,
  onEventClick,
}: MobileCalendarProps) {
  const [tab, setTab] = useState<MobileTab>('agenda');
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 bg-background">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground">
            {format(currentDate, 'MMMM')}
          </h1>
          <span className="text-sm text-muted-foreground font-medium">
            {format(currentDate, 'yyyy')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            <Search className="h-4.5 w-4.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* ── Tab Bar: Agenda / Day ── */}
      <div className="flex items-center gap-2 px-4 pb-2 bg-background border-b border-border">
        <button
          onClick={() => setTab('agenda')}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
            tab === 'agenda'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Agenda
        </button>
        <button
          onClick={() => setTab('day')}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
            tab === 'day'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Day
        </button>
      </div>

      {/* ── Week Strip ── */}
      <WeekStrip
        selectedDate={currentDate}
        onSelectDate={(date) => {
          onDateChange(date);
          setTab('day');
        }}
        expanded={calendarExpanded}
        onToggle={() => {
          setCalendarExpanded((prev) => !prev);
        }}
      />

      {/* ── Content ── */}
      {tab === 'agenda' ? (
        <AgendaView
          currentDate={currentDate}
          events={events}
          onEventClick={onEventClick}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <CalendarDayView
            date={currentDate}
            events={events}
            onEventClick={onEventClick}
          />
        </div>
      )}
    </div>
  );
}
