import { useState } from 'react';
import {
  CheckCircle2, Flag, Clock, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  GATE_MONTHS, GATE_PHASES, GATE_MILESTONES,
  GateStatus, gateStatusColor, OWNER_PALETTE,
} from './gateData';

// ── Owner avatar (initials + palette color) ────────────────────────
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

// ── Phase status labels ────────────────────────────────────────────
const STATUS_LABEL: Record<GateStatus, string> = {
  done: 'Completed',
  active: 'In Progress',
  upcoming: 'Upcoming',
};

// ── Summary card icons (static list) ──────────────────────────────
const SUMMARY_ICONS = [CheckCircle2, Flag, Clock, AlertTriangle] as const;
const SUMMARY_ITEMS = [
  { label: 'Gates Complete', value: '3 / 6', token: '--status-done', idx: 0 },
  { label: 'Current Phase', value: 'MRR', token: '--status-in-progress', idx: 1 },
  { label: 'Days to Gate 3', value: '22', token: '--priority-medium', idx: 2 },
  { label: 'Open Issues', value: '7', token: '--status-blocked', idx: 3 },
] as const;

// ── Table column widths ────────────────────────────────────────────
const COL = '100px 80px minmax(0,1fr) 120px 130px 60px 60px 28px';

export function GateReviewsScreen({ onOpenGate }: { onOpenGate: (id: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 animate-fade-in pt-4">
      {/* Header */}
      {/* <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5" style={{ color: 'hsl(var(--status-in-progress))' }} />
            <h2 className="text-xl font-semibold tracking-tight">Phase Gate Tracker</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Project: Smart Patient Vital Monitor — milestone timeline and gate review status.
          </p>
        </div>
      </div> */}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SUMMARY_ITEMS.map((item, i) => {
          const Icon = SUMMARY_ICONS[item.idx];
          return (
            <div key={item.label} className="bg-card border rounded-lg p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <Icon className="h-3.5 w-3.5" style={{ color: `hsl(var(${item.token}))` }} />
              </div>
              <span
                className="text-2xl font-bold leading-none tabular-nums"
                style={{ color: `hsl(var(${item.token}))` }}
              >
                {item.value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Gantt timeline */}
      <div className="bg-card border rounded-lg p-5">
        <div className="text-sm font-semibold mb-4">Program Timeline — 2026</div>

        {/* Month headers */}
        <div className="flex mb-2">
          {GATE_MONTHS.map((m, i) => (
            <div
              key={m}
              className="flex-1 text-center text-xs text-muted-foreground"
              style={{ borderLeft: i === 0 ? 'none' : '1px solid hsl(var(--border))', paddingTop: 2 }}
            >
              {m}
            </div>
          ))}
        </div>

        {/* Bars + Today marker */}
        <div className="relative" style={{ paddingTop: 20 }}>
          {/* Today line */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: '38%', width: 1, background: 'hsl(var(--status-in-progress) / 0.45)', zIndex: 5 }}
          >
            <span
              className="absolute top-0 text-[10px] font-semibold whitespace-nowrap rounded px-1.5 py-0.5"
              style={{
                left: -18,
                color: 'hsl(var(--status-in-progress))',
                background: 'hsl(var(--status-in-progress) / 0.12)',
              }}
            >
              Today
            </span>
          </div>

          {GATE_PHASES.map((ph) => {
            const col = gateStatusColor(ph.status);
            const isUpcoming = ph.status === 'upcoming';
            return (
              <div key={ph.id} className="flex items-center mb-2 h-8">
                <div className="relative w-full h-6 rounded" style={{ background: 'hsl(var(--secondary))' }}>
                  {/* Phase bar */}
                  <div
                    className="absolute h-full rounded flex items-center overflow-hidden"
                    style={{
                      left: `${ph.startPct}%`,
                      width: `${ph.endPct - ph.startPct}%`,
                      background: isUpcoming
                        ? 'hsl(var(--accent))'
                        : `hsl(var(${ph.status === 'done' ? '--status-done' : '--status-in-progress'}) / 0.12)`,
                      border: `1px solid ${isUpcoming ? 'hsl(var(--border))' : `${col}66`}`,
                      paddingLeft: 8,
                    }}
                  >
                    <span
                      className="text-[11px] font-semibold whitespace-nowrap"
                      style={{ color: isUpcoming ? 'hsl(var(--muted-foreground))' : col }}
                    >
                      {ph.label}
                    </span>
                  </div>
                  {/* Gate diamond */}
                  <div
                    className="absolute"
                    style={{
                      left: `calc(${ph.endPct}% - 8px)`,
                      top: '50%',
                      transform: 'translateY(-50%) rotate(45deg)',
                      width: 14, height: 14,
                      background: col,
                      border: `2px solid ${col}`,
                      zIndex: 2,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mt-3 pt-3 border-t flex-wrap">
          {(['done', 'active', 'upcoming'] as GateStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: gateStatusColor(s) }} />
              {STATUS_LABEL[s]}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="w-2.5 h-2.5"
              style={{ background: 'hsl(var(--status-in-progress))', transform: 'rotate(45deg)' }}
            />
            Gate Review
          </div>
        </div>
      </div>

      {/* Milestone table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-semibold">Gate Review Milestones</div>

        {/* Table header */}
        <div
          className="hidden md:grid border-b"
          style={{ gridTemplateColumns: COL, background: 'hsl(var(--secondary) / 0.5)' }}
        >
          {['Phase', 'Gate', 'Owner', 'Due Date', 'Completion', 'Tasks', 'Issues', ''].map((h, i) => (
            <div
              key={i}
              className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
            >
              {h}
            </div>
          ))}
        </div>

        {GATE_MILESTONES.map((m, i) => {
          const col = gateStatusColor(m.status);
          const isH = hovered === m.id;
          const isLast = i === GATE_MILESTONES.length - 1;
          return (
            <div
              key={m.id}
              className={cn('cursor-pointer transition-colors', !isLast && 'border-b')}
              style={{ background: isH ? 'hsl(var(--accent) / 0.5)' : 'transparent' }}
              onMouseEnter={() => setHovered(m.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onOpenGate(m.id)}
            >
              {/* Desktop grid row */}
              <div
                className="hidden md:grid items-center min-h-[48px]"
                style={{ gridTemplateColumns: COL }}
              >
                <div className="px-3">
                  <span className="text-xs font-semibold" style={{ color: col }}>{m.phase}</span>
                </div>
                <div className="px-3 text-xs text-muted-foreground">{m.gate}</div>
                <div className="px-3 flex items-center gap-1.5">
                  <GateAvatar name={m.owner} idx={m.ownerIdx} size={22} />
                  <span className="text-xs truncate">{m.owner}</span>
                </div>
                <div
                  className="px-3 text-xs"
                  style={{ color: m.status === 'active' ? 'hsl(var(--priority-medium))' : 'hsl(var(--muted-foreground))' }}
                >
                  {m.due}
                </div>
                <div className="px-3">
                  <div className="mb-1">
                    <span className="text-xs font-semibold tabular-nums" style={{ color: col }}>{m.pct}%</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--secondary))' }}>
                    <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: col }} />
                  </div>
                </div>
                <div className="px-3 text-xs text-muted-foreground tabular-nums">{m.tasks}</div>
                <div
                  className="px-3 text-xs tabular-nums"
                  style={{
                    fontWeight: m.openIssues > 0 ? 600 : 400,
                    color: m.openIssues > 0 ? 'hsl(var(--status-blocked))' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {m.openIssues > 0 ? m.openIssues : '—'}
                </div>
                <div className="flex items-center justify-center" style={{ opacity: isH ? 1 : 0.3 }}>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>

              {/* Mobile card row */}
              <div className="md:hidden px-4 py-3 flex items-center gap-3">
                <GateAvatar name={m.owner} idx={m.ownerIdx} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold" style={{ color: col }}>{m.phase}</span>
                    <span className="text-xs text-muted-foreground">{m.gate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{m.due}</span>
                    <span className="text-xs tabular-nums font-medium" style={{ color: col }}>{m.pct}%</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
