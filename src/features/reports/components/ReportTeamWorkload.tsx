import { memo, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { TeamWorkloadItem } from '../utils/reportsUtils';
import { resolveFileUrl } from '@/utils/fileUrl';

interface ReportTeamWorkloadProps {
  data: TeamWorkloadItem[];
  onMemberClick?: (memberId: string) => void;
}

export const ReportTeamWorkload = memo(function ReportTeamWorkload({ data, onMemberClick }: ReportTeamWorkloadProps) {
  const chartData = useMemo(() => data.map(item => {
    // Combined total: tasks + issues
    const total = (item.totalTasks + item.totalIssues) || 1;

    const todo = Math.max(0, item.totalTasks - item.completedTasks - item.inProgressTasks);
    const overdueFromTodo = Math.min(item.overdueTasks, todo);
    const overdueFromInProgress = Math.max(0, item.overdueTasks - overdueFromTodo);

    // Completed tasks + resolved issues share the same green segment; won't-fix issues get their own segment
    const doneCount = item.completedTasks + item.resolvedIssues;

    return {
      fullName: item.member.name,
      initials: item.member.initials,
      avatar: item.member.avatar,
      memberId: item.member.id,
      totalTasks: item.totalTasks,
      totalIssues: item.totalIssues,
      overdue: item.overdueTasks,
      openIssues: item.openIssues,
      resolvedIssues: item.resolvedIssues,
      wontFixIssues: item.wontFixIssues,
      completedTasks: item.completedTasks,
      inProgressTasks: item.inProgressTasks,
      // Bar segments (all as % of combined total)
      donePct: (doneCount / total) * 100,
      inProgressPct: (Math.max(0, item.inProgressTasks - overdueFromInProgress) / total) * 100,
      todoPct: (Math.max(0, todo - overdueFromTodo) / total) * 100,
      overduePct: (item.overdueTasks / total) * 100,
      openIssuesPct: (item.openIssues / total) * 100,
      wontFixPct: (item.wontFixIssues / total) * 100,
    };
  }), [data]);

  const handleMemberClick = useCallback((memberId: string) => {
    onMemberClick?.(memberId);
  }, [onMemberClick]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Team Workload
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            No workload data to display
          </div>
        ) : (
          <div className="space-y-4">
            {chartData.slice(0, 6).map((member) => (
              <div
                key={member.memberId}
                className="flex items-center gap-3 hover:bg-muted/50 p-2 -mx-2 rounded-lg transition-colors"
                onClick={() => handleMemberClick(member.memberId)}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={resolveFileUrl(member.avatar) ?? member.avatar} alt={member.fullName} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  {/* Name + summary */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium truncate">{member.fullName}</span>
                    <div className="flex items-center gap-2 ml-2 shrink-0 text-xs text-muted-foreground">
                      <span>{member.totalTasks} {member.totalTasks === 1 ? 'task' : 'tasks'}</span>
                      {member.totalIssues > 0 && (
                        <span className="text-orange-500">{member.totalIssues} {member.totalIssues === 1 ? 'issue' : 'issues'}</span>
                      )}
                      {member.overdue > 0 && (
                        <span className="text-destructive">({member.overdue} overdue)</span>
                      )}
                    </div>
                  </div>

                  {/* Combined progress bar */}
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    {member.donePct > 0 && (
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${member.donePct}%` }}
                        title={`${member.completedTasks} tasks completed · ${member.resolvedIssues} issues resolved`}
                      />
                    )}
                    {member.wontFixPct > 0 && (
                      <div
                        className="bg-slate-400 dark:bg-slate-500 h-full transition-all"
                        style={{ width: `${member.wontFixPct}%` }}
                        title={`${member.wontFixIssues} issues won't fix`}
                      />
                    )}
                    {member.inProgressPct > 0 && (
                      <div
                        className="bg-blue-500 h-full transition-all"
                        style={{ width: `${member.inProgressPct}%` }}
                        title={`${member.inProgressTasks} in progress`}
                      />
                    )}
                    {member.todoPct > 0 && (
                      <div
                        className="bg-slate-300 dark:bg-slate-600 h-full transition-all"
                        style={{ width: `${member.todoPct}%` }}
                        title={`${member.totalTasks - member.completedTasks - member.inProgressTasks - member.overdue} to do`}
                      />
                    )}
                    {member.overduePct > 0 && (
                      <div
                        className="bg-red-500 h-full transition-all"
                        style={{ width: `${member.overduePct}%` }}
                        title={`${member.overdue} overdue`}
                      />
                    )}
                    {member.openIssuesPct > 0 && (
                      <div
                        className="bg-orange-400 h-full transition-all"
                        style={{ width: `${member.openIssuesPct}%` }}
                        title={`${member.openIssues} open issues`}
                      />
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {(member.completedTasks > 0 || member.resolvedIssues > 0) && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                        {member.completedTasks + member.resolvedIssues} done
                      </span>
                    )}
                    {member.openIssues > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
                        {member.openIssues} open {member.openIssues === 1 ? 'issue' : 'issues'}
                      </span>
                    )}
                    {member.wontFixIssues > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                        {member.wontFixIssues} won't fix
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center justify-center flex-wrap gap-3 pt-2 border-t">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Done
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                In Progress
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                To Do
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Overdue
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                Open Issues
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                Won't Fix
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
