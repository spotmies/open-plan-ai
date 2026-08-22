import { memo, useCallback } from 'react';
import { TrendingUp, AlertCircle, Clock, Timer, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ReportKPI, StatusBreakdown, getStatusColor, formatCycleTime } from '../utils/reportsUtils';
import { cn } from '@/lib/utils';

interface ReportsKPIRowProps {
  kpis: ReportKPI;
  statusBreakdown?: StatusBreakdown[];
  onKPIClick?: (type: 'progress' | 'issues' | 'overdue' | 'cycle') => void;
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  visual?: React.ReactNode;
  tooltip: string;
  variant?: 'default' | 'warning' | 'danger';
  onClick?: () => void;
}

const KPICard = memo(function KPICard({
  title,
  value,
  subtitle,
  icon,
  visual,
  tooltip,
  variant = 'default',
  onClick
}: KPICardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-primary/20",
        variant === 'warning' && "border-l-4 border-l-amber-500",
        variant === 'danger' && "border-l-4 border-l-destructive"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-lg",
              variant === 'default' && "bg-primary/10 text-primary",
              variant === 'warning' && "bg-amber-500/10 text-amber-600",
              variant === 'danger' && "bg-destructive/10 text-destructive"
            )}>
              {icon}
            </div>
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{value}</span>
            {typeof value === 'number' && value > 0 && variant !== 'default' && (
              <Badge
                variant={variant === 'danger' ? 'destructive' : 'outline'}
                className={cn(
                  "text-xs",
                  variant === 'warning' && "border-amber-500 text-amber-600"
                )}
              >
                Needs attention
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>

        {visual && (
          <div className="mt-3">
            {visual}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export const ReportsKPIRow = memo(function ReportsKPIRow({ kpis, statusBreakdown, onKPIClick }: ReportsKPIRowProps) {
  const handleProgressClick = useCallback(() => onKPIClick?.('progress'), [onKPIClick]);
  const handleIssuesClick = useCallback(() => onKPIClick?.('issues'), [onKPIClick]);
  const handleOverdueClick = useCallback(() => onKPIClick?.('overdue'), [onKPIClick]);
  const handleCycleClick = useCallback(() => onKPIClick?.('cycle'), [onKPIClick]);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Project Progress"
        value={`${kpis.projectProgress}%`}
        subtitle={`${kpis.completedTasks} of ${kpis.totalTasks} tasks`}
        icon={<TrendingUp className="h-4 w-4" />}
        visual={
          statusBreakdown && statusBreakdown.length > 0 ? (
            <div className="h-2 w-full flex rounded-full overflow-hidden bg-secondary">
              {statusBreakdown.map((status) => (
                <div
                  key={status.status}
                  style={{ width: `${status.percentage}%`, backgroundColor: getStatusColor(status.status) }}
                  className="h-full transition-all"
                  title={`${status.status}: ${status.percentage}%`}
                />
              ))}
            </div>
          ) : (
            <Progress value={kpis.projectProgress} className="h-2" />
          )
        }
        tooltip="Weighted average of completed tasks, milestones, modules, and resolved issues"
        onClick={handleProgressClick}
      />

      <KPICard
        title="Open Issues"
        value={kpis.openIssues}
        subtitle={kpis.criticalIssues > 0 ? `${kpis.criticalIssues} critical` : 'No critical issues'}
        icon={<AlertCircle className="h-4 w-4" />}
        tooltip="All issues except 'Resolved' and 'Won't Fix' — includes custom column statuses"
        variant={kpis.criticalIssues > 0 ? 'danger' : 'default'}
        onClick={handleIssuesClick}
      />

      <KPICard
        title="Overdue Tasks"
        value={kpis.overdueTasks}
        subtitle={kpis.overdueTasks > 0 ? 'Needs attention' : 'All on track'}
        icon={<Clock className="h-4 w-4" />}
        tooltip="Tasks where due date is before today and status is not 'done'"
        variant={kpis.overdueTasks > 0 ? 'warning' : 'default'}
        onClick={handleOverdueClick}
      />

      <KPICard
        title="Avg Cycle Time"
        value={formatCycleTime(kpis.avgCycleTime).value}
        subtitle={formatCycleTime(kpis.avgCycleTime).subtitle}
        icon={<Timer className="h-4 w-4" />}
        tooltip="Average time from task start date to completion for all completed tasks"
        onClick={handleCycleClick}
      />
    </div>
  );
});
