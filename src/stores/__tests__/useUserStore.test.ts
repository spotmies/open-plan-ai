import { describe, it, expect, beforeEach } from 'vitest';
import { useUserStore, defaultPreferences } from '../useUserStore';

describe('useUserStore', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    useUserStore.setState({
      preferences: defaultPreferences,
      sidebarOpen: false,
    });
  });

  // ── Initial state ────────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should have default preferences', () => {
      const { preferences } = useUserStore.getState();
      expect(preferences.theme).toBe('system');
      expect(preferences.sidebarCollapsed).toBe(true);
      expect(preferences.compactMode).toBe(false);
    });

    it('should have default notification settings', () => {
      const { preferences } = useUserStore.getState();
      expect(preferences.notifications.taskAssignments).toBe(true);
      expect(preferences.notifications.taskCompletions).toBe(true);
      expect(preferences.notifications.comments).toBe(true);
      expect(preferences.notifications.projectUpdates).toBe(true);
      expect(preferences.notifications.milestoneReminders).toBe(true);
      expect(preferences.notifications.emailDigest).toBe('daily');
    });

    it('should have sidebar closed by default', () => {
      expect(useUserStore.getState().sidebarOpen).toBe(false);
    });
  });

  // ── updatePreferences ────────────────────────────────────────────────────────

  describe('updatePreferences', () => {
    it('should update theme preference', () => {
      useUserStore.getState().updatePreferences({ theme: 'dark' });
      expect(useUserStore.getState().preferences.theme).toBe('dark');
    });

    it('should update multiple preferences at once', () => {
      useUserStore.getState().updatePreferences({
        theme: 'light',
        compactMode: true,
        sidebarCollapsed: true,
      });

      const { preferences } = useUserStore.getState();
      expect(preferences.theme).toBe('light');
      expect(preferences.compactMode).toBe(true);
      expect(preferences.sidebarCollapsed).toBe(true);
    });

    it('should preserve existing preferences when partially updating', () => {
      useUserStore.getState().updatePreferences({ theme: 'dark' });
      useUserStore.getState().updatePreferences({ compactMode: true });

      const { preferences } = useUserStore.getState();
      expect(preferences.theme).toBe('dark');
      expect(preferences.compactMode).toBe(true);
    });

    it('should update notification preferences', () => {
      const { preferences: p } = useUserStore.getState();
      useUserStore.getState().updatePreferences({
        notifications: { ...p.notifications, taskAssignments: false, emailDigest: 'weekly' },
      });

      const { preferences } = useUserStore.getState();
      expect(preferences.notifications.taskAssignments).toBe(false);
      expect(preferences.notifications.emailDigest).toBe('weekly');
      expect(preferences.notifications.taskCompletions).toBe(true); // untouched
    });

    it('should handle partial notification updates without resetting other flags', () => {
      const p1 = useUserStore.getState().preferences;
      useUserStore.getState().updatePreferences({
        notifications: { ...p1.notifications, taskAssignments: false },
      });

      const p2 = useUserStore.getState().preferences;
      useUserStore.getState().updatePreferences({
        notifications: { ...p2.notifications, comments: false },
      });

      const { preferences } = useUserStore.getState();
      expect(preferences.notifications.taskAssignments).toBe(false);
      expect(preferences.notifications.comments).toBe(false);
      expect(preferences.notifications.taskCompletions).toBe(true);
    });

    it('should support all theme options', () => {
      const { updatePreferences } = useUserStore.getState();

      updatePreferences({ theme: 'light' });
      expect(useUserStore.getState().preferences.theme).toBe('light');

      updatePreferences({ theme: 'dark' });
      expect(useUserStore.getState().preferences.theme).toBe('dark');

      updatePreferences({ theme: 'system' });
      expect(useUserStore.getState().preferences.theme).toBe('system');
    });

    it('should support all email digest options', () => {
      const { updatePreferences } = useUserStore.getState();
      const base = useUserStore.getState().preferences.notifications;

      updatePreferences({ notifications: { ...base, emailDigest: 'daily' } });
      expect(useUserStore.getState().preferences.notifications.emailDigest).toBe('daily');

      updatePreferences({ notifications: { ...base, emailDigest: 'weekly' } });
      expect(useUserStore.getState().preferences.notifications.emailDigest).toBe('weekly');

      updatePreferences({ notifications: { ...base, emailDigest: 'none' } });
      expect(useUserStore.getState().preferences.notifications.emailDigest).toBe('none');
    });
  });

  // ── Sidebar ──────────────────────────────────────────────────────────────────

  describe('sidebar state', () => {
    it('should set sidebar open state', () => {
      useUserStore.getState().setSidebarOpen(true);
      expect(useUserStore.getState().sidebarOpen).toBe(true);

      useUserStore.getState().setSidebarOpen(false);
      expect(useUserStore.getState().sidebarOpen).toBe(false);
    });

    it('should toggle sidebar state', () => {
      useUserStore.setState({ sidebarOpen: false });

      useUserStore.getState().toggleSidebar();
      expect(useUserStore.getState().sidebarOpen).toBe(true);

      useUserStore.getState().toggleSidebar();
      expect(useUserStore.getState().sidebarOpen).toBe(false);
    });
  });
});
