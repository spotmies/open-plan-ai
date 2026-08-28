import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  MessageSquare,
  Plus,
  Flag,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Activity as ActivityIcon,
  FolderPlus,
  UserPlus,
  RefreshCw,
  GitBranch,
  Trash2,
  Users,
  Milestone,
  Link as LinkIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity } from '@/types';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { PanelIcon } from './PanelIcon';

interface ActivityFeedProps {
  activities: Activity[];
  isLoading: boolean;
  className?: string;
  /** When provided, issue activities open in an in-place modal instead of navigating to the project page. */
  onIssueClick?: (projectId: string, issueId: string) => void;
}

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  task_created: Plus,
  task_completed: CheckCircle2,
  task_updated: ArrowRight,
  task_assigned: UserPlus,
  task_deleted: Trash2,
  comment_added: MessageSquare,
  milestone_reached: Flag,
  milestone_created: Milestone,
  milestone_updated: ArrowRight,
  milestone_deleted: Trash2,
  milestone_reopened: RefreshCw,
  status_changed: RefreshCw,
  issue_created: AlertTriangle,
  issue_resolved: CheckCircle,
  issue_updated: ArrowRight,
  issue_deleted: Trash2,
  issue_assigned: UserPlus,
  issue_linked_to_task: LinkIcon,
  project_created: FolderPlus,
  project_updated: AlertCircle,
  project_assigned: UserPlus,
  project_deleted: Trash2,
  project_member_added: Users,
  dependency_added: GitBranch,
};

const activityColors: Record<string, string> = {
  task_created: 'text-status-in-progress bg-status-in-progress/10',
  task_completed: 'text-status-done bg-status-done/10',
  task_updated: 'text-muted-foreground bg-muted',
  task_assigned: 'text-chart-2 bg-chart-2/10',
  task_deleted: 'text-destructive bg-destructive/10',
  comment_added: 'text-chart-2 bg-chart-2/10',
  milestone_reached: 'text-chart-4 bg-chart-4/10',
  milestone_created: 'text-chart-4 bg-chart-4/10',
  milestone_updated: 'text-muted-foreground bg-muted',
  milestone_deleted: 'text-destructive bg-destructive/10',
  milestone_reopened: 'text-chart-5 bg-chart-5/10',
  status_changed: 'text-chart-5 bg-chart-5/10',
  issue_created: 'text-destructive bg-destructive/10',
  issue_resolved: 'text-status-done bg-status-done/10',
  issue_updated: 'text-muted-foreground bg-muted',
  issue_deleted: 'text-destructive bg-destructive/10',
  issue_assigned: 'text-chart-2 bg-chart-2/10',
  issue_linked_to_task: 'text-chart-5 bg-chart-5/10',
  project_created: 'text-primary bg-primary/10',
  project_updated: 'text-chart-3 bg-chart-3/10',
  project_assigned: 'text-chart-2 bg-chart-2/10',
  project_deleted: 'text-destructive bg-destructive/10',
  project_member_added: 'text-chart-2 bg-chart-2/10',
  dependency_added: 'text-chart-5 bg-chart-5/10',
};

// Short verb phrase for the mobile "{name} {phrase}" line — the full description
// moves to a quoted secondary line on mobile, matching the mobile activity design.
const activityActionText: Record<string, string> = {
  task_created: 'created a task',
  task_completed: 'completed a task',
  task_updated: 'updated a task',
  task_assigned: 'was assigned a task',
  task_deleted: 'deleted a task',
  comment_added: 'added a comment',
  milestone_reached: 'reached a milestone',
  milestone_created: 'created a milestone',
  milestone_updated: 'updated a milestone',
  milestone_deleted: 'deleted a milestone',
  milestone_reopened: 'reopened a milestone',
  status_changed: 'changed a status',
  issue_created: 'opened an issue',
  issue_resolved: 'resolved an issue',
  issue_updated: 'updated an issue',
  issue_deleted: 'deleted an issue',
  issue_assigned: 'was assigned an issue',
  issue_linked_to_task: 'linked an issue',
  project_created: 'created a project',
  project_updated: 'updated a project',
  project_assigned: 'was assigned to a project',
  project_deleted: 'deleted a project',
  project_member_added: 'added a member',
  dependency_added: 'added a dependency',
};

const avatarColors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500'];

function avatarColorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarColors[h % avatarColors.length];
}

const activityLabels: Record<string, string> = {
  task_created: 'Task Created',
  task_completed: 'Task Completed',
  task_updated: 'Task Updated',
  task_assigned: 'Task Assigned',
  task_deleted: 'Task Deleted',
  comment_added: 'Comment',
  milestone_reached: 'Milestone Reached',
  milestone_created: 'Milestone Created',
  milestone_updated: 'Milestone Updated',
  milestone_deleted: 'Milestone Deleted',
  milestone_reopened: 'Milestone Reopened',
  status_changed: 'Status Changed',
  issue_created: 'Issue Opened',
  issue_resolved: 'Issue Resolved',
  issue_updated: 'Issue Updated',
  issue_deleted: 'Issue Deleted',
  issue_assigned: 'Issue Assigned',
  issue_linked_to_task: 'Issue Linked',
  project_created: 'New Project',
  project_updated: 'Project Updated',
  project_assigned: 'Member Assigned',
  project_deleted: 'Project Deleted',
  project_member_added: 'Member Added',
  dependency_added: 'Dependency Added',
};

