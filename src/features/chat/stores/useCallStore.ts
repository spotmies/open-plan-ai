import { create } from 'zustand';

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'active';
export type CallType = 'audio' | 'video';

export interface CallParticipant {
  id: string;
  name: string;
  /** Real, backend-derived Google Meet connection status — never guessed. */
  connected: boolean;
}

interface CallStoreState {
  callState: CallState;
  callType: CallType | null;
  callId: string | null;
  conversationId: string | null;
  /** Real Google Meet join link — the actual call happens here (opened in a new tab). */
  meetingUri: string | null;
  isGroup: boolean;
  /** Everyone besides me involved in this call. */
  participants: CallParticipant[];
  callerId: string | null;
  callerName: string | null;
  isMuted: boolean;
  isCameraOff: boolean;
  callDuration: number; // seconds
  /** Wall-clock time (Date.now()) the call became active — duration is always derived from this, not accumulated tick-by-tick, so a throttled/backgrounded tab can't drift behind. */
  callStartedAt: number | null;

  startOutgoingCall: (params: {
    callId: string;
    conversationId: string;
    callType: CallType;
    meetingUri: string;
    participants: CallParticipant[];
    isGroup: boolean;
  }) => void;

  receiveIncomingCall: (params: {
    callId: string;
    conversationId: string;
    callType: CallType;
    meetingUri: string;
    callerId: string;
    callerName: string;
    participants: CallParticipant[];
    isGroup: boolean;
  }) => void;

  markActive: () => void;
  reset: () => void;
  /** Drops one participant from a still-active group call — does not end the call. */
  removeParticipant: (userId: string) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  syncDuration: () => void;
}

const idleState = {
  callState: 'idle' as CallState,
  callType: null as CallType | null,
  callId: null as string | null,
  conversationId: null as string | null,
  meetingUri: null as string | null,
  isGroup: false,
  participants: [] as CallParticipant[],
  callerId: null as string | null,
  callerName: null as string | null,
  isMuted: false,
  isCameraOff: false,
  callDuration: 0,
  callStartedAt: null as number | null,
};

export const useCallStore = create<CallStoreState>((set) => ({
  ...idleState,

  startOutgoingCall: ({ callId, conversationId, callType, meetingUri, participants, isGroup }) =>
    set({
      ...idleState,
      callState: 'outgoing',
      callId,
      conversationId,
      callType,
      meetingUri,
      participants,
      isGroup,
    }),

  receiveIncomingCall: ({ callId, conversationId, callType, meetingUri, callerId, callerName, participants, isGroup }) =>
    set({
      ...idleState,
      callState: 'incoming',
      callId,
      conversationId,
      callType,
      meetingUri,
      callerId,
      callerName,
      participants,
      isGroup,
    }),

  markActive: () => set({ callState: 'active', callDuration: 0, callStartedAt: Date.now() }),

  reset: () => set({ ...idleState }),

  removeParticipant: (userId) =>
    set((state) => ({ participants: state.participants.filter((p) => p.id !== userId) })),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleCamera: () => set((state) => ({ isCameraOff: !state.isCameraOff })),
  syncDuration: () =>
    set((state) =>
      state.callStartedAt ? { callDuration: Math.floor((Date.now() - state.callStartedAt) / 1000) } : state,
    ),
}));
