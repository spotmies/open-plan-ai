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
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleMeetStatus } from '@/features/integrations/hooks/useGoogleMeetStatus';
import { useEnsureGoogleMeetToken } from '@/features/integrations/hooks/useEnsureGoogleMeetToken';
import { googleMeetService } from '@/services/googleMeet.service';
import { logger } from '@/services/monitoring/logger';
import { Conversation } from '../types';
import { Calendar, Clock, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format, addMinutes } from 'date-fns';

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
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});

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
      });

      // Format human-friendly schedule details
      const dateStr = format(startDateTime, 'EEEE, MMMM d, yyyy');
      const timeStr = `${format(startDateTime, 'h:mm a')} - ${format(endDateTime, 'h:mm a')}`;
      
      const messageContent = `📅 Scheduled Google Meet: ${title}\n🕒 Time: ${dateStr} at ${timeStr}\n🔗 Join Meet: ${result.meetingUri}\n📅 Calendar Event: ${result.htmlLink}`;

      if (onMeetingScheduled) {
        await onMeetingScheduled(messageContent);
      }

      toast.success('Meeting scheduled and event created in Google Calendar!');
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
      <DialogContent className="sm:max-w-[480px]">
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
            <Button type="submit" disabled={loading} className="gap-2">
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
