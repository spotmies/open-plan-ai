import React from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { Video, Calendar, Clock, Users, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CalendarEvent } from '../utils/calendarUtils';

interface CalendarMeetingCardProps {
  event: CalendarEvent;
  onClick?: () => void;
}

function formatDuration(start: Date, end?: Date): string | null {
  if (!end) return null;
  const minutes = differenceInMinutes(end, start);
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

export const CalendarMeetingCard: React.FC<CalendarMeetingCardProps> = ({ event, onClick }) => {
  const duration = formatDuration(event.date, event.endDate);
  const link = event.htmlLink || event.meetingUri;

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary" className="gap-1 bg-blue-500/10 text-blue-600">
          <Video className="h-3 w-3" />
          Meeting
        </Badge>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left text-sm font-semibold leading-tight text-foreground hover:underline"
      >
        {event.title}
      </button>

      {event.description && (
        <p className="text-xs text-muted-foreground">{event.description}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>
            {format(event.date, 'MMM d, yyyy · h:mm a')}
            {event.endDate && ` – ${format(event.endDate, 'h:mm a')}`}
          </span>
        </div>

        {duration && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{duration}</span>
          </div>
        )}

        {event.attendeeEmails && event.attendeeEmails.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Users className="h-3 w-3 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span>{event.attendeeEmails.length} invited</span>
              <p className="text-[11px] text-muted-foreground/80 truncate">
                {event.attendeeEmails.join(', ')}
              </p>
            </div>
          </div>
        )}
      </div>

      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          <ExternalLink className="h-3 w-3" />
          Join meeting
        </a>
      )}
    </div>
  );
};
