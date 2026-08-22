import { useState } from 'react';
import {
  ShieldAlert, AlertTriangle, CheckCircle2, Eye,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RISKS, RISK_DOTS, RISK_STATUS_META, RISK_OWNER_PALETTE,
  heatmapCell, scoreTokenHsl, RiskStatus,
} from './riskData';

// ── Owner avatar ───────────────────────────────────────────────────
function OwnerAvatar({ name, idx, size = 24 }: { name: string; idx: number; size?: number }) {
  const color = RISK_OWNER_PALETTE[idx % RISK_OWNER_PALETTE.length];
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

// ── Summary cards ─────────────────────────────────────────────────
const SUMMARY_ITEMS = [
  { label: 'Total Risks', value: '24', token: '--foreground', Icon: ShieldAlert },
  { label: 'Critical', value: '3', token: '--status-blocked', Icon: AlertTriangle },
  { label: 'Mitigated', value: '14', token: '--status-done', Icon: CheckCircle2 },
  { label: 'Open', value: '7', token: '--priority-high', Icon: Eye },
] as const;

// ── Heatmap legend entries ─────────────────────────────────────────
const LEGEND = [
  { label: 'Critical (≥20)', bg: 'hsl(var(--status-blocked) / 0.28)', border: 'hsl(var(--status-blocked) / 0.5)' },
  { label: 'High (10–19)', bg: 'hsl(var(--priority-high)  / 0.22)', border: 'hsl(var(--priority-high)  / 0.38)' },
  { label: 'Medium (5–9)', bg: 'hsl(var(--status-done)    / 0.12)', border: 'hsl(var(--status-done)    / 0.22)' },
  { label: 'Low (<5)', bg: 'hsl(var(--status-done)    / 0.05)', border: 'hsl(var(--status-done)    / 0.14)' },
];

const REGISTER_COLS = '88px minmax(0,1fr) 72px minmax(160px,200px) 108px 32px';

export function RiskView() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [hovCell, setHovCell] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 animate-fade-in pt-4">
      {/* Header */}
      {/* <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" style={{ color: 'hsl(var(--status-in-progress))' }} />
            <h2 className="text-xl font-semibold tracking-tight">Risk &amp; Issue Tracker</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Project: EV Charging Station — risk register and probability–impact assessment.
          </p>
        </div>
      </div> */}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SUMMARY_ITEMS.map((item) => (
          <div key={item.label} className="bg-card border rounded-lg p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <item.Icon className="h-3.5 w-3.5" style={{ color: `hsl(var(${item.token}))` }} />
            </div>
            <span
              className="text-2xl font-bold leading-none tabular-nums"
              style={{ color: `hsl(var(${item.token}))` }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Heatmap + Register */}
      <div className="flex gap-4 items-start flex-wrap xl:flex-nowrap">

        {/* ── Risk Heatmap ─────────────────────────────────────────── */}
        <div className="bg-card border rounded-lg p-5 shrink-0 w-full xl:w-[320px]">
          <div className="text-sm font-semibold">Risk Heatmap</div>
          <div className="text-xs text-muted-foreground mt-0.5 mb-4">Probability × Impact</div>

          <div className="flex gap-2">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-between items-center pb-7" style={{ width: 16 }}>
              {[5, 4, 3, 2, 1].map(n => (
                <span key={n} className="text-[10px] text-muted-foreground leading-none">{n}</span>
              ))}
              <span className="text-[9px] text-muted-foreground mt-1">Prob.</span>
            </div>

            <div className="flex-1 min-w-0">
              {/* Grid */}
              <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {[5, 4, 3, 2, 1].map(prob =>
                  [1, 2, 3, 4, 5].map(impact => {
                    const cell = heatmapCell(prob, impact);
                    const dotsHere = RISK_DOTS.filter(d => d.prob === prob && d.impact === impact);
                    const key = `${prob}-${impact}`;
                    const isHov = hovCell === key;
                    return (
                      <div
                        key={key}
                        onMouseEnter={() => setHovCell(key)}
                        onMouseLeave={() => setHovCell(null)}
                        className="flex flex-wrap items-center justify-center gap-[3px] rounded transition-colors"
                        style={{
                          height: 42,
                          padding: 4,
                          background: isHov ? 'hsl(var(--accent))' : cell.bg,
                          border: `1px solid ${cell.border}`,
                        }}
                      >
                        {dotsHere.length > 0
                          ? dotsHere.map(d => (
                            <div
                              key={d.id}
                              title={d.id}
                              className="rounded-full shrink-0"
                              style={{ width: 8, height: 8, background: 'hsl(var(--foreground))', opacity: 0.65 }}
                            />
                          ))
                          : (
                            <span className="text-[9px] text-foreground" style={{ opacity: 0.15 }}>
                              {prob * impact}
                            </span>
                          )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* X-axis labels */}
              <div className="grid mt-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 3 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <div key={n} className="text-center text-[10px] text-muted-foreground">{n}</div>
                ))}
              </div>
              <div className="text-center text-[9px] text-muted-foreground mt-0.5">Impact →</div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2 mt-4">
            {LEGEND.map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <div
                  className="rounded-sm shrink-0"
                  style={{ width: 14, height: 10, background: l.bg, border: `1px solid ${l.border}` }}
                />
                <span className="text-[11.5px] text-muted-foreground whitespace-nowrap">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Risk Register ─────────────────────────────────────────── */}
        <div className="bg-card border rounded-lg overflow-hidden flex-1 min-w-0">
          <div className="px-4 py-3 border-b text-sm font-semibold">Risk Register</div>

          {/* Table header — desktop only */}
          <div
            className="hidden md:grid border-b"
            style={{ gridTemplateColumns: REGISTER_COLS, background: 'hsl(var(--secondary) / 0.5)' }}
          >
            {['Risk ID', 'Description', 'Score', 'Owner', 'Status', ''].map((h, i) => (
              <div
                key={i}
                className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
              >
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="max-h-[520px] overflow-y-auto">
            {RISKS.map((r, i) => {
              const s = RISK_STATUS_META[r.status as RiskStatus];
              const scoreHsl = scoreTokenHsl(r.score);
              const isH = hovered === r.id;
              const isLast = i === RISKS.length - 1;
              return (
                <div
                  key={r.id}
                  className={cn('transition-colors', !isLast && 'border-b')}
                  style={{ background: isH ? 'hsl(var(--accent) / 0.5)' : 'transparent' }}
                  onMouseEnter={() => setHovered(r.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* Desktop row */}
                  <div
                    className="hidden md:grid items-center min-h-[50px]"
                    style={{ gridTemplateColumns: REGISTER_COLS }}
                  >
                    {/* Risk ID */}
                    <div className="px-3">
                      <span
                        className="font-mono text-[12.5px] font-semibold"
                        style={{ color: 'hsl(var(--status-in-progress))' }}
                      >
                        {r.id}
                      </span>
                    </div>

                    {/* Description */}
                    <div className="px-3 py-2 min-w-0">
                      <div className="text-[13px] text-foreground leading-snug">{r.desc}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{r.category}</div>
                    </div>

                    {/* Score badge */}
                    <div className="px-3">
                      <div
                        className="inline-flex items-center justify-center tabular-nums rounded-full font-bold text-[13px]"
                        style={{
                          width: 32, height: 32,
                          background: `hsl(${scoreHsl} / 0.12)`,
                          border: `2px solid hsl(${scoreHsl} / 0.35)`,
                          color: `hsl(${scoreHsl})`,
                        }}
                      >
                        {r.score}
                      </div>
                    </div>

                    {/* Owner */}
                    <div className="px-3 flex items-center gap-2 min-w-0">
                      <OwnerAvatar name={r.owner} idx={r.ownerIdx} size={22} />
                      <span className="text-[12.5px] truncate">{r.owner}</span>
                    </div>

                    {/* Status chip */}
                    <div className="px-3">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                        style={{
                          color: `hsl(var(${s.token}))`,
                          background: `hsl(var(${s.token}) / 0.10)`,
                          borderColor: `hsl(var(${s.token}) / 0.25)`,
                        }}
                      >
                        {s.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-center" style={{ opacity: isH ? 1 : 0 }}>
                      <button
                        className="flex items-center justify-center rounded transition-colors hover:bg-accent"
                        style={{ width: 26, height: 26 }}
                        title="More options"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile card row */}
                  <div className="md:hidden px-4 py-3 flex items-start gap-3">
                    <div
                      className="inline-flex items-center justify-center tabular-nums rounded-full font-bold text-xs shrink-0 mt-0.5"
                      style={{
                        width: 30, height: 30,
                        background: `hsl(${scoreHsl} / 0.12)`,
                        border: `2px solid hsl(${scoreHsl} / 0.35)`,
                        color: `hsl(${scoreHsl})`,
                      }}
                    >
                      {r.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span
                          className="font-mono text-[11px] font-semibold"
                          style={{ color: 'hsl(var(--status-in-progress))' }}
                        >
                          {r.id}
                        </span>
                        <span
                          className="inline-flex items-center px-2 py-px rounded-full text-[10px] font-semibold border"
                          style={{
                            color: `hsl(var(${s.token}))`,
                            background: `hsl(var(${s.token}) / 0.10)`,
                            borderColor: `hsl(var(${s.token}) / 0.25)`,
                          }}
                        >
                          {s.label}
                        </span>
                      </div>
                      <div className="text-[12.5px] text-foreground leading-snug">{r.desc}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <OwnerAvatar name={r.owner} idx={r.ownerIdx} size={16} />
                        <span className="text-xs text-muted-foreground">{r.owner}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{r.category}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t text-xs text-muted-foreground">
            <span>Showing {RISKS.length} of 24 risks · Sorted by score</span>
            <span>Last updated Apr 21, 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
