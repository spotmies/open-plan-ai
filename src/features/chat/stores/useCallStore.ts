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
  toggleMute: () => void;
  toggleCamera: () => void;
  incrementDuration: () => void;
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

  markActive: () => set({ callState: 'active', callDuration: 0 }),

  reset: () => set({ ...idleState }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleCamera: () => set((state) => ({ isCameraOff: !state.isCameraOff })),
  incrementDuration: () => set((state) => ({ callDuration: state.callDuration + 1 })),
}));