// Maps an activity's entityType to the deep-link route for that specific record —
// same route shapes used for chat entity tags (see ENTITY_TAG_ROUTE in MessageBubble.tsx).
const entityDeepLink: Record<string, (projectId: string, entityId: string) => string> = {
  task: (projectId, entityId) => `/projects/${projectId}/tasks/${entityId}`,
  issue: (projectId, entityId) => `/projects/${projectId}/issues/${entityId}`,
  milestone: (projectId, entityId) => `/projects/${projectId}/milestones/${entityId}`,
  hardware_module: (projectId, entityId) => `/projects/${projectId}/modules/${entityId}`,
  bom_node: (projectId, entityId) => `/projects/${projectId}/bom/${entityId}`,
  eco: (projectId, entityId) => `/projects/${projectId}/eng-changes/${entityId}`,
};

// Maps each activity type to the ProjectSection tab it should open (see PROJECT_SECTIONS in App.tsx).
// Falls back to the project's default section ('bom') when there's no more specific tab.
const activitySection: Record<string, string> = {
  task_created: 'tasks',
  task_completed: 'tasks',
  task_updated: 'tasks',
  task_assigned: 'tasks',
  task_deleted: 'tasks',
  comment_added: 'tasks',
  dependency_added: 'tasks',
  status_changed: 'tasks',
  milestone_reached: 'milestones',
  milestone_created: 'milestones',
  milestone_updated: 'milestones',
  milestone_deleted: 'milestones',
  milestone_reopened: 'milestones',
  issue_created: 'issues',
  issue_resolved: 'issues',
  issue_updated: 'issues',
  issue_deleted: 'issues',
  issue_assigned: 'issues',
  issue_linked_to_task: 'issues',
};

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
          <Link to="/notifications">
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
              const Icon = activityIcons[activity.type] || ActivityIcon;
              const colorClass = activityColors[activity.type] || 'text-muted-foreground bg-muted';
              const label = activityLabels[activity.type] || 'Unknown Activity';

              const isProjectDeleted = activity.type === 'project_deleted';
              const isClickable = Boolean(activity.projectId) && !isProjectDeleted;
              const section = activitySection[activity.type];
              const actionText = activityActionText[activity.type] || label.toLowerCase();
              const initials = activity.user.initials || activity.user.name.slice(0, 2).toUpperCase();

              // Deleted entities have nothing left to deep-link to, so those activity
              // types always fall back to the list section instead of a specific record.
              const isDeletion = activity.type.endsWith('_deleted');

              // Deep-link straight to the specific item (opens its detail modal/page)
              // instead of just landing on the section's list view.
              const targetPath = () => {
                const deepLink = !isDeletion && activity.entityType && activity.entityId
                  ? entityDeepLink[activity.entityType]
                  : undefined;
                if (deepLink && activity.entityId) return deepLink(activity.projectId, activity.entityId);
                return `/projects/${activity.projectId}${section ? `/${section}` : ''}`;
              };

              // Issue activities open as an overlay on the dashboard itself when a handler is
              // given, instead of navigating away to the project page and stranding the user
              // there once the modal is closed.
              const isIssueDeepLink = !isDeletion && activity.entityType === 'issue' && !!activity.entityId;
              const handleClick = () => {
                if (!isClickable) return;
                if (isIssueDeepLink && onIssueClick) {
                  onIssueClick(activity.projectId, activity.entityId!);
                  return;
                }
                navigate(targetPath());
              };

              return (
                <div
                  key={activity.id}
                  onClick={handleClick}
                  className={cn(
                    'flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0 transition-colors px-2 rounded-md',
                    isClickable && 'hover:bg-muted/30 cursor-pointer',
                    !isMobile && '-mx-2'
                  )}
                >
                  {/* Left: avatar (mobile) or subtle status icon (desktop) */}
                  {isMobile ? (
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-semibold text-white',
                      avatarColorFor(activity.user.id || activity.user.name)
                    )}>
                      {initials}
                    </div>
                  ) : (
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                      colorClass
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                  )}

                  {/* Center: Content */}
                  <div className="flex-1 min-w-0">
                    {/* Primary: Actor name (bold) + action text */}
                    <p className="text-sm leading-snug flex items-baseline gap-1 min-w-0">
                      <span className="font-semibold truncate max-w-[45%] shrink-0" title={activity.user.name}>{activity.user.name}</span>
                      <span className="text-muted-foreground text-foreground/80 break-words line-clamp-2 min-w-0">{isMobile ? actionText : activity.description}</span>
                    </p>

                    {/* Mobile: quoted description as a secondary line */}
                    {isMobile && activity.description && (
                      <p className="text-xs text-muted-foreground/90 italic mt-1 line-clamp-2">
                        &ldquo;{activity.description}&rdquo;
                      </p>
                    )}

                    {/* Secondary: Project name, Type badge & Timestamp row */}
                    <div className={cn('mt-1.5 gap-2', isMobile ? 'flex flex-col items-start' : 'flex items-center justify-between')}>
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        {activity.projectName && (
                          <p className="text-xs text-muted-foreground truncate min-w-0 max-w-[150px] sm:max-w-full">
                            in{' '}
                            <span className={cn('font-medium', isClickable ? 'text-primary hover:underline cursor-pointer' : 'text-foreground/80')}>
                              {activity.projectName}
                            </span>
                          </p>
                        )}
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                          colorClass
                        )}>
                          {label}
                        </span>
                      </div>

                      <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
