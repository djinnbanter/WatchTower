import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SessionState = {
  inboxDismissed: string[];
  dismissedBanner: boolean;
  dismissInbox: (id: string) => void;
  undismissInbox: (id: string) => void;
  setDismissedBanner: (v: boolean) => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      inboxDismissed: [],
      dismissedBanner: false,
      dismissInbox: (id) =>
        set((s) => ({ inboxDismissed: s.inboxDismissed.includes(id) ? s.inboxDismissed : [...s.inboxDismissed, id] })),
      undismissInbox: (id) =>
        set((s) => ({ inboxDismissed: s.inboxDismissed.filter((x) => x !== id) })),
      setDismissedBanner: (dismissedBanner) => set({ dismissedBanner }),
    }),
    { name: 'wt-alpha-session' },
  ),
);
