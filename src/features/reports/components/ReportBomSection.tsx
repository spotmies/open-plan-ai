import { memo, useMemo } from 'react';
import {
  Layers,
  ClipboardCheck,
  BadgeCheck,
  AlertOctagon,
  DollarSign,
  TrendingUp,
  GitCommitVertical,
  Clock,
  PieChart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import { Info } from 'lucide-react';
import { BOMNode, formatLeadTime } from '@/features/projects/components/bomData';
import {
  getBomCompleteness,
  getBomApprovalStatus,
  getBomBlockingCount,
  getBomTotalCost,
  getBomCostDrivers,
  getBomSingleSourceParts,
  getBomLongLeadParts,
  getBomSupplierConcentration,
  LONG_LEAD_THRESHOLD_DAYS,
} from '../utils/bomReportUtils';

interface BomCostTrendPoint {
  date: string;
  totalCost: number;
}

interface ReportBomSectionProps {
  projectName?: string;
  nodes: BOMNode[];
  formatCurrency: (amount: number) => string;
  costTrendData?: BomCostTrendPoint[];
  costTrendLoading?: boolean;
  costTrendGranularity?: 'daily' | 'weekly' | 'monthly';
  onCostTrendGranularityChange?: (g: 'daily' | 'weekly' | 'monthly') => void;
}

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-xs">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const SUPPLIER_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--status-todo))', // "Other" bucket
];

