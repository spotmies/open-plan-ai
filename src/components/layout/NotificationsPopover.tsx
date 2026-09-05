import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, CheckCircle2, AlertCircle, FolderKanban, Clock, Activity, MessageSquare, UserMinus, UserPlus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useNotifications, AppNotification } from '@/hooks/useNotifications';
import { useIsMobile } from '@/hooks/use-mobile';

const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
        case 'task_assigned':
            return <FolderKanban className="h-4 w-4 text-purple-500" />;
        case 'issue_assigned':
        case 'issue_resolved':
        case 'issue_linked_to_task':
            return <AlertCircle className="h-4 w-4 text-red-500" />;
        case 'bom_approval_requested':
        case 'bom_approval_decided':
        case 'task_completed':
        case 'issue_completed':
            return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case 'task_unassigned':
        case 'issue_unassigned':
            return <UserMinus className="h-4 w-4 text-muted-foreground" />;
        case 'eco_decision_requested':
            return <Activity className="h-4 w-4 text-blue-500" />;
        case 'chat_message':
            return <MessageSquare className="h-4 w-4 text-primary" />;
        case 'team_invitation':
            return <UserPlus className="h-4 w-4 text-purple-500" />;
        default:
            return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
};

export function NotificationsPopover() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useIsMobile();
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

    const handleMarkAsRead = (id: string) => {
        markAsRead.mutate(id);
    };

    const handleMarkAllAsRead = () => {
        markAllAsRead.mutate();
    };

    if (isMobile) {
        return (
            <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 border border-border rounded-xl"
                onClick={() => navigate('/notifications')}
                aria-label="Open notifications"
            >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-status-in-progress rounded-full flex items-center justify-center">
                        <span className="text-[10px] font-medium text-white">{unreadCount}</span>
                    </span>
                )}
            </Button>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-status-in-progress rounded-full flex items-center justify-center">
                            <span className="text-[10px] font-medium text-white">{unreadCount}</span>
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-0">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">Notifications</h3>
                        {unreadCount > 0 && (
                            <span className="bg-status-in-progress/10 text-status-in-progress text-xs font-medium px-2 py-0.5 rounded-full">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 text-muted-foreground hover:text-foreground"
                                onClick={handleMarkAllAsRead}
                            >
                                Mark all as read
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Notification settings"
                            onClick={() => {
                                setOpen(false);
                                navigate('/settings?tab=notifications');
                            }}
                        >
                            <Settings className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                <Bell className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-foreground">No notifications yet</p>
                            <p className="text-xs text-muted-foreground mt-1">We'll notify you when something arrives</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {notifications.map((notification) => (
                                <button
                                    key={notification.id}
                                    className={cn(
                                        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                                        !notification.read && 'bg-status-in-progress/5'
                                    )}
                                    onClick={() => {
                                        handleMarkAsRead(notification.id);
                                        setOpen(false);
                                        if (notification.actionUrl) {
                                            navigate(notification.actionUrl, {
                                                state: { backTo: location.pathname + location.search },
                                            });
                                        }
                                    }}
                                >
                                    <div className="flex-shrink-0 mt-0.5">
                                        {notification.initials ? (
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                                    {notification.initials}
                                                </AvatarFallback>
                                            </Avatar>
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={cn(
                                                'text-sm line-clamp-1',
                                                !notification.read ? 'font-medium text-foreground' : 'text-muted-foreground'
                                            )}>
                                                {notification.title}
                                            </p>
                                            {!notification.read && (
                                                <span className="flex-shrink-0 h-2 w-2 bg-status-in-progress rounded-full mt-1.5" />
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                            {notification.description}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                <Clock className="h-2.5 w-2.5" />
                                                {notification.time}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {notifications.length > 0 && (
                    <div className="border-t border-border p-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs h-8 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                                setOpen(false);
                                navigate('/notifications');
                            }}
                        >
                            View all notifications
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
