import { Link } from 'react-router-dom';
import { ArrowRight, GitMerge, GitPullRequest } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrgEcoAggregate, useOrgEcoStatusCounts, useOrgAwaitingEcos } from '../hooks/useOrgAggregates';
import { MAIN_STATUSES, STATUS_LABEL, statusMeta, type ECOStatus } from '@/features/projects/components/ecoData';
import type { ApiEcoListItem } from '@/hooks/useECOs';
import { PanelIcon } from './PanelIcon';
import { ProjectPickerPopover } from './ProjectPickerPopover';
import { useFitCount } from '../hooks/useFitCount';
import type { Project } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface EngineeringChangesSummaryProps {
  projectIds: string[];
  projects: Project[];
}

function StageBar({ status, count, max }: { status: ECOStatus; count: number; max: number }) {
  const meta = statusMeta(status);
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-20 shrink-0 text-xs text-muted-foreground truncate">{STATUS_LABEL[status]}</span>
      <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: max ? `${(count / max) * 100}%` : '0%', minWidth: count ? 5 : 0, background: meta.color }}
        />
      </div>
      <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums">{count}</span>
    </div>
  );
}

export function EngineeringChangesSummary({ projectIds, projects }: EngineeringChangesSummaryProps) {
  const isMobile = useIsMobile();
  const { isLoading: aggLoading, open, firstPassPct, avgCycleDays } = useOrgEcoAggregate(projectIds);
  const { isLoading: statusLoading, ecos } = useOrgEcoStatusCounts(projectIds);
  const { isLoading: awaitingLoading, awaiting } = useOrgAwaitingEcos(projectIds);

  const counts = MAIN_STATUSES.map((s) => ({
    status: s,
    count: ecos.filter((e: ApiEcoListItem) => e.status.toUpperCase() === s).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  const nonEmptyCounts = counts.filter((c) => c.count > 0);
  const stageTotal = Math.max(1, nonEmptyCounts.reduce((sum, c) => sum + c.count, 0));

  const isLoading = aggLoading || statusLoading;
  const { containerRef, fitCount } = useFitCount(awaiting.length);
  const remainingAwaiting = awaiting.length - fitCount;

  return (
    <Card className="flex flex-col">
      <CardHeader className="px-3 py-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="min-w-0 text-base font-medium flex items-center gap-2">
          <PanelIcon icon={GitMerge} color="#9333EA" />
          <span className="truncate">Engineering Changes</span>
        </CardTitle>
        <ProjectPickerPopover projects={projects} tab="eng-changes" label="Open ECOs" className="shrink-0" />
      </CardHeader>
      <CardContent className="flex flex-col space-y-3 pb-4">
        <div className="shrink-0 grid grid-cols-3 gap-0 rounded-lg border border-border overflow-hidden">
          <div className="flex flex-col gap-0.5 px-3 py-2">
            <span className="text-[10.5px] font-medium text-muted-foreground">Open</span>
            <span className="text-lg font-bold tabular-nums">{isLoading ? '—' : open}</span>
          </div>
          <div className="flex flex-col gap-0.5 px-3 py-2 border-l border-border">
            <span className="text-[10.5px] font-medium text-muted-foreground">First-pass</span>
            <span className="text-lg font-bold tabular-nums text-status-done">
              {isLoading ? '—' : firstPassPct == null ? '—' : `${firstPassPct}%`}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 px-3 py-2 border-l border-border">
            <span className="text-[10.5px] font-medium text-muted-foreground">Avg cycle</span>
            <span className="text-lg font-bold tabular-nums">
              {isLoading ? '—' : avgCycleDays == null ? '—' : `${avgCycleDays}d`}
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Pipeline by stage
          </span>
          {isMobile ? (
            <>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden flex">
                {nonEmptyCounts.map((c) => (
                  <div
                    key={c.status}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${(c.count / stageTotal) * 100}%`, background: statusMeta(c.status).color }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
                {nonEmptyCounts.map((c) => (
                  <div key={c.status} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: statusMeta(c.status).color }} />
                      {STATUS_LABEL[c.status]}
                    </span>
                    <span className="font-semibold tabular-nums shrink-0">{c.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {counts.map((c) => (
                <StageBar key={c.status} status={c.status} count={c.count} max={max} />
              ))}
            </div>
          )}
        </div>

        {!awaitingLoading && awaiting.length > 0 && (
          <div className="flex flex-col">
            <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-status-blocked mb-2">
              <GitPullRequest className="h-3 w-3" />
              Awaiting your approval
            </span>
            <div ref={containerRef} className="space-y-1.5">
              {awaiting.map((eco) => (
                <Link
                  key={eco.id}
                  to={`/projects/${eco.projectId}/eng-changes`}
                  className="flex items-center gap-2.5 rounded-lg border border-status-blocked/30 bg-status-blocked/[0.07] px-3 py-2 text-sm hover:bg-status-blocked/[0.12] transition-colors"
                >
                  <span className="font-mono text-[11px] font-semibold text-status-blocked shrink-0">{eco.num}</span>
                  <span className="flex-1 min-w-0 truncate">{eco.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
            {remainingAwaiting > 0 && (
              <ProjectPickerPopover
                projects={projects}
                tab="eng-changes"
                label={`+${remainingAwaiting} more awaiting approval`}
                className="shrink-0 w-full mt-1 justify-center"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
