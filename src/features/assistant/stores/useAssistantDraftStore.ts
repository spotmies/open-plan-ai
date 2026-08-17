// Keeps the Assistant composer's in-progress state (draft text, staged
// files, scope/project/focus picks) alive across AssistantPanel unmounts —
// which happen constantly, since navigating to any other tab and back (or
// closing/reopening the floating widget) unmounts and remounts it. Keyed by
// conversationId (or 'new' for the blank composer), so each thread keeps its
// own draft, ChatGPT-style, instead of one shared box.
//
// Text/scope/project/focus persist to localStorage (survives a full reload);
// staged files are kept in-memory only — File objects aren't JSON-serializable,
// and losing unsent attachments across a hard reload matches ChatGPT's own
// behavior too.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AssistantScope, AssistantFocusEntity } from '../assistantData';

export interface AssistantDraft {
  value: string;
  scope: AssistantScope;
  selectedProjectId: string | null;
  focusEntities: AssistantFocusEntity[];
}

export const EMPTY_ASSISTANT_DRAFT: AssistantDraft = {
  value: '',
  scope: 'All projects',
  selectedProjectId: null,
  focusEntities: [],
};

// Stable reference so components defaulting missing map entries to "no
// files" don't trip React's "getSnapshot should be cached" warning by
// handing back a fresh [] literal on every render.
export const EMPTY_ASSISTANT_FILES: File[] = [];

interface AssistantDraftState {
  drafts: Record<string, AssistantDraft>;
  files: Record<string, File[]>;
  lastActiveConversationId: string | null;
  setDraft: (key: string, patch: Partial<AssistantDraft>) => void;
  clearDraft: (key: string) => void;
  // Clears only the sent message (text/focus/files) once it's on its way,
  // leaving scope/selectedProjectId in place — see AssistantPanel.handleSend.
  clearDraftMessage: (key: string) => void;
  // Scope/project picks are meant to survive within a single Assistant visit
  // (e.g. surviving a send) but not outlive it — called when the Assistant
  // route unmounts so returning later starts back at "All projects".
  resetAllScopes: () => void;
  setFiles: (key: string, files: File[]) => void;
  setLastActiveConversationId: (id: string | null) => void;
}

export const useAssistantDraftStore = create<AssistantDraftState>()(
  persist(
    (set) => ({
      drafts: {},
      files: {},
      lastActiveConversationId: null,

      setDraft: (key, patch) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [key]: { ...(state.drafts[key] ?? EMPTY_ASSISTANT_DRAFT), ...patch },
          },
        })),

      clearDraft: (key) =>
        set((state) => {
          const rest = { ...state.drafts };
          delete rest[key];
          const restFiles = { ...state.files };
          delete restFiles[key];
          return { drafts: rest, files: restFiles };
        }),

      clearDraftMessage: (key) =>
        set((state) => {
          const existing = state.drafts[key] ?? EMPTY_ASSISTANT_DRAFT;
          const restFiles = { ...state.files };
          delete restFiles[key];
          return {
            drafts: { ...state.drafts, [key]: { ...existing, value: '', focusEntities: [] } },
            files: restFiles,
          };
        }),

      resetAllScopes: () =>
        set((state) => ({
          drafts: Object.fromEntries(
            Object.entries(state.drafts).map(([key, draft]) => [
              key,
              { ...draft, scope: EMPTY_ASSISTANT_DRAFT.scope, selectedProjectId: EMPTY_ASSISTANT_DRAFT.selectedProjectId },
            ]),
          ),
        })),

      setFiles: (key, files) =>
        set((state) => ({ files: { ...state.files, [key]: files } })),

      setLastActiveConversationId: (id) => set({ lastActiveConversationId: id }),
    }),
    {
      name: 'assistant-draft-storage',
      // `files` (File objects) deliberately excluded — see header comment.
      partialize: (state) => ({
        drafts: state.drafts,
        lastActiveConversationId: state.lastActiveConversationId,
      }),
    },
  ),
);
