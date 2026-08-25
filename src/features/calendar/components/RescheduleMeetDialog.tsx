import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useEnsureGoogleMeetToken } from '@/features/integrations/hooks/useEnsureGoogleMeetToken';
import { googleMeetService } from '@/services/googleMeet.service';
import { useRescheduleMeeting, Meeting } from '@/hooks/useMeetings';
import { logger } from '@/services/monitoring/logger';
import { CalendarClock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface RescheduleMeetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting | null;
}

export function RescheduleMeetDialog({ open, onOpenChange, meeting }: RescheduleMeetDialogProps) {
  const { ensureFreshToken } = useEnsureGoogleMeetToken();
  const { mutateAsync: rescheduleMeetingRecord } = useRescheduleMeeting();
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');

  // Re-seed the form from the meeting's current time whenever it (re)opens.
  useEffect(() => {
    if (open && meeting) {
      const start = new Date(meeting.startTime);
      const end = new Date(meeting.endTime);
      setStartDate(format(start, 'yyyy-MM-dd'));
      setStartTime(format(start, 'HH:mm'));
      setEndDate(format(end, 'yyyy-MM-dd'));
      setEndTime(format(end, 'HH:mm'));
    }
  }, [open, meeting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting) return;

    if (!meeting.googleEventId) {
      toast.error(
        'This meeting was created before reschedule support was added and can\'t be updated automatically. Please cancel it and schedule a new one.'
      );
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      toast.error('Please select valid start and end times.');
      return;
    }
    if (startDateTime < new Date()) {
      toast.error('Start time must be now or in the future.');
      return;
    }
    if (endDateTime <= startDateTime) {
      toast.error('End time must be after the start time.');
      return;
    }

    setLoading(true);
    try {
      const token = await ensureFreshToken();
      if (!token) {
        toast.error('Your Google Meet session expired. Please reconnect in Integrations.');
        return;
      }

      // Patch the same Google Calendar event with sendUpdates=all so every
      // attendee gets notified and their calendar reflects the new time —
      // this must happen before we touch our own record, since our record
      // is just a mirror for this app's Calendar view.
      await googleMeetService.updateCalendarMeeting(token, meeting.googleEventId, {
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      });

      try {
        await rescheduleMeetingRecord({
          meetingId: meeting.id,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
        });
      } catch (persistErr) {
        logger.error('Meeting rescheduled in Google Calendar but failed to save locally', { error: persistErr });
        toast.warning('Meeting rescheduled in Google Calendar, but the new time may not show up on this app\'s Calendar.');
      }

      toast.success('Meeting rescheduled — attendees notified by email.');
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reschedule meeting.';
      logger.error('Failed to reschedule Google Meet meeting', { error: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Reschedule Meeting
          </DialogTitle>
          <DialogDescription>
            {meeting?.title ? `"${meeting.title}" — ` : ''}
            Attendees will be notified by email and their Google Calendar will update automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="rs-start-date">Start Date</Label>
              <Input
                id="rs-start-date"
                type="date"
                value={startDate}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rs-start-time">Start Time</Label>
              <Input
                id="rs-start-time"
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
              <Label htmlFor="rs-end-date">End Date</Label>
              <Input
                id="rs-end-date"
                type="date"
                value={endDate}
                min={startDate || format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rs-end-time">End Time</Label>
              <Input
                id="rs-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                'Reschedule Meeting'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
