import { ArrowRight, Layers } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrgBomAggregate } from '../hooks/useOrgAggregates';
import { PanelIcon } from './PanelIcon';
import { ProjectPickerPopover } from './ProjectPickerPopover';
import type { Project } from '@/types';

interface BomReadinessProps {
  projects: Project[];
}

function BomDonut({ pct }: { pct: number }) {
  const data = [
    { name: 'approved', value: pct },
    { name: 'remaining', value: 100 - pct },
  ];
  return (
    <div className="relative h-[74px] w-[74px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={28} outerRadius={37} startAngle={90} endAngle={-270} stroke="none">
            <Cell fill="hsl(var(--status-done))" />
            <Cell fill="hsl(var(--secondary))" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold tabular-nums leading-tight">{pct}%</span>
        <span className="text-[8.5px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">Approved</span>
      </span>
    </div>
  );
}

export function BomReadiness({ projects }: BomReadinessProps) {
  const { isLoading, total, approved, pending, rejected, pct } = useOrgBomAggregate();

  return (
    <Card>
      <CardHeader className="px-3 py-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="min-w-0 text-base font-medium flex items-center gap-2">
          <PanelIcon icon={Layers} color="#EA580C" />
          <span className="truncate">Bill of Materials</span>
        </CardTitle>
        <ProjectPickerPopover projects={projects} tab="bom" label="View BOM" className="shrink-0" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <BomDonut pct={isLoading ? 0 : pct} />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-status-done" />
                Approved
              </span>
              <span className="font-semibold tabular-nums">{isLoading ? '—' : approved}</span>
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-priority-medium" />
                Pending review
              </span>
              <span className="font-semibold tabular-nums text-priority-medium">{isLoading ? '—' : pending}</span>
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-status-blocked" />
                Rejected
              </span>
              <span className="font-semibold tabular-nums text-status-blocked">{isLoading ? '—' : rejected}</span>
            </div>
            <div className="flex items-center justify-between text-[12.5px] text-muted-foreground pt-2 mt-0.5 border-t border-border/60">
              <span>Total parts</span>
              <span className="font-semibold tabular-nums">{isLoading ? '—' : total}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
