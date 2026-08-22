// Transient, unpersisted UI-chrome flags that a deeply-nested screen needs to
// signal up to AppLayout — e.g. a mobile full-screen detail view that wants
// the global top app bar hidden while it's open. Not persisted: this must
// always reset to false on remount, never survive a reload.
import { create } from 'zustand';

interface UIChromeState {
  hideAppHeader: boolean;
  setHideAppHeader: (hide: boolean) => void;
}

export const useUIChromeStore = create<UIChromeState>((set) => ({
  hideAppHeader: false,
  setHideAppHeader: (hide) => set({ hideAppHeader: hide }),
}));
