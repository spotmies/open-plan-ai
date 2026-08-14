import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleMeetStatus } from '@/features/integrations/hooks/useGoogleMeetStatus';
import { useEnsureGoogleMeetToken } from '@/features/integrations/hooks/useEnsureGoogleMeetToken';
import { googleMeetService } from '@/services/googleMeet.service';
import { useCreateMeeting } from '@/hooks/useMeetings';
import { logger } from '@/services/monitoring/logger';
import { Conversation } from '../types';
import { Calendar, Clock, Loader2, Repeat, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format, addMinutes } from 'date-fns';

type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
type DailyMode = 'everyday' | 'specific';

// RFC 5545 BYDAY codes, displayed Monday-first per product spec.
const DAYS_OF_WEEK = [
  { rrule: 'MO', label: 'Monday', short: 'M' },
  { rrule: 'TU', label: 'Tuesday', short: 'T' },
  { rrule: 'WE', label: 'Wednesday', short: 'W' },
  { rrule: 'TH', label: 'Thursday', short: 'T' },
  { rrule: 'FR', label: 'Friday', short: 'F' },
  { rrule: 'SA', label: 'Saturday', short: 'S' },
  { rrule: 'SU', label: 'Sunday', short: 'S' },
] as const;

// Canonical (Mon-first) ordering of whichever BYDAY codes the user picked,
// independent of the order they clicked them in.
function orderSelectedDays(days: string[]): string[] {
  return DAYS_OF_WEEK.filter((d) => days.includes(d.rrule)).map((d) => d.rrule);
}

/** Builds the RFC 5545 RRULE line Google Calendar expects, or null for a one-off meeting. */
function buildRecurrenceRule(freq: RepeatFrequency, dailyMode: DailyMode, days: string[]): string | null {
  switch (freq) {
    case 'none':
      return null;
    case 'daily':
      if (dailyMode === 'everyday') return 'RRULE:FREQ=DAILY';
      // "Daily, on specific days" is the same shape as a weekly recurrence
      // restricted to those weekdays — that's how Google's own Calendar UI
      // represents it too.
      return days.length > 0 ? `RRULE:FREQ=WEEKLY;BYDAY=${orderSelectedDays(days).join(',')}` : null;
    case 'weekly':
      return 'RRULE:FREQ=WEEKLY';
    case 'monthly':
      return 'RRULE:FREQ=MONTHLY';
    case 'yearly':
      return 'RRULE:FREQ=YEARLY';
  }
}

/** Human-readable summary of the recurrence, for the chat confirmation message. */
function describeRecurrence(freq: RepeatFrequency, dailyMode: DailyMode, days: string[]): string | null {
  switch (freq) {
    case 'none':
      return null;
    case 'daily':
      if (dailyMode === 'everyday') return 'Every day';
      if (days.length === 0) return null;
      return `Weekly on ${orderSelectedDays(days)
        .map((code) => DAYS_OF_WEEK.find((d) => d.rrule === code)?.label.slice(0, 3))
        .join(', ')}`;
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
  }
}

interface ScheduleMeetingDialogProps {
  conversation: Conversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMeetingScheduled?: (messageContent: string) => Promise<void>;
}

