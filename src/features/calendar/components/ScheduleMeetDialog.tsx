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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleMeetStatus } from '@/features/integrations/hooks/useGoogleMeetStatus';
import { useEnsureGoogleMeetToken } from '@/features/integrations/hooks/useEnsureGoogleMeetToken';
import { googleMeetService } from '@/services/googleMeet.service';
import { useCreateMeeting } from '@/hooks/useMeetings';
import { logger } from '@/services/monitoring/logger';
import { TeamMember } from '@/types';
import { CalendarPlus, Loader2, Users, UserPlus, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format, addMinutes } from 'date-fns';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ScheduleMeetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: TeamMember[];
  /** Pre-fill the meeting date (e.g. the day selected in the calendar). Time-of-day still defaults to the next half-hour slot. */
  initialDate?: Date;
}

export function ScheduleMeetDialog({ open, onOpenChange, teamMembers, initialDate }: ScheduleMeetDialogProps) {
  const { user } = useAuth();
  // Real (backend-persisted) status for the viewer — same source of truth as
  // the chat feature's meeting scheduler, not a stale local flag.
  const { data: meetStatusMap } = useGoogleMeetStatus(user ? [user.id] : []);
  const isConnected = !!(user && meetStatusMap?.[user.id]?.connected);
  const { ensureFreshToken } = useEnsureGoogleMeetToken();
  const { mutateAsync: createMeetingRecord } = useCreateMeeting();
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

  // Reset the form whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setTitle('');
      const now = new Date();
      const start = new Date(Math.ceil(now.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000));
      if (initialDate) {
        start.setFullYear(initialDate.getFullYear(), initialDate.getMonth(), initialDate.getDate());
      }
      const end = addMinutes(start, 30);
      setStartDate(format(start, 'yyyy-MM-dd'));
      setStartTime(format(start, 'HH:mm'));
      setEndDate(format(end, 'yyyy-MM-dd'));
      setEndTime(format(end, 'HH:mm'));
      setSelectedMembers({});
      setMemberSearch('');
      setGuestInput('');
      setGuestInputError('');
      setGuestEmails([]);
    }
  }, [open, initialDate]);

  const orgEmails = new Set(
    teamMembers.filter((m) => selectedMembers[m.id] && m.email).map((m) => m.email.toLowerCase())
  );

  const filteredTeamMembers = teamMembers.filter((m) => {
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
    if (!isConnected) {
      toast.error('Please connect Google Meet in Integrations first.');
      return;
    }

    // Fold any not-yet-added text left in the guest input into the final
    // list rather than silently dropping it on submit.
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
    if (endDateTime <= startDateTime) {
      toast.error('End time must be after the start time.');
      return;
    }

    const memberAttendees = teamMembers
      .filter((m) => selectedMembers[m.id] && m.email)
      .map((m) => m.email);
    const attendees = Array.from(new Set([...memberAttendees, ...finalGuestEmails]));

    if (attendees.length === 0) {
      toast.error('Please select at least one team member or invite an outside guest.');
      return;
    }

    setLoading(true);
    try {
      const token = await ensureFreshToken();
      if (!token) {
        toast.error('Your Google Meet session expired. Please reconnect in Integrations.');
        return;
      }

      const result = await googleMeetService.scheduleCalendarMeeting(token, {
        title,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        attendees,
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
        toast.warning('Meeting created in Google Calendar, but it may not show up on this app\'s Calendar.');
      }

      toast.success('Meeting scheduled and event created in Google Calendar!', {
        description: result.meetingUri,
      });
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
            <CalendarPlus className="h-5 w-5 text-primary" />
            Schedule a Meet
          </DialogTitle>
          <DialogDescription>
            Create a Google Meet event and invite team members or outside guests by email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="sm-title">Meeting Title</Label>
            <Input
              id="sm-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Candidate Interview"
              required
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="sm-start-date">Start Date</Label>
              <Input
                id="sm-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sm-start-time">Start Time</Label>
              <Input
                id="sm-start-time"
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
              <Label htmlFor="sm-end-date">End Date</Label>
              <Input
                id="sm-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sm-end-time">End Time</Label>
              <Input
                id="sm-end-time"
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
            <ScrollArea type="always" className="h-28 border rounded-lg p-3 bg-muted/20">
              <div className="space-y-2.5 pr-2">
                {filteredTeamMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {teamMembers.length === 0 ? 'No team members found.' : 'No matches found.'}
                  </p>
                )}
                {filteredTeamMembers.map((member) => (
                  <div key={member.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`sm-chk-${member.id}`}
                      checked={!!selectedMembers[member.id]}
                      onCheckedChange={(checked) =>
                        setSelectedMembers((prev) => ({ ...prev, [member.id]: !!checked }))
                      }
                      disabled={loading}
                    />
                    <label
                      htmlFor={`sm-chk-${member.id}`}
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
            <Label htmlFor="sm-guest-email" className="flex items-center gap-1.5 text-sm font-medium">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              Invite Outside Guests
            </Label>
            <div className="flex gap-2">
              <Input
                id="sm-guest-email"
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
                Select at least one team member or invite an outside guest to schedule this meeting.
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
