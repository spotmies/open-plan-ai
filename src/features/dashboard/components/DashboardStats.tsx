import { Gauge, GitMerge, Layers, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { softTint } from '../utils/colors';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
  accent?: boolean;
}

function StatCard({ label, value, unit, subtitle, icon: Icon, iconColor, accent }: StatCardProps) {
  return (
    <div className={cn('bg-card rounded-2xl px-3.5 py-2.5 flex-1 min-w-0 border flex items-center gap-2.5 shadow-sm', accent ? 'border-primary/25' : 'border-border/70')}>
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: softTint(iconColor, 0.12) }}
      >
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1">
          <span className="text-lg font-bold leading-tight tabular-nums truncate" style={{ color: accent ? iconColor : undefined }}>
            {value}
          </span>
          {unit && <span className="text-[11px] font-medium text-muted-foreground truncate">{unit}</span>}
        </span>
        <span className="block text-[11px] text-muted-foreground truncate">{subtitle ?? label}</span>
      </span>
    </div>
  );
}

interface DashboardStatsProps {
  isLoading?: boolean;
  portfolio: { onTrack: number; total: number };
  eco: { open: number; awaitingMyAction: number };
  bom: { pct: number; pending: number };
  nextGate: { days: number; label: string } | null;
}

export function DashboardStats({ isLoading, portfolio, eco, bom, nextGate }: DashboardStatsProps) {
  const dash = isLoading ? '—' : undefined;
  const atRisk = portfolio.total - portfolio.onTrack;

  return (
    <div className="hidden gap-3 md:flex md:flex-nowrap">
      <StatCard
        label="Portfolio"
        value={dash ?? portfolio.onTrack}
        unit={`/ ${portfolio.total} on track`}
        subtitle={`${atRisk} need attention`}
        icon={Gauge}
        iconColor={atRisk > 0 ? '#D97706' : '#16A34A'}
        accent={atRisk > 0}
      />
      <StatCard
        label="Open changes"
        value={dash ?? eco.open}
        unit="ECOs"
        subtitle={`${eco.awaitingMyAction} awaiting you`}
        icon={GitMerge}
        iconColor={eco.awaitingMyAction > 0 ? '#DC2626' : '#2563EB'}
        accent={eco.awaitingMyAction > 0}
      />
      <StatCard
        label="BOM released"
        value={dash ?? bom.pct}
        unit="%"
        subtitle={`${bom.pending} parts pending`}
        icon={Layers}
        iconColor="#9333EA"
      />
      <StatCard
        label="Next gate"
        value={dash ?? (nextGate ? nextGate.days : '—')}
        unit={nextGate ? 'days' : undefined}
        subtitle={nextGate ? nextGate.label : 'No upcoming gate'}
        icon={Flag}
        iconColor="#0D9488"
      />
    </div>
  );
}