export function ScheduleMeetingDialog({ 
  conversation, 
  open, 
  onOpenChange, 
  onMeetingScheduled 
}: ScheduleMeetingDialogProps) {
  const { user } = useAuth();
  // Real (backend-persisted) status for the viewer — same source of truth
  // as ChatHeader/Integrations, not a local sessionStorage flag that only
  // updates lazily on first token fetch.
  const { data: meetStatusMap } = useGoogleMeetStatus(user ? [user.id] : []);
  const isConnected = !!(user && meetStatusMap?.[user.id]?.connected);
  const { ensureFreshToken } = useEnsureGoogleMeetToken();
  const { mutateAsync: createMeetingRecord } = useCreateMeeting();
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});
  const [repeatFreq, setRepeatFreq] = useState<RepeatFrequency>('none');
  const [dailyMode, setDailyMode] = useState<DailyMode>('everyday');
  const [recurDays, setRecurDays] = useState<string[]>([]);

  // Prefill values when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(`${conversation.name} Sync`);
      
      const now = new Date();
      // Round to next 30-min block
      const start = new Date(Math.ceil(now.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000));
      const end = addMinutes(start, 30);

      setStartDate(format(start, 'yyyy-MM-dd'));
      setStartTime(format(start, 'HH:mm'));
      setEndDate(format(end, 'yyyy-MM-dd'));
      setEndTime(format(end, 'HH:mm'));

      setRepeatFreq('none');
      setDailyMode('everyday');
      setRecurDays([]);

      // Select other members by default (excluding "You")
      const membersMap: Record<string, boolean> = {};
      conversation.members.forEach((m) => {
        // Simple heuristic: email contains you@ or name is You or is current member id
        const isSelf = m.name.toLowerCase() === 'you' || (m.email ?? '').includes('you@');
        membersMap[m.id] = !isSelf;
      });
      setSelectedMembers(membersMap);
    }
  }, [open, conversation]);

  const hasAttendees = conversation.members.some((m) => selectedMembers[m.id] && m.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      toast.error('Please connect Google Meet in integrations first.');
      return;
    }

    // Parse start and end date/times
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      toast.error('Please select valid start and end times.');
      return;
    }

    if (endDateTime <= startDateTime) {
      toast.error('End time must be after the start time.');
      return;
    }

    if (repeatFreq === 'daily' && dailyMode === 'specific' && recurDays.length === 0) {
      toast.error('Please select at least one day for the recurring meeting.');
      return;
    }

    const hasSelectedAttendees = conversation.members.some((m) => selectedMembers[m.id] && m.email);
    if (!hasSelectedAttendees) {
      toast.error('Please select at least one attendee to schedule this meeting.');
      return;
    }

    const recurrenceRule = buildRecurrenceRule(repeatFreq, dailyMode, recurDays);
    const recurrenceSummary = describeRecurrence(repeatFreq, dailyMode, recurDays);

    setLoading(true);
    try {
      const token = await ensureFreshToken();
      if (!token) {
        toast.error('Your Google Meet session expired. Please reconnect in Integrations.');
        return;
      }

      // Gather attendee emails
      const attendees = conversation.members
        .filter((m) => selectedMembers[m.id] && m.email)
        .map((m) => m.email);

      const result = await googleMeetService.scheduleCalendarMeeting(token, {
        title,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        attendees,
        recurrence: recurrenceRule ? [recurrenceRule] : undefined,
      });

      // The Google Calendar event already exists at this point — persist a
      // record so it shows up in this app's own Calendar view too. If this
      // fails, the meeting still exists in Google Calendar, so we warn
      // rather than blocking on it.
      try {
        await createMeetingRecord({
          title,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          meetingUri: result.meetingUri,
          htmlLink: result.htmlLink,
          attendeeEmails: attendees,
        });
      } catch (persistErr) {
        logger.error('Meeting created in Google Calendar but failed to save locally', { error: persistErr });
      }

      // Format human-friendly schedule details
      const dateStr = format(startDateTime, 'EEEE, MMMM d, yyyy');
      const timeStr = `${format(startDateTime, 'h:mm a')} - ${format(endDateTime, 'h:mm a')}`;
      const repeatLine = recurrenceSummary ? `\n🔁 Repeats: ${recurrenceSummary}` : '';

      const messageContent = `📅 Scheduled Google Meet: ${title}\n🕒 Time: ${dateStr} at ${timeStr}${repeatLine}\n🔗 Join Meet: ${result.meetingUri}\n📅 Calendar Event: ${result.htmlLink}`;

      if (onMeetingScheduled) {
        await onMeetingScheduled(messageContent);
      }

      toast.success(
        recurrenceSummary
          ? `Recurring meeting scheduled (${recurrenceSummary}) in Google Calendar!`
          : 'Meeting scheduled and event created in Google Calendar!'
      );
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule meeting.';
      logger.error('Failed to schedule Google Meet meeting', { error: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Schedule Google Meet
          </DialogTitle>
          <DialogDescription>
            Create an event in Google Calendar with an automatic Google Meet space.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="meet-title">Meeting Title</Label>
            <Input
              id="meet-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sync & Catchup"
              required
              disabled={loading}
            />
          </div>

          {/* Date and Time selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-2">
            <Label htmlFor="repeat-freq" className="flex items-center gap-1.5 text-sm font-medium">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              Repeat
            </Label>
            <Select
              value={repeatFreq}
              onValueChange={(value) => setRepeatFreq(value as RepeatFrequency)}
              disabled={loading}
            >
              <SelectTrigger id="repeat-freq">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>

            {repeatFreq === 'daily' && (
              <div className="space-y-2.5 pt-1 pl-1">
                <RadioGroup
                  value={dailyMode}
                  onValueChange={(value) => setDailyMode(value as DailyMode)}
                  className="flex items-center gap-4"
                  disabled={loading}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="everyday" id="daily-everyday" />
                    <label htmlFor="daily-everyday" className="text-sm font-medium cursor-pointer">
                      Every day
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="specific" id="daily-specific" />
                    <label htmlFor="daily-specific" className="text-sm font-medium cursor-pointer">
                      Select specific days
                    </label>
                  </div>
                </RadioGroup>

                {dailyMode === 'specific' && (
                  <ToggleGroup
                    type="multiple"
                    value={recurDays}
                    onValueChange={(value) => setRecurDays(value)}
                    disabled={loading}
                    className="justify-start flex-wrap gap-1.5"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <ToggleGroupItem
                        key={day.rrule}
                        value={day.rrule}
                        aria-label={day.label}
                        title={day.label}
                        className="h-8 w-8 rounded-full p-0 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                      >
                        {day.short}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )}
              </div>
            )}
          </div>

          {/* Members / Attendees Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="h-4 w-4 text-muted-foreground" />
              Invite Attendees
            </Label>
            <ScrollArea className="h-32 border rounded-lg p-3 bg-muted/20">
              <div className="space-y-2.5">
                {conversation.members.map((member) => (
                  <div key={member.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`chk-${member.id}`}
                      checked={!!selectedMembers[member.id]}
                      onCheckedChange={(checked) => {
                        setSelectedMembers((prev) => ({
                          ...prev,
                          [member.id]: !!checked,
                        }));
                      }}
                      disabled={loading}
                    />
                    <label
                      htmlFor={`chk-${member.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {member.name} <span className="text-xs text-muted-foreground font-normal">({member.email})</span>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {!hasAttendees && (
              <p className="text-xs text-destructive">
                Select at least one attendee to schedule this meeting.
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !hasAttendees} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Schedule Meeting'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
