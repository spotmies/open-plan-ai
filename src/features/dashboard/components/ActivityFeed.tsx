import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Activity as ActivityIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity } from '@/types';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { PanelIcon } from './PanelIcon';
import { ActivityRow } from './ActivityRow';
import { isActivityClickable, getActivityTargetPath, isActivityIssueDeepLink } from './activityMeta';

interface ActivityFeedProps {
  activities: Activity[];
  isLoading: boolean;
  className?: string;
  /** When provided, issue activities open in an in-place modal instead of navigating to the project page. */
  onIssueClick?: (projectId: string, issueId: string) => void;
}

export function ActivityFeed({ activities, isLoading, className, onIssueClick }: ActivityFeedProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <Card className={cn('flex flex-col h-full min-h-0 overflow-hidden rounded-2xl border-border/70 shadow-sm min-w-0', className)}>
        <CardHeader className="px-3 py-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="min-w-0 text-base font-medium flex items-center gap-2">
            <PanelIcon icon={ActivityIcon} color="#2563EB" />
            <span className="truncate">Recent Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 min-w-0">
          {/* Placeholder for loading state */}
          <div className="flex flex-col items-center justify-center py-8 text-center animate-pulse">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <ActivityIcon className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <h3 className="text-sm font-medium text-foreground">Loading activity...</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              Fetching recent project updates.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('flex flex-col h-full min-h-0 overflow-hidden rounded-2xl border-border/70 shadow-sm min-w-0', className)}>
      <CardHeader className="px-3 py-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="min-w-0 text-base font-medium flex items-center gap-2">
          <PanelIcon icon={ActivityIcon} color="#2563EB" />
          <span className="truncate">Recent Activity</span>
        </CardTitle>
        <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-foreground" asChild>
          <Link to="/settings?tab=activity">
            View all
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 min-h-0 px-3 md:px-6 pb-4">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <ActivityIcon className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <h3 className="text-sm font-medium text-foreground">No recent activity</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              Recent project updates will appear here.
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-1">
            {activities.map((activity) => {
              const clickable = isActivityClickable(activity);

              // Issue activities open as an overlay on the dashboard itself when a handler is
              // given, instead of navigating away to the project page and stranding the user
              // there once the modal is closed.
              const handleClick = () => {
                if (!clickable) return;
                if (isActivityIssueDeepLink(activity) && onIssueClick) {
                  onIssueClick(activity.projectId, activity.entityId!);
                  return;
                }
                navigate(getActivityTargetPath(activity));
              };

              return (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  isMobile={isMobile}
                  isClickable={clickable}
                  onClick={handleClick}
                />
              );
            })}
          </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