function BomKpiRow({ nodes, formatCurrency }: { nodes: BOMNode[]; formatCurrency: (n: number) => string }) {
  const completeness = useMemo(() => getBomCompleteness(nodes), [nodes]);
  const approval = useMemo(() => getBomApprovalStatus(nodes), [nodes]);
  const blocking = useMemo(() => getBomBlockingCount(nodes), [nodes]);
  const totalCost = useMemo(() => getBomTotalCost(nodes), [nodes]);

  const appSeg: Array<[string, number, string]> = [
    ['Approved', approval.approved, 'hsl(var(--status-done))'],
    ['Pending', approval.pending, 'hsl(var(--priority-medium))'],
    ['Rejected', approval.rejected, 'hsl(var(--status-blocked))'],
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* BOM Completeness */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">BOM Completeness</span>
            </div>
            <InfoTip text="Share of part lines with MPN, manufacturer, distributor, unit price, and lead time on file." />
          </div>
          <div>
            <span className="text-2xl font-semibold">{completeness.pct}%</span>
            <p className="text-xs text-muted-foreground">{completeness.done} of {completeness.total} lines complete</p>
          </div>
          <Progress value={completeness.pct} className="h-1.5" />
        </CardContent>
      </Card>

      {/* Approval Status */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <BadgeCheck className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Approval Status</span>
            </div>
            <InfoTip text="Part lines by approval state on the current revision." />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{approval.approvedPct}%</span>
            <span className="text-xs text-muted-foreground">approved</span>
          </div>
          <div className="flex h-2 w-full rounded-full overflow-hidden bg-secondary">
            {appSeg.map(([l, v, c]) => v > 0 && (
              <div key={l} style={{ width: `${(v / approval.total) * 100}%`, backgroundColor: c }} title={`${l}: ${v}`} />
            ))}
          </div>
          <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
            {appSeg.map(([l, v]) => <span key={l}>{l} <span className="font-semibold text-foreground">{v}</span></span>)}
          </div>
        </CardContent>
      </Card>

      {/* Parts Blocking Release */}
      <Card className="border-l-4 border-l-destructive">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                <AlertOctagon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Parts Blocking Release</span>
            </div>
            <InfoTip text="Part lines still Pending or Rejected approval." />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-destructive">{blocking}</span>
            {blocking > 0 && <Badge variant="destructive" className="text-xs">Needs attention</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">Pending or rejected lines</p>
        </CardContent>
      </Card>

      {/* BOM Cost */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <DollarSign className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">BOM Cost</span>
            </div>
            <InfoTip text="Total extended cost (unit price × quantity) across all part lines." />
          </div>
          <span className="text-2xl font-semibold">{formatCurrency(totalCost)}</span>
          <p className="text-xs text-muted-foreground">Current revision total</p>
        </CardContent>
      </Card>
    </div>
  );
}

function BomCostTrend({
  nodes,
  formatCurrency,
  trendData,
  isLoading,
  granularity,
  onGranularityChange,
}: {
  nodes: BOMNode[];
  formatCurrency: (n: number) => string;
  trendData?: BomCostTrendPoint[];
  isLoading?: boolean;
  granularity?: 'daily' | 'weekly' | 'monthly';
  onGranularityChange?: (g: 'daily' | 'weekly' | 'monthly') => void;
}) {
  const totalCost = useMemo(() => getBomTotalCost(nodes), [nodes]);
  const timeframe = granularity ?? 'monthly';
  const setTimeframe = onGranularityChange ?? (() => { });

  const chartData = useMemo(() => {
    if (!trendData?.length) return [];
    return trendData.map((pt) => {
      const d = new Date(pt.date + 'T00:00:00');
      let label: string;
      if (timeframe === 'daily') {
        label = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
      } else if (timeframe === 'weekly') {
        label = `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleString('default', { month: 'short' })}`;
      } else {
        label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      }
      return { date: label, cost: pt.totalCost };
    });
  }, [trendData, timeframe]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Cost Trend Across Revisions
          </CardTitle>
          <div className="flex items-center rounded-md border bg-background">
            <Button
              variant={timeframe === 'daily' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-r-none h-7 text-xs px-2.5"
              onClick={() => setTimeframe('daily')}
            >
              Daily
            </Button>
            <Button
              variant={timeframe === 'weekly' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-none h-7 text-xs px-2.5 border-l border-r"
              onClick={() => setTimeframe('weekly')}
            >
              Weekly
            </Button>
            <Button
              variant={timeframe === 'monthly' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-l-none h-7 text-xs px-2.5"
              onClick={() => setTimeframe('monthly')}
            >
              Monthly
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {isLoading ? (
          <div className="flex flex-col h-full space-y-4 pt-4 animate-pulse">
            <div className="h-8 w-40 rounded bg-muted" />
            <div className="h-[200px] w-full rounded bg-muted" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 h-full py-10 text-center">
            <span className="text-2xl font-semibold">{formatCurrency(totalCost)}</span>
            <p className="text-sm text-muted-foreground">Cost trend will populate as new part revisions are created</p>
          </div>
        ) : (
          <div className="flex flex-col h-full space-y-4 pt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{formatCurrency(totalCost)}</span>
              <span className="text-sm font-medium text-emerald-500 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                Current Revision
              </span>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    hide
                    domain={['dataMin - (dataMin * 0.1)', 'dataMax + (dataMax * 0.1)']}
                  />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const value = payload[0].value as number;
                        return (
                          <div className="bg-popover border rounded-lg px-3 py-2 shadow-lg">
                            <p className="font-medium text-sm mb-1">{label}</p>
                            <p className="text-sm font-bold text-primary">
                              {formatCurrency(value)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCost)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BomCostDrivers({ nodes, formatCurrency }: { nodes: BOMNode[]; formatCurrency: (n: number) => string }) {
  const drivers = useMemo(() => getBomCostDrivers(nodes), [nodes]);
  const max = Math.max(...drivers.map((d) => d.ext), 1);
  const totalCost = useMemo(() => getBomTotalCost(nodes), [nodes]);
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Top Cost Drivers
            {drivers.length > 0 && <Badge variant="outline" className="text-xs">{drivers.length > 7 ? 7 : drivers.length}</Badge>}
          </CardTitle>
          {/* {totalCost > 0 && (
            <span className="text-sm font-semibold text-primary shrink-0">{formatCurrency(totalCost)}</span>
          )} */}
        </div>
      </CardHeader>
      <CardContent>
        {drivers.length === 0 ? (
          <div className="flex items-center justify-center h-[160px] text-muted-foreground text-sm">
            No priced part lines yet
          </div>
        ) : (
          <div className="space-y-3">
            {drivers.slice(0, 7).map((d) => (
              <div key={d.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400 shrink-0">{d.pn}</span>
                    <span className="text-sm text-muted-foreground truncate">{d.desc}</span>
                  </span>
                  <span className="text-sm font-semibold shrink-0">{formatCurrency(d.ext)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-[hsl(var(--chart-2))]" style={{ width: `${(d.ext / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BomSupplyRisk({ nodes, formatCurrency }: { nodes: BOMNode[]; formatCurrency: (n: number) => string }) {
  const singleSource = useMemo(() => getBomSingleSourceParts(nodes), [nodes]);
  const longLead = useMemo(() => getBomLongLeadParts(nodes), [nodes]);
  const suppliers = useMemo(() => getBomSupplierConcentration(nodes), [nodes]);
  const topSupplier = suppliers[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Single-Source Parts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <GitCommitVertical className="h-4 w-4 text-destructive" />
            Single-Source Parts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <span className="text-xl font-semibold text-destructive">{singleSource.count}</span>
            <p className="text-xs text-muted-foreground">No backup distributor on file</p>
          </div>
          <div className="divide-y">
            {singleSource.top.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-2 first:pt-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{p.pn}</span>
                    <span className="text-sm text-muted-foreground truncate">{p.desc}</span>
                  </div>
                  <span className="text-xs text-muted-foreground/70">{p.manufacturer}</span>
                </div>
                <span className="text-sm font-semibold shrink-0">{formatCurrency(p.ext)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Long-Lead Exposure */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            Long-Lead Exposure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <span className="text-xl font-semibold text-amber-600">{longLead.count}</span>
            <p className="text-xs text-muted-foreground">Lead time over {Math.round(LONG_LEAD_THRESHOLD_DAYS / 7)} weeks</p>
          </div>
          <div className="divide-y">
            {longLead.top.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-2 first:pt-0">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-blue-600 dark:text-blue-400 shrink-0">{p.pn}</span>
                  <span className="text-sm text-muted-foreground truncate">{p.desc}</span>
                </span>
                <span className="text-sm font-semibold text-amber-600 shrink-0">{formatLeadTime(p.leadTime)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Supplier Concentration */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Supplier Concentration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suppliers.length === 0 ? (
            <div className="flex items-center justify-center h-[120px] text-muted-foreground text-sm">
              No priced part lines yet
            </div>
          ) : (
            <>
              <div>
                <span className="text-xl font-semibold">{topSupplier.pct}%</span>
                <p className="text-xs text-muted-foreground">Top supplier ({topSupplier.name}) of BOM spend</p>
              </div>
              <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-secondary">
                {suppliers.map((s, i) => (
                  <div key={s.name} style={{ width: `${s.pct}%`, backgroundColor: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length] }} title={`${s.name} · ${s.pct}%`} />
                ))}
              </div>
              <div className="space-y-1.5">
                {suppliers.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SUPPLIER_COLORS[i % SUPPLIER_COLORS.length] }} />
                      {s.name}
                    </span>
                    <span className="font-semibold">{s.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const ReportBomSection = memo(function ReportBomSection({
  projectName,
  nodes,
  formatCurrency,
  costTrendData,
  costTrendLoading,
  costTrendGranularity,
  onCostTrendGranularityChange,
}: ReportBomSectionProps) {
  return (
    <div className="space-y-4 pt-6 mt-2 border-t">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Bill of Materials</h2>
          <p className="text-sm text-muted-foreground">
            BOM health, cost, and supply-chain risk{projectName ? ` for ${projectName}` : ''}
          </p>
        </div>
      </div>

      {nodes.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-[160px] text-muted-foreground text-sm">
            This project doesn't have any BOM parts yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <BomKpiRow nodes={nodes} formatCurrency={formatCurrency} />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <BomCostTrend
                nodes={nodes}
                formatCurrency={formatCurrency}
                trendData={costTrendData}
                isLoading={costTrendLoading}
                granularity={costTrendGranularity}
                onGranularityChange={onCostTrendGranularityChange}
              />
            </div>
            <div className="lg:col-span-2">
              <BomCostDrivers nodes={nodes} formatCurrency={formatCurrency} />
            </div>
          </div>
          <BomSupplyRisk nodes={nodes} formatCurrency={formatCurrency} />
        </>
      )}
    </div>
  );
});
