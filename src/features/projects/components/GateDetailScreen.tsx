import { useState } from 'react';
import {
  ArrowLeft, Activity, ClipboardCheck, AlertTriangle, Clock,
  GitBranch, Boxes, Shield, Factory, Truck, FileText,
  RefreshCw, ChevronDown, ChevronRight, Check, Ban,
  SlidersHorizontal, Pause, History, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  GATE_DETAILS, GATE_MILESTONES, GateDetail, CriteriaGroup,
  CriteriaStatus, ReviewerState, GateRecommendation,
  gateCriteriaColor, OWNER_PALETTE,
} from './gateData';

// ── Icon map (string key → lucide component) ───────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  'activity':        Activity,
  'clipboard-check': ClipboardCheck,
  'alert-triangle':  AlertTriangle,
  'clock':           Clock,
  'git-branch':      GitBranch,
  'boxes':           Boxes,
  'shield':          Shield,
  'factory':         Factory,
  'truck':           Truck,
  'file-text':       FileText,
};

function GIcon({ name, size = 14, color }: { name: string; size?: number; color?: string }) {
  const Comp = ICON_MAP[name] ?? Activity;
  return <Comp style={{ width: size, height: size, color, flexShrink: 0 }} />;
}

// ── Owner avatar ───────────────────────────────────────────────────
function GateAvatar({ name, idx, size = 24 }: { name: string; idx: number; size?: number }) {
  const color = OWNER_PALETTE[idx % OWNER_PALETTE.length];
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span
      style={{
        width: size, height: size, borderRadius: 9999, flexShrink: 0,
        background: color, color: '#fff', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.38), fontWeight: 600,
      }}
    >
      {initials}
    </span>
  );
}

// ── Criteria status chip ───────────────────────────────────────────
function StatusChip({ status }: { status: CriteriaStatus }) {
  const col = gateCriteriaColor(status);
  const label = { pass: 'Pass', partial: 'Partial', fail: 'Fail', na: 'N/A' }[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10.5px] font-semibold whitespace-nowrap rounded-full px-2 py-0.5"
      style={{ color: col, background: `${col}18`, border: `1px solid ${col}4d` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: col }} />
      {label}
    </span>
  );
}

// ── Reviewer state badge ───────────────────────────────────────────
function ReviewerBadge({ state }: { state: ReviewerState }) {
  const cfg: Record<ReviewerState, { label: string; token: string; Icon: React.ElementType }> = {
    signed:  { label: 'Signed',  token: '--status-done',    Icon: Check },
    pending: { label: 'Pending', token: '--muted-foreground', Icon: Clock },
    blocked: { label: 'Blocked', token: '--status-blocked', Icon: Ban },
  };
  const { label, token, Icon } = cfg[state];
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold"
      style={{ color: `hsl(var(${token}))` }}
    >
      <Icon style={{ width: 12, height: 12 }} />
      {label}
    </span>
  );
}

