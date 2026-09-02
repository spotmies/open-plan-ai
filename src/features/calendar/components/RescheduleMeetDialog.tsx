import { useState, useEffect, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleMeetStatus } from '@/features/integrations/hooks/useGoogleMeetStatus';
import { useEnsureGoogleMeetToken } from '@/features/integrations/hooks/useEnsureGoogleMeetToken';
import { googleMeetService } from '@/services/googleMeet.service';
import { useRescheduleMeeting, Meeting } from '@/hooks/useMeetings';
import { logger } from '@/services/monitoring/logger';
import { TeamMember } from '@/types';
import { CalendarClock, Loader2, Users, UserPlus, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RescheduleMeetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting | null;
  teamMembers: TeamMember[];
}

export function RescheduleMeetDialog({ open, onOpenChange, meeting, teamMembers }: RescheduleMeetDialogProps) {
  const { user } = useAuth();
  const statusLookupIds = useMemo(
    () => [...new Set([user?.id, ...teamMembers.map((m) => m.id)].filter((id): id is string => !!id))],
    [user?.id, teamMembers]
  );
  const { data: meetStatusMap } = useGoogleMeetStatus(statusLookupIds);

  // The organizer is always the meeting creator, so exclude them from the
  // selectable/invitable team member list — same as ScheduleMeetDialog.
  const selectableTeamMembers = useMemo(
    () => teamMembers.filter((m) => m.id !== user?.id),
    [teamMembers, user?.id]
  );

  // Same platform-email-vs-connected-Google-email split as ScheduleMeetDialog
  // — see resolveGoogleAttendeeEmail there for the full rationale.
  const resolveGoogleAttendeeEmail = (member: TeamMember): string => {
    const status = meetStatusMap?.[member.id];
    return status?.connected && status.email ? status.email : member.email;
  };

  const { ensureFreshToken } = useEnsureGoogleMeetToken();
  const { mutateAsync: rescheduleMeetingRecord } = useRescheduleMeeting();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});
  const [memberSearch, setMemberSearch] = useState('');
  const [guestInput, setGuestInput] = useState('');
  const [guestInputError, setGuestInputError] = useState('');
  const [guestEmails, setGuestEmails] = useState<string[]>([]);

  // Re-seed the form from the meeting's current details whenever it (re)opens.
  useEffect(() => {
    if (open && meeting) {
      const start = new Date(meeting.startTime);
      const end = new Date(meeting.endTime);
      setTitle(meeting.title);
      setStartDate(format(start, 'yyyy-MM-dd'));
      setStartTime(format(start, 'HH:mm'));
      setEndDate(format(end, 'yyyy-MM-dd'));
      setEndTime(format(end, 'HH:mm'));

      const existingEmails = new Set(meeting.attendeeEmails.map((e) => e.toLowerCase()));
      const nextSelected: Record<string, boolean> = {};
      selectableTeamMembers.forEach((m) => {
        if (m.email && existingEmails.has(m.email.toLowerCase())) {
          nextSelected[m.id] = true;
        }
      });
      setSelectedMembers(nextSelected);

      const memberEmails = new Set(
        selectableTeamMembers.filter((m) => m.email).map((m) => m.email.toLowerCase())
      );
      setGuestEmails(meeting.attendeeEmails.filter((e) => !memberEmails.has(e.toLowerCase())));

      setMemberSearch('');
      setGuestInput('');
      setGuestInputError('');
    }
  }, [open, meeting, selectableTeamMembers]);

  const orgEmails = new Set(
    selectableTeamMembers.filter((m) => selectedMembers[m.id] && m.email).map((m) => m.email.toLowerCase())
  );

  const filteredTeamMembers = selectableTeamMembers.filter((m) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const hasAttendees =
    orgEmails.size > 0 || guestEmails.length > 0 || EMAIL_RE.test(guestInput.trim());

  const tryAddGuestEmail = (email: string, currentGuests: string[]): string[] | null => {
    if (!EMAIL_RE.test(email)) {
      setGuestInputError('Please enter a valid email address');
      return null;
    }
    const lower = email.toLowerCase();
    if (currentGuests.some((e) => e.toLowerCase() === lower) || orgEmails.has(lower)) {
      setGuestInputError('This person is already invited');
      return null;
    }
    return [...currentGuests, email];
  };

  const addGuestEmail = () => {
    const email = guestInput.trim();
    if (!email) return;
    const next = tryAddGuestEmail(email, guestEmails);
    if (next) {
      setGuestEmails(next);
      setGuestInput('');
      setGuestInputError('');
    }
  };

  const removeGuestEmail = (email: string) => {
    setGuestEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleGuestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addGuestEmail();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting) return;

    if (!meeting.googleEventId) {
      toast.error(
        'This meeting was created before reschedule support was added and can\'t be updated automatically. Please cancel it and schedule a new one.'
      );
      return;
    }

    let finalGuestEmails = guestEmails;
    const pendingGuest = guestInput.trim();
    if (pendingGuest) {
      const next = tryAddGuestEmail(pendingGuest, finalGuestEmails);
      if (!next) return;
      finalGuestEmails = next;
      setGuestEmails(next);
      setGuestInput('');
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

    const selectedTeamMembers = selectableTeamMembers.filter((m) => selectedMembers[m.id] && m.email);
    const memberAttendees = selectedTeamMembers.map((m) => m.email);
    const attendees = Array.from(new Set([...memberAttendees, ...finalGuestEmails]));

    if (attendees.length === 0) {
      toast.error('Please select at least one team member or invite an outside guest.');
      return;
    }

    const googleAttendees = Array.from(
      new Set([...selectedTeamMembers.map(resolveGoogleAttendeeEmail), ...finalGuestEmails])
    );

    setLoading(true);
    try {
      const token = await ensureFreshToken();
      if (!token) {
        toast.error('Your Google Meet session expired. Please reconnect in Integrations.');
        return;
      }

      // Patch the same Google Calendar event with sendUpdates=all so every
      // attendee gets notified and their calendar reflects the new details —
      // this must happen before we touch our own record, since our record
      // is just a mirror for this app's Calendar view.
      await googleMeetService.updateCalendarMeeting(token, meeting.googleEventId, {
        title,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        attendees: googleAttendees,
      });

      try {
        await rescheduleMeetingRecord({
          meetingId: meeting.id,
          title,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          attendeeEmails: attendees,
        });
      } catch (persistErr) {
        logger.error('Meeting updated in Google Calendar but failed to save locally', { error: persistErr });
        toast.warning('Meeting updated in Google Calendar, but the changes may not show up on this app\'s Calendar.');
      }

      toast.success('Meeting updated — attendees notified by email.');
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update meeting.';
      logger.error('Failed to update Google Meet meeting', { error: message });
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
            <CalendarClock className="h-5 w-5 text-primary" />
            Edit Meeting
          </DialogTitle>
          <DialogDescription>
            Attendees will be notified by email and their Google Calendar will update automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="rs-title">Meeting Title</Label>
            <Input
              id="rs-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Candidate Interview"
              required
              disabled={loading}
            />
          </div>

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

          {/* Org team members */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="h-4 w-4 text-muted-foreground" />
              Team Members
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search team members..."
                className="h-8 pl-8 text-sm"
                disabled={loading}
              />
            </div>
            {selectableTeamMembers.filter((member) => selectedMembers[member.id]).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectableTeamMembers
                  .filter((member) => selectedMembers[member.id])
                  .map((member) => (
                    <Badge key={member.id} variant="secondary" className="h-6 gap-1 text-xs">
                      {member.name}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-foreground"
                        onClick={() =>
                          setSelectedMembers((prev) => ({ ...prev, [member.id]: false }))
                        }
                      />
                    </Badge>
                  ))}
              </div>
            )}
            <ScrollArea type="always" className="h-28 border rounded-lg p-3 bg-muted/20">
              <div className="space-y-2.5 pr-2">
                {filteredTeamMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectableTeamMembers.length === 0 ? 'No team members found.' : 'No matches found.'}
                  </p>
                )}
                {filteredTeamMembers.map((member) => (
                  <div key={member.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`rs-chk-${member.id}`}
                      checked={!!selectedMembers[member.id]}
                      onCheckedChange={(checked) =>
                        setSelectedMembers((prev) => ({ ...prev, [member.id]: !!checked }))
                      }
                      disabled={loading}
                    />
                    <label
                      htmlFor={`rs-chk-${member.id}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {member.name}{' '}
                      <span className="text-xs text-muted-foreground font-normal">({member.email})</span>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Outside (non-org) guests, invited by email */}
          <div className="space-y-2">
            <Label htmlFor="rs-guest-email" className="flex items-center gap-1.5 text-sm font-medium">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              Invite Outside Guests
            </Label>
            <div className="flex gap-2">
              <Input
                id="rs-guest-email"
                type="email"
                value={guestInput}
                onChange={(e) => {
                  setGuestInput(e.target.value);
                  setGuestInputError('');
                }}
                onKeyDown={handleGuestKeyDown}
                placeholder="name@example.com"
                disabled={loading}
              />
              <Button type="button" variant="outline" onClick={addGuestEmail} disabled={loading}>
                Add
              </Button>
            </div>
            {guestInputError && <p className="text-xs text-destructive">{guestInputError}</p>}
            {guestEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {guestEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="h-6 gap-1 text-xs">
                    {email}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-foreground"
                      onClick={() => removeGuestEmail(email)}
                    />
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Guests don&apos;t need an Open Plan AI account — they&apos;ll get a Google Calendar invite by email.
            </p>
            {!hasAttendees && (
              <p className="text-xs text-destructive">
                Select at least one team member or invite an outside guest to keep this meeting.
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !hasAttendees} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
