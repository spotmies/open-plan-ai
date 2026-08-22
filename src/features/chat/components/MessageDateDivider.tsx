import { useUserTimezone } from '@/hooks/useUserTimezone';
import { isTodayInTimezone, isYesterdayInTimezone, formatDateInTimezone } from '@/utils/dateTime';

interface MessageDateDividerProps {
  date: Date;
}

export function MessageDateDivider({ date }: MessageDateDividerProps) {
  const timezone = useUserTimezone();

  let label: string;
  if (isTodayInTimezone(date, timezone)) label = 'Today';
  else if (isYesterdayInTimezone(date, timezone)) label = 'Yesterday';
  else label = formatDateInTimezone(date, timezone);

  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
