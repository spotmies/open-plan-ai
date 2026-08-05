// Transient, unpersisted open/closed state for the floating Assistant widget
// (see AssistantWidget.tsx), toggled from the "Ask ⌘K" header button and the
// global Cmd/Ctrl+K shortcut. Not persisted: always starts closed on reload.
import { create } from 'zustand';

interface AssistantWidgetState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useAssistantStore = create<AssistantWidgetState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
