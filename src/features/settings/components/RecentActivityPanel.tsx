import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity as ActivityIcon, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { ActivityRow } from '@/features/dashboard/components/ActivityRow';
import { isActivityClickable, getActivityTargetPath } from '@/features/dashboard/components/activityMeta';
import { mapRawActivity } from '@/features/dashboard/utils/mapActivity';
import { activitiesService } from '@/services/activities.service';
import type { Activity } from '@/types';

const PAGE_SIZE = 25;

export function RecentActivityPanel() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const [page, setPage] = useState(1);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  // Reset pagination when the org changes.
  useEffect(() => {
    setPage(1);
    setActivities([]);
    setTotalPages(null);
  }, [orgId]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['org-activities-page', orgId, page, PAGE_SIZE],
    queryFn: () => activitiesService.getOrgActivitiesPage(orgId!, page, PAGE_SIZE),
    enabled: !!orgId,
  });

  useEffect(() => {
    if (!data) return;
    const mapped = data.data.map(mapRawActivity);
    setActivities((prev) => {
      if (page === 1) return mapped;
      const seen = new Set(prev.map((a) => a.id));
      return [...prev, ...mapped.filter((a) => !seen.has(a.id))];
    });
    setTotalPages(data.meta.totalPages);
  }, [data, page]);

  const hasMore = totalPages !== null && page < totalPages;
  const showInitialLoading = isLoading && activities.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ActivityIcon className="h-5 w-5" />
          Recent Activity
        </CardTitle>
        <CardDescription>
          Every update across your organization&apos;s projects, tasks, issues, and more.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showInitialLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Loading activity...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <ActivityIcon className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <h3 className="text-sm font-medium text-foreground">No recent activity</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              Updates across your projects will show up here.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {activities.map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  isMobile={isMobile}
                  isClickable={isActivityClickable(activity)}
                  onClick={() => {
                    if (!isActivityClickable(activity)) return;
                    navigate(getActivityTargetPath(activity));
                  }}
                />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={isFetching}
                >
                  {isFetching && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
