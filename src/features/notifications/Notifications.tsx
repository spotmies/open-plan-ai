import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Bell,
    CheckCircle2,
    AlertCircle,
    FolderKanban,
    Clock,
    MoreHorizontal,
    Check,
    Trash2,
    BellOff,
    CheckCheck,
    Activity,
    MessageSquare,
    UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, AppNotification } from '@/hooks/useNotifications';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';

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
        case 'eco_decision_requested':
            return <Activity className="h-4 w-4 text-blue-500" />;
        case 'chat_message':
            return <MessageSquare className="h-4 w-4 text-primary" />;
        case 'task_deleted':
        case 'issue_deleted':
            return <Trash2 className="h-4 w-4 text-red-500" />;
        case 'team_invitation':
            return <UserPlus className="h-4 w-4 text-purple-500" />;
        default:
            return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
};

const getNotificationTypeLabel = (type: AppNotification['type']) => {
    switch (type) {
        case 'task_assigned':
        case 'task_completed':
        case 'task_deleted':
            return 'Task';
        case 'issue_assigned':
        case 'issue_resolved':
        case 'issue_linked_to_task':
        case 'issue_completed':
        case 'issue_deleted':
            return 'Issue';
        case 'bom_approval_requested':
        case 'bom_approval_decided':
            return 'BOM';
        case 'eco_decision_requested':
            return 'ECO';
        case 'chat_message':
            return 'Chat';
        case 'team_invitation':
            return 'Team';
        default:
            return 'Notification';
    }
};

const PAGE_SIZE = 10;

const Notifications = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('all');
    const [page, setPage] = useState(1);

    const filters = useMemo(() => {
        if (activeTab === 'unread') return { unreadOnly: true };
        if (activeTab === 'all') return {};
        return { type: activeTab };
    }, [activeTab]);

    const {
        notifications: fetchedNotifications,
        meta,
        isLoading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearReadNotifications,
        unreadCount,
        stats,
    } = useNotifications({ page, limit: PAGE_SIZE, includeStats: true, ...filters });

    // Guard against stale placeholder data (from React Query's keepPreviousData)
    // briefly showing the previous tab's items while the unread-filtered query loads.
    const notifications = activeTab === 'unread'
        ? fetchedNotifications.filter((n) => !n.read)
        : fetchedNotifications;

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setPage(1);
    };

    const handleMarkAsRead = (id: string) => {
        markAsRead.mutate(id);
    };

    const handleMarkAllAsRead = () => {
        markAllAsRead.mutate();
    };

    const handleDeleteNotification = (id: string) => {
        deleteNotification.mutate(id);
    };

    const handleClearReadNotifications = () => {
        clearReadNotifications.mutate();
    };

    if (isLoading) {
        return <AppLayoutSkeleton variant="notifications" />;
    }

    return (
        <div className="space-y-6">
                {/* Header */}
                

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Bell className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Total</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-status-in-progress/10">
                                <Bell className="h-5 w-5 text-status-in-progress" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{unreadCount}</p>
                                <p className="text-xs text-muted-foreground">Unread</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-500/10">
                                <AlertCircle className="h-5 w-5 text-red-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats?.issues ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Issues</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                                <FolderKanban className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats?.tasks ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Tasks</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <TabsList>
                            <TabsTrigger value="all">
                                All
                                {(stats?.total ?? 0) > 0 && (
                                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                                        {stats?.total}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="unread">
                                Unread
                                {unreadCount > 0 && (
                                    <Badge className="ml-2 h-5 px-1.5 bg-status-in-progress">
                                        {unreadCount}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="task_assigned">Tasks</TabsTrigger>
                            <TabsTrigger value="issue">Issues</TabsTrigger>
                            <TabsTrigger value="eco_decision_requested">ECO</TabsTrigger>
                        </TabsList>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
                                    <CheckCheck className="h-4 w-4 mr-2" />
                                    Mark all as read
                                </Button>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <MoreHorizontal className="h-4 w-4 mr-2" />
                                        Actions
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={handleClearReadNotifications}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Clear read notifications
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        <BellOff className="h-4 w-4 mr-2" />
                                        Notification settings
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    <TabsContent value={activeTab} className="mt-4">
                        {notifications.length === 0 ? (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-16">
                                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                        <Bell className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-medium text-foreground">No notifications</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {activeTab === 'unread'
                                            ? "You're all caught up!"
                                            : "You don't have any notifications yet"}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <div className="divide-y divide-border">
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={cn(
                                                'flex items-start gap-4 p-4 transition-colors hover:bg-muted/50 cursor-pointer',
                                                !notification.read && 'bg-status-in-progress/5'
                                            )}
                                            onClick={() => {
                                                handleMarkAsRead(notification.id);
                                                if (notification.actionUrl) {
                                                    navigate(notification.actionUrl);
                                                }
                                            }}
                                        >
                                            {/* Icon or Avatar */}
                                            <div className="flex-shrink-0 mt-1">
                                                {notification.initials ? (
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                                                            {notification.initials}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                ) : (
                                                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                                        {getNotificationIcon(notification.type)}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p
                                                                className={cn(
                                                                    'text-sm',
                                                                    !notification.read
                                                                        ? 'font-semibold text-foreground'
                                                                        : 'font-medium text-foreground'
                                                                )}
                                                            >
                                                                {notification.title}
                                                            </p>
                                                            {!notification.read && (
                                                                <span className="h-2 w-2 bg-status-in-progress rounded-full" />
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                                            {notification.description}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                            <Badge variant="outline" className="text-xs">
                                                                {getNotificationTypeLabel(notification.type)}
                                                            </Badge>
                                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Clock className="h-3 w-3" />
                                                                {notification.time}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {!notification.read && (
                                                                <DropdownMenuItem onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleMarkAsRead(notification.id);
                                                                }}>
                                                                    <Check className="h-4 w-4 mr-2" />
                                                                    Mark as read
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem
                                                                className="text-destructive"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteNotification(notification.id);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {meta && meta.totalPages > 1 && (
                                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                                        <p className="text-sm text-muted-foreground">
                                            Page {meta.page} of {meta.totalPages} ({meta.total} total)
                                        </p>
                                        <Pagination className="mx-0 w-auto">
                                            <PaginationContent>
                                                <PaginationItem>
                                                    <PaginationPrevious
                                                        href="#"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (meta.hasPrevPage) setPage((p) => p - 1);
                                                        }}
                                                        className={cn(!meta.hasPrevPage && 'pointer-events-none opacity-50')}
                                                    />
                                                </PaginationItem>
                                                <PaginationItem>
                                                    <PaginationNext
                                                        href="#"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (meta.hasNextPage) setPage((p) => p + 1);
                                                        }}
                                                        className={cn(!meta.hasNextPage && 'pointer-events-none opacity-50')}
                                                    />
                                                </PaginationItem>
                                            </PaginationContent>
                                        </Pagination>
                                    </div>
                                )}
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
        </div>
    );
};

export default Notifications;