// ── SVG readiness ring ─────────────────────────────────────────────
function ReadinessRing({ value, color }: { value: number; color: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return (
    <div className="relative" style={{ width: 120, height: 120, flexShrink: 0 }}>
      <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="9" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-bold leading-none tabular-nums text-foreground">{value}</span>
        <span className="text-[11px] text-muted-foreground mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ── Recommendation config ──────────────────────────────────────────
const REC_CONFIG: Record<GateRecommendation, { label: string; token: string; line: string }> = {
  go:          { label: 'Go',               token: '--status-done',        line: 'All criteria pass — clear to advance.' },
  conditional: { label: 'Conditional Go',   token: '--priority-medium',    line: '4 criteria partial, 3 fail. Advance with tracked action items + owners.' },
  hold:        { label: 'Hold / Recycle',   token: '--muted-foreground',   line: 'Too many open blockers — recycle the phase.' },
  nogo:        { label: 'No-Go',            token: '--status-blocked',     line: 'Critical exit criteria failed.' },
};

// ── Collapsible criteria group ─────────────────────────────────────
function CriteriaGroupRow({ g, defaultOpen }: { g: CriteriaGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const counts = g.items.reduce((acc, it) => {
    acc[it.status] = (acc[it.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
      >
        <span className="shrink-0 text-muted-foreground">
          {open
            ? <ChevronDown style={{ width: 13, height: 13 }} />
            : <ChevronRight style={{ width: 13, height: 13 }} />}
        </span>
        <span
          className="flex items-center justify-center rounded-md shrink-0"
          style={{ width: 24, height: 24, background: 'hsl(var(--secondary))' }}
        >
          <GIcon name={g.iconKey} size={13} color="hsl(var(--muted-foreground))" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-foreground">{g.label}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Pulled from {g.source}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {counts.fail > 0 && (
            <span className="text-[11px] font-semibold" style={{ color: 'hsl(var(--status-blocked))' }}>
              {counts.fail} fail
            </span>
          )}
          {counts.partial > 0 && (
            <span className="text-[11px] font-semibold" style={{ color: 'hsl(var(--priority-medium))' }}>
              {counts.partial} partial
            </span>
          )}
          {counts.pass > 0 && (
            <span className="text-[11px] font-semibold" style={{ color: 'hsl(var(--status-done))' }}>
              {counts.pass} pass
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="pl-14 pr-4 pb-2">
          {g.items.map((it, i) => (
            <div
              key={i}
              className={cn('flex items-center gap-3 py-2.5', i > 0 && 'border-t')}
            >
              <div className="flex-1 min-w-0 text-[12.5px] text-muted-foreground font-medium">{it.name}</div>
              <div
                className="font-mono text-[11.5px] font-medium whitespace-nowrap shrink-0"
                style={{ color: gateCriteriaColor(it.status) }}
              >
                {it.metric}
              </div>
              <div className="shrink-0 w-16 text-right">
                <StatusChip status={it.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main detail screen ─────────────────────────────────────────────
export function GateDetailScreen({ gateId, onBack }: { gateId: string; onBack: () => void }) {
  const milestone = GATE_MILESTONES.find(m => m.id === gateId);
  const d: GateDetail | undefined = GATE_DETAILS[gateId];

  // Fall back to first available gate detail if the clicked gate has no detail data
  if (!d || !milestone) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-muted-foreground text-sm">No detail data available for this gate.</p>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Phase Gate Tracker
        </Button>
      </div>
    );
  }

  const readyColor =
    d.readiness >= 85
      ? 'hsl(var(--status-done))'
      : d.readiness >= 70
      ? 'hsl(var(--priority-medium))'
      : 'hsl(var(--status-blocked))';

  const rec = REC_CONFIG[d.recommendation];
  const recColor = `hsl(var(${rec.token}))`;
  const signedCount = d.reviewers.filter(r => r.state === 'signed').length;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Breadcrumb */}
      <button
        onClick={onBack}
        className="self-start flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0"
      >
        <ArrowLeft style={{ width: 13, height: 13 }} />
        Phase Gate Tracker
      </button>

      {/* Gate header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <span
              className="shrink-0"
              style={{
                width: 13, height: 13, background: 'hsl(var(--priority-medium))',
                transform: 'rotate(45deg)', display: 'inline-block',
              }}
            />
            <h2 className="text-xl font-semibold tracking-tight">
              {d.gate} · {d.title}
            </h2>
            <span
              className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 border whitespace-nowrap"
              style={{
                color: 'hsl(var(--status-in-progress))',
                background: 'hsl(var(--status-in-progress) / 0.1)',
                borderColor: 'hsl(var(--status-in-progress) / 0.3)',
              }}
            >
              {d.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span>
              Phase <b className="text-foreground font-semibold">{d.phase}</b>
              {' '}· alt label <b className="text-foreground font-semibold">{d.dualLabel}</b>
            </span>
            <span className="flex items-center gap-1.5">
              <GateAvatar name={d.owner} idx={d.ownerIdx} size={16} />
              {d.owner}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock style={{ width: 12, height: 12, color: 'hsl(var(--priority-medium))' }} />
              Due {d.due} · {d.daysTo}d
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Configure criteria
          </Button>
          <Button size="sm" className="gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Start Go / No-Go review
          </Button>
        </div>
      </div>

      {/* 4-up KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {d.kpis.map((kpi) => (
          <div key={kpi.label} className="bg-card border rounded-lg p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
              <GIcon name={kpi.iconKey} size={14} color={`hsl(var(${kpi.token}))`} />
            </div>
            <div
              className="text-[22px] font-bold leading-none tabular-nums"
              style={{ color: `hsl(var(${kpi.token}))` }}
            >
              {kpi.value}
              {kpi.sub && (
                <span className="text-sm text-muted-foreground font-medium ml-1">{kpi.sub}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 items-start flex-wrap lg:flex-nowrap">

        {/* LEFT: readiness + exit criteria */}
        <div className="flex-1 min-w-0 flex flex-col gap-4" style={{ flexBasis: '620px' }}>

          {/* Readiness breakdown */}
          <div className="bg-card border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold">Computed readiness</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw style={{ width: 11, height: 11 }} />
                Live from 6 modules · synced 4m ago
              </span>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex flex-col items-center gap-2">
                <ReadinessRing value={d.readiness} color={readyColor} />
                <span className="text-[11.5px] font-semibold" style={{ color: readyColor }}>
                  At risk · conditional
                </span>
              </div>
              <div
                className="flex-1 min-w-0 grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
              >
                {d.subscores.map((s) => (
                  <div key={s.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                        <GIcon name={s.iconKey} size={12} color="hsl(var(--muted-foreground))" />
                        <span className="truncate">{s.label}</span>
                      </span>
                      <span
                        className="text-xs font-semibold tabular-nums shrink-0"
                        style={{ color: gateCriteriaColor(s.status) }}
                      >
                        {s.score}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--secondary))' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${s.score}%`, background: gateCriteriaColor(s.status) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Exit criteria groups */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm font-semibold">
                Exit criteria{' '}
                <span className="text-muted-foreground font-normal">· 16 typed, auto-evaluated</span>
              </div>
              <span className="text-xs text-muted-foreground">No checklist — assembled from module state</span>
            </div>
            {d.groups.map((g) => (
              <CriteriaGroupRow
                key={g.key}
                g={g}
                defaultOpen={g.items.some(it => it.status !== 'pass')}
              />
            ))}
          </div>
        </div>

        {/* RIGHT: recommendation + gatekeepers + evidence */}
        <div className="flex flex-col gap-4" style={{ flex: '0 0 320px', minWidth: 0, maxWidth: 360, width: '100%' }}>

          {/* Recommendation card */}
          <div
            className="bg-card rounded-lg overflow-hidden"
            style={{
              border: `1px solid ${recColor}72`,
            }}
          >
            <div
              className="px-4 py-3 border-b"
              style={{
                background: `${recColor}12`,
                borderColor: `${recColor}40`,
              }}
            >
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Recommended decision
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  style={{
                    width: 11, height: 11, background: recColor,
                    transform: 'rotate(45deg)', display: 'inline-block', flexShrink: 0,
                  }}
                />
                <span className="text-base font-bold" style={{ color: recColor }}>{rec.label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{rec.line}</p>
            </div>
            <div className="p-3 flex flex-col gap-2">
              <Button className="w-full gap-1.5" size="sm">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Open Go / No-Go review
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5">
                  <Pause className="h-3.5 w-3.5" />
                  Hold
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Decision log
                </Button>
              </div>
            </div>
          </div>

          {/* Gatekeepers */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold">Gatekeepers</span>
              <span className="text-xs text-muted-foreground">
                {signedCount} / {d.reviewers.length} signed
              </span>
            </div>
            {d.reviewers.map((r, i) => (
              <div key={i} className={cn('flex items-center gap-2.5 px-4 py-2.5', i > 0 && 'border-t')}>
                <GateAvatar name={r.name} idx={r.idx} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.role}</div>
                </div>
                <ReviewerBadge state={r.state} />
              </div>
            ))}
            <button className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t text-xs font-medium text-muted-foreground hover:bg-accent/40 transition-colors bg-transparent cursor-pointer">
              <Plus style={{ width: 13, height: 13 }} />
              Assign reviewer
            </button>
          </div>

          {/* Attached evidence */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b text-sm font-semibold">Attached evidence</div>
            {d.evidence.map((ev, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-accent/40 transition-colors',
                  i > 0 && 'border-t'
                )}
              >
                <div
                  className="flex items-center justify-center rounded shrink-0"
                  style={{ width: 28, height: 28, background: 'hsl(var(--secondary))' }}
                >
                  <GIcon name={ev.iconKey} size={13} color="hsl(var(--muted-foreground))" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{ev.name}</div>
                  <div className="text-[11px] text-muted-foreground">{ev.meta}</div>
                </div>
                <ChevronRight style={{ width: 13, height: 13, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
