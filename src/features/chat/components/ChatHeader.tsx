import { ArrowLeft, Phone, Search, UserPlus, Video, X, CalendarDays, Link, Loader2, AlertCircle, Info, Pin, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OnlineStatus } from './OnlineStatus';
import { Conversation } from '../types';
import { useAuth } from '@/contexts/AuthContext';
import { useChatStore } from '../stores/useChatStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';

// New Imports for Google Meet Integration & Call state
import { useGoogleMeetStatus } from '@/features/integrations/hooks/useGoogleMeetStatus';
import { useEnsureGoogleMeetToken } from '@/features/integrations/hooks/useEnsureGoogleMeetToken';
import { useCallStore } from '../stores/useCallStore';
import { chatTransport } from '../transport';
import { meetWindow } from '../utils/meetWindow';
import { googleMeetService } from '@/services/googleMeet.service';
import { chatService } from '@/services/chat.service';
import { buildCallCardContent } from '../utils/callCard';
import { registerCallCard } from '../utils/callCardRegistry';
import { ScheduleMeetingDialog } from './ScheduleMeetingDialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface ChatHeaderProps {
  conversation: Conversation;
  onBack?: () => void;
  onlineUserIds?: Set<string>;
  typingText?: string;
  onAddMember?: () => void;
  onSendMessage?: (content: string) => Promise<void>;
  pinnedCount?: number;
  favouriteCount?: number;
  filterMode?: 'pinned' | 'favourites' | null;
  onShowPinned?: () => void;
  onShowFavourites?: () => void;
  onCloseFilter?: () => void;
}

