import { AlertTriangle, PlayCircle, Lock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { softTint } from '@/features/dashboard/utils/colors';

interface MyDayStatsProps {
  attentionCount: number;
  readyCount: number;
  blockedCount: number;
  completedTodayCount: number;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
}

function StatCard({ label, value, icon: Icon, iconColor }: StatCardProps) {
  return (
    <div className={cn('bg-card rounded-lg px-3.5 py-2.5 flex-1 min-w-[140px] border border-border flex items-center gap-2.5')}>
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: softTint(iconColor, 0.12) }}
      >
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold leading-tight truncate">{value}</span>
        <span className="block text-[11px] text-muted-foreground truncate">{label}</span>
      </span>
    </div>
  );
}

export function MyDayStats({
  attentionCount,
  readyCount,
  blockedCount,
  completedTodayCount,
}: MyDayStatsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <StatCard label="Needs Attention" value={attentionCount} icon={AlertTriangle} iconColor="#DC2626" />
      <StatCard label="Ready to Work" value={readyCount} icon={PlayCircle} iconColor="#16A34A" />
      <StatCard label="Blocked" value={blockedCount} icon={Lock} iconColor="#64748B" />
      <StatCard label="Completed Today" value={completedTodayCount} icon={CheckCircle2} iconColor="#2563EB" />
    </div>
  );
}
