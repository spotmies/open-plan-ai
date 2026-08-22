/**
 * Generic localStorage draft persistence for multi-step "create" forms (BOM Add Part,
 * ECO Wizard, ...). Lets an in-progress form survive an accidental tab close / refresh
 * without wiring each form's ~30 fields into a shared state manager.
 */
import { useEffect, useRef } from 'react';

const AUTOSAVE_DEBOUNCE_MS = 500;
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // stale drafts older than this are discarded

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage errors (e.g. private browsing with storage disabled)
  }
}

function writeDraft<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // draft persistence is a convenience, not critical — ignore quota/storage errors
  }
}

/** Reads a previously saved draft, discarding (and clearing) it if older than `DRAFT_MAX_AGE_MS`. */
export function readFreshDraft<T extends { savedAt: number }>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as T;
    if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      clearDraft(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

/** Debounced autosave of `data` under `key` while `enabled` is true. */
export function useDraftAutosave<T>(key: string, data: T, enabled: boolean): void {
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => writeDraft(key, data), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, JSON.stringify(data)]);
}