export function ChatHeader({
  conversation,
  onBack,
  onlineUserIds,
  typingText,
  onAddMember,
  onSendMessage,
  pinnedCount = 0,
  favouriteCount = 0,
  filterMode,
  onShowPinned,
  onShowFavourites,
  onCloseFilter,
}: ChatHeaderProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const setDetailPanelOpen = useChatStore((s) => s.setDetailPanelOpen);

  const isMessageSearchOpen = useChatStore((s) => s.isMessageSearchOpen);
  const messageSearchQuery = useChatStore((s) => s.messageSearchQuery);
  const setMessageSearchQuery = useChatStore((s) => s.setMessageSearchQuery);
  const toggleMessageSearch = useChatStore((s) => s.toggleMessageSearch);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Google Meet & Call states
  const { ensureFreshToken } = useEnsureGoogleMeetToken();
  const startOutgoingCall = useCallStore((s) => s.startOutgoingCall);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [startingCall, setStartingCall] = useState(false);

  useEffect(() => {
    if (isMessageSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isMessageSearchOpen]);

  const currentMember = conversation.members.find((m) => m.id === currentUserId);
  const isOwner = currentMember?.role === 'owner';

  const otherMember = conversation.type === 'dm'
    ? conversation.members.find((m) => m.id !== currentUserId)
    : null;

  const isOtherOnline = otherMember ? onlineUserIds?.has(otherMember.id) ?? false : false;

  const displayName = conversation.type === 'dm' ? otherMember?.name || conversation.name : conversation.name;
  const isEmoji = (str: string) => {
    const emojiRegex = /(©|®|[ -㌀]|\ud83c[퀀-\udfff]|\ud83d[퀀-\udfff]|\ud83e[퀀-\udfff])/;
    return emojiRegex.test(str) && str.length <= 8;
  };

  const computeInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return words[0]?.charAt(0).toUpperCase() || '??';
  };

  const initials = conversation.type === 'dm'
    ? otherMember?.initials || (otherMember?.name ? computeInitials(otherMember.name) : '??')
    : computeInitials(conversation.name || conversation.title || 'GC');

  const avatarUrl = conversation.type === 'dm' ? otherMember?.avatarUrl : conversation.avatarUrl;

  // All conversation members, including the viewer — the real
  // (backend-persisted) Google Meet connection status for each is looked up
  // below, replacing what used to be a hardcoded "everyone except Bob
  // Martinez is connected" test rule. Including the viewer's own id here
  // (rather than a separate query) is also what gates whether they can
  // start a call at all — see isSelfMeetConnected below.
  const memberIdsForMeetStatus = useMemo(
    () => conversation.members.map((m) => m.id),
    [conversation.members],
  );
  const { data: meetStatusMap } = useGoogleMeetStatus(memberIdsForMeetStatus);
  const isSelfMeetConnected = !!(currentUserId && meetStatusMap?.[currentUserId]?.connected);

  const handleInitiateCall = async (type: 'audio' | 'video') => {
    const otherMembers = conversation.members.filter((m) => m.id !== currentUserId);
    if (otherMembers.length === 0 || startingCall) return;

    const participants = otherMembers.map((m) => ({
      id: m.id,
      name: m.name,
      connected: meetStatusMap?.[m.id]?.connected ?? false,
    }));
    const reachable = participants.filter((p) => p.connected);
    const callId = crypto.randomUUID();

    if (reachable.length === 0) {
      // Nobody can actually be rung — show the "not connected" panel
      // immediately, no Meet space needed until "Send Link" is clicked.
      startOutgoingCall({
        callId,
        conversationId: conversation.id,
        callType: type,
        meetingUri: '',
        participants,
        isGroup: conversation.type === 'group',
      });
      return;
    }

    // Open the Meet tab now, synchronously, inside this click handler — the
    // ONLY popup opened for this gesture (some browsers only honor one
    // window.open() per click). A window opened later from the async
    // call:accepted socket event would be blocked outright, so we navigate
    // this same placeholder to the real URL once the callee accepts.
    meetWindow.openPlaceholder();

    setStartingCall(true);
    try {
      const token = await ensureFreshToken();
      if (!token) {
        toast.error('Your Google Meet session expired. Please reconnect in Integrations.');
        meetWindow.close();
        return;
      }
      const meetData = await googleMeetService.createInstantMeeting(token);
      startOutgoingCall({
        callId,
        conversationId: conversation.id,
        callType: type,
        meetingUri: meetData.meetingUri,
        participants,
        isGroup: conversation.type === 'group',
      });
      chatTransport.emitCallInvite({
        callId,
        conversationId: conversation.id,
        callType: type,
        meetingUri: meetData.meetingUri,
      });

      // Post the call-history card now (status 'ongoing' — "X started a meet" /
      // "Video call") and remember its id so it can be edited in place once the
      // call reaches a terminal state. Fire-and-forget: a failure here shouldn't
      // block the call itself, which is already ringing via Meet.
      const initiatorName = user?.name ?? 'You';
      const isGroupCall = conversation.type === 'group';
      chatService
        .sendCallCard(
          conversation.id,
          buildCallCardContent({
            kind: 'call-card',
            callId,
            callType: type,
            isGroup: isGroupCall,
            status: 'ongoing',
            durationSec: 0,
            initiatorId: currentUserId || '',
            initiatorName,
          }),
        )
        .then((created) => {
          registerCallCard(callId, {
            conversationId: conversation.id,
            callType: type,
            isGroup: isGroupCall,
            initiatorId: currentUserId || '',
            initiatorName,
            messageId: created.id,
            activeAt: null,
          });
        })
        .catch(() => {
          // No card was registered — later finalize attempts for this callId
          // simply no-op, which is fine since none was ever shown either.
        });
    } catch (err) {
      toast.error('Failed to start the call. Please try again.');
      meetWindow.close();
    } finally {
      setStartingCall(false);
    }
  };

  // Generate an instant meeting link and send to chat
  const handleGenerateInstantLink = async () => {
    setGeneratingLink(true);
    const loadingToast = toast.loading('Generating Google Meet space...');
    try {
      const token = await ensureFreshToken();
      if (!token) {
        toast.dismiss(loadingToast);
        toast.error('Your Google Meet session expired. Please reconnect in Integrations.');
        return;
      }
      const meetData = await googleMeetService.createInstantMeeting(token);
      if (onSendMessage && meetData.meetingUri) {
        await onSendMessage(`I created an instant Google Meet call. Let's connect here: ${meetData.meetingUri}`);
        toast.dismiss(loadingToast);
        toast.success('Meeting link generated and posted to chat!');
      } else {
        toast.dismiss(loadingToast);
        toast.error('Failed to automatically send the meeting link to chat.');
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error('Failed to create instant Google Meet. Please try re-connecting your account.');
    } finally {
      setGeneratingLink(false);
    }
  };

  const renderCallButtons = () => {
    const isDisabled = !isSelfMeetConnected;
    const buttonClass = cn(
      "h-8 w-auto px-1.5 gap-1 transition-opacity duration-200",
      isDisabled && "opacity-40 cursor-not-allowed"
    );

    const callIcon = (
      <span className="flex items-center gap-0.5">
        <Phone className="h-3.5 w-3.5" />
        <span className="text-muted-foreground text-xs leading-none">/</span>
        <Video className="h-3.5 w-3.5" />
      </span>
    );

    if (isDisabled) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button variant="ghost" size="icon" className={buttonClass} disabled>
                {callIcon}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent align="end" className="max-w-[220px] text-xs">
            First connect to Google Meet in the integrations and then you can call.
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={buttonClass} disabled={isDisabled}>
            {callIcon}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => handleInitiateCall('video')}
            disabled={startingCall}
            className="gap-2 cursor-pointer font-medium whitespace-nowrap"
          >
            {startingCall ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4 text-primary" />}
            Start a meet: Audio/Video
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleGenerateInstantLink}
            disabled={generatingLink}
            className="gap-2 cursor-pointer"
          >
            {generatingLink ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link className="h-4 w-4 text-emerald-500" />
            )}
            Generate Meeting Link
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setScheduleOpen(true)}
            className="gap-2 cursor-pointer"
          >
            <CalendarDays className="h-4 w-4 text-indigo-500" />
            Schedule Meeting
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  if (filterMode) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border min-h-[61px]">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCloseFilter} title="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {filterMode === 'pinned' ? (
            <Pin className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <Star className="h-4 w-4 text-amber-500 shrink-0 fill-amber-500" />
          )}
          <h3 className="text-sm font-semibold truncate">
            {filterMode === 'pinned' ? `Pinned Messages (${pinnedCount})` : `Favourite Messages (${favouriteCount})`}
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border min-h-[61px]">
      {onBack && (
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}

      <div
        className={cn(
          "flex items-center gap-3 cursor-pointer hover:bg-accent/50 p-1 -ml-1 rounded-lg transition-colors group",
          isMessageSearchOpen ? "shrink min-w-0 max-w-[130px] md:max-w-[200px]" : "flex-1 min-w-0"
        )}
        onClick={() => setDetailPanelOpen(true)}
      >
        <div className="relative shrink-0">
          <Avatar className="h-9 w-9 border border-border group-hover:border-primary/50 transition-colors">
            {avatarUrl && !isEmoji(avatarUrl) && (
              <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
            )}
            <AvatarFallback className={cn('text-xs font-medium', conversation.type === 'group' && 'bg-primary/10 text-primary')}>
              {isEmoji(avatarUrl || '') ? avatarUrl : initials}
            </AvatarFallback>
          </Avatar>
          {conversation.type === 'dm' && otherMember && (
            <OnlineStatus isOnline={isOtherOnline} size="md" className="absolute -bottom-0.5 -right-0.5 z-10" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{displayName}</h3>
          <p className="text-xs text-muted-foreground truncate">
            {typingText
              ? typingText
              : conversation.type === 'dm'
                ? isOtherOnline
                  ? 'Online'
                  : otherMember?.lastSeenAt
                    ? `Last seen ${formatDistanceToNowStrict(new Date(otherMember.lastSeenAt), { addSuffix: true })}`
                    : 'Offline'
                : `${conversation.members.length} members`
            }
          </p>
        </div>
      </div>

      {isMessageSearchOpen && (
        <div className="flex-1 relative flex items-center min-w-0 animate-in fade-in zoom-in-95 duration-200">
           <Search className="h-4 w-4 text-muted-foreground absolute left-3" />
           <Input
             ref={searchInputRef}
             value={messageSearchQuery}
             onChange={(e) => setMessageSearchQuery(e.target.value)}
             placeholder="Search..."
             className="w-full h-9 pl-9 pr-9 bg-muted/30 focus-visible:bg-transparent transition-colors"
           />
           <Button 
             variant="ghost" 
             size="icon" 
             className="h-7 w-7 absolute right-1 text-muted-foreground hover:text-foreground" 
             onClick={toggleMessageSearch}
           >
             <X className="h-4 w-4" />
           </Button>
        </div>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {!isMessageSearchOpen && (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Search" onClick={() => toggleMessageSearch()}>
            <Search className="h-4 w-4" />
          </Button>
        )}
        {conversation.type === 'group' && (isMobile || isOwner) && onAddMember && (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Add member" onClick={onAddMember}>
            <UserPlus className="h-4 w-4" />
          </Button>
        )}

        {!isMessageSearchOpen && (onShowPinned || onShowFavourites) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Info">
                <Info className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onShowPinned} className="gap-2 cursor-pointer">
                <Pin className="h-4 w-4 text-primary" />
                Pinned Messages
                {pinnedCount > 0 && <span className="ml-auto text-xs text-muted-foreground">{pinnedCount}</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShowFavourites} className="gap-2 cursor-pointer">
                <Star className="h-4 w-4 text-amber-500" />
                Favourite Messages
                {favouriteCount > 0 && <span className="ml-auto text-xs text-muted-foreground">{favouriteCount}</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Render voice/video call button triggers */}
        {renderCallButtons()}
      </div>

      {/* Schedule Dialog rendered here */}
      <ScheduleMeetingDialog
        conversation={conversation}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onMeetingScheduled={onSendMessage}
      />
    </div>
  );
}
