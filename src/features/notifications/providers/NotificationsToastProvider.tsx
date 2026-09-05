import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FolderKanban, AlertCircle, CheckCircle2, Activity, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { chatTransport } from '@/features/chat/transport';
import type { Notification } from '@/services/notifications.service';

// Only the "you've been assigned/requested to act" types get a toast — other
// notification types (task_completed, team_invitation, etc.) still land in the
// bell but don't interrupt with a popup. chat_message/chat_mention are excluded
// because ChatNotificationsProvider already toasts those from the chat socket
// stream; toasting them again here would double them up.
const TOASTABLE_TYPES: Record<string, { icon: LucideIcon; iconClassName: string }> = {
  task_assigned: { icon: FolderKanban, iconClassName: 'text-purple-500' },
  issue_assigned: { icon: AlertCircle, iconClassName: 'text-red-500' },
  bom_approval_requested: { icon: CheckCircle2, iconClassName: 'text-green-500' },
  eco_decision_requested: { icon: Activity, iconClassName: 'text-blue-500' },
};

/**
 * Mounted once near the app root (alongside ChatNotificationsProvider) so a
 * newly assigned task/issue or a BOM/ECO approval request surfaces as a toast
 * no matter which page the assignee is currently on, in addition to updating
 * the notification bell (handled separately by useNotifications).
 */
export function NotificationsToastProvider() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const socket = (chatTransport as any).socket;
    if (!socket) return;

    const handler = (notification: Notification) => {
      const config = TOASTABLE_TYPES[notification.type];
      if (!config) return;

      const Icon = config.icon;
      toast.custom((toastId) => (
        <button
          type="button"
          onClick={() => {
            toast.dismiss(toastId);
            if (notification.actionUrl) {
              // Captured at click time (not effect-registration time) since this
              // provider is mounted once near the app root and doesn't re-render
              // as the user navigates between pages.
              navigate(notification.actionUrl, {
                state: { backTo: window.location.pathname + window.location.search },
              });
            }
          }}
          className="flex w-full items-start gap-3 rounded-lg border border-border bg-background p-3 text-left shadow-lg transition-colors hover:bg-accent/50"
        >
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ${config.iconClassName}`}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{notification.title}</span>
            {notification.content && (
              <span className="block truncate text-xs text-muted-foreground">{notification.content}</span>
            )}
          </span>
        </button>
      ));
    };

    socket.on('notification:created', handler);
    return () => { socket.off('notification:created', handler); };
  }, [user, navigate]);

  return null;
}
