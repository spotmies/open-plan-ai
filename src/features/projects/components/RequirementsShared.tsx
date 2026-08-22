import React from 'react';
import {
  REQ_TYPE, REQ_CATEGORY, REQ_STATUS, REQ_VSTATUS, REQ_PRIORITY,
  GAP_META, ownerOf,
  type ReqType, type ReqCategory, type ReqStatus, type ReqVStatus, type ReqPriority,
} from './requirementsData';
import {
  Unlink, PackageX, FlaskConical, AlertTriangle,
} from 'lucide-react';

// ── Utilities ──────────────────────────────────────────────────────────────────
export function softTint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── ReqKeyTag ──────────────────────────────────────────────────────────────────
export function ReqKeyTag({ reqKey, onClick }: { reqKey: string; onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{ fontFamily:"'JetBrains Mono','Cascadia Code',monospace", fontSize:11.5, fontWeight:600, color:'hsl(var(--foreground))', cursor: onClick ? 'pointer' : 'default', whiteSpace:'nowrap' }}
    >
      {reqKey}
    </span>
  );
}

// ── TypePill ──────────────────────────────────────────────────────────────────
export function TypePill({ type }: { type: ReqType }) {
  const m = REQ_TYPE[type];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:9999, fontSize:10.5, fontWeight:600,
      background:softTint(m.tint, 0.12), color:m.tint, border:`1px solid ${softTint(m.tint, 0.25)}`, whiteSpace:'nowrap' }}>
      {m.short}
    </span>
  );
}

// ── CatPill ───────────────────────────────────────────────────────────────────
export function CatPill({ category }: { category: ReqCategory }) {
  const m = REQ_CATEGORY[category];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:9999, fontSize:10.5, fontWeight:600,
      background:softTint(m.tint, 0.10), color:m.tint, border:`1px solid ${softTint(m.tint, 0.22)}`, whiteSpace:'nowrap' }}>
      {m.label}
    </span>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: ReqStatus }) {
  const m = REQ_STATUS[status];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:9999, fontSize:10.5, fontWeight:700,
      background:softTint(m.tint, 0.13), color:m.tint, border:`1px solid ${softTint(m.tint, 0.28)}`, whiteSpace:'nowrap' }}>
      {m.label}
    </span>
  );
}

// ── VStatusBadge ──────────────────────────────────────────────────────────────
export function VStatusBadge({ vstatus }: { vstatus: ReqVStatus }) {
  const m = REQ_VSTATUS[vstatus];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:9999, fontSize:10.5, fontWeight:600,
      background:softTint(m.tint, 0.11), color:m.tint, border:`1px solid ${softTint(m.tint, 0.25)}`, whiteSpace:'nowrap' }}>
      {m.label}
    </span>
  );
}

// ── PriorityPill ──────────────────────────────────────────────────────────────
export function PriorityPill({ priority }: { priority: ReqPriority }) {
  const m = REQ_PRIORITY[priority];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:9999, fontSize:10.5, fontWeight:700,
      background:softTint(m.tint, 0.11), color:m.tint, border:`1px solid ${softTint(m.tint, 0.25)}`, whiteSpace:'nowrap' }}>
      {m.label}
    </span>
  );
}

// ── CoverageCell ──────────────────────────────────────────────────────────────
const GAP_ICONS: Record<string, React.ElementType> = { orphan:Unlink, unimplemented:PackageX, untested:FlaskConical, suspect:AlertTriangle };
export function CoverageCell({ coverage }: { coverage: { orphan:boolean; untested:boolean; unimplemented:boolean; suspect:boolean } }) {
  const active = (['orphan','unimplemented','untested','suspect'] as const).filter(k => coverage[k]);
  if (!active.length) return <span style={{ fontSize:11, color:'#16A34A', fontWeight:600 }}>✓</span>;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
      {active.map(k => {
        const Ic = GAP_ICONS[k];
        const m = GAP_META[k];
        return <Ic key={k} size={12} color={m.tint} title={m.label} />;
      })}
    </span>
  );
}

// ── OwnerAvatar ───────────────────────────────────────────────────────────────
export function OwnerAvatar({ ownerId, size = 22 }: { ownerId: string; size?: number }) {
  const m = ownerOf(ownerId);
  return (
    <span title={m.name} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:size, height:size, borderRadius:9999, flexShrink:0,
      background:softTint(m.color, 0.18), color:m.color, fontSize: size * 0.42, fontWeight:700, border:`1px solid ${softTint(m.color,0.3)}` }}>
      {m.initials}
    </span>
  );
}

// ── Gap Chips ─────────────────────────────────────────────────────────────────
export function GapChip({ type, count, onClick }: { type: keyof typeof GAP_META; count: number; onClick?: () => void }) {
  const m = GAP_META[type];
  const Ic = GAP_ICONS[type];
  return (
    <button onClick={onClick} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:9999, cursor: onClick ? 'pointer' : 'default', fontFamily:'inherit',
      background:softTint(m.tint, 0.10), color:m.tint, border:`1px solid ${softTint(m.tint, 0.28)}`, fontSize:12, fontWeight:600, whiteSpace:'nowrap' }}>
      <Ic size={12} color={m.tint} />
      {count} {type}
    </button>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────
export interface DonutSegment { value: number; tint: string; label: string; }
export function Donut({ segments, total, size=148, thickness=20, centerLabel, centerSub }:
  { segments: DonutSegment[]; total: number; size?: number; thickness?: number; centerLabel: string; centerSub: string }) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={thickness}/>
        {segments.filter(s=>s.value>0).map((s,i) => {
          const frac = s.value / total;
          const dash = circ * frac;
          const el = (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.tint}
              strokeWidth={thickness} strokeDasharray={`${dash} ${circ-dash}`}
              strokeDashoffset={-offset} style={{ transition:'stroke-dasharray .7s cubic-bezier(.4,0,.2,1)' }}/>
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:28, fontWeight:700, color:'hsl(var(--foreground))', lineHeight:1 }}>{centerLabel}</span>
        <span style={{ fontSize:11, color:'hsl(var(--muted-foreground))', marginTop:3 }}>{centerSub}</span>
      </div>
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
export function StatTile({ label, value, icon: Icon, tint, sub }: { label:string; value:string|number; icon:React.ElementType; tint:string; sub?:string }) {
  return (
    <div style={{ flex:1, minWidth:0, padding:'14px 16px', borderRadius:12, border:'1px solid hsl(var(--border))', background:'hsl(var(--card))', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
      <span style={{ width:30, height:30, borderRadius:8, background:softTint(tint,0.12), display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
        <Icon size={15} color={tint}/>
      </span>
      <div>
        <div style={{ fontSize:24, fontWeight:700, color:'hsl(var(--foreground))', lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:11.5, color:'hsl(var(--muted-foreground))', marginTop:4 }}>{label}{sub ? ` · ${sub}` : ''}</div>
      </div>
    </div>
  );
}

// ── Coverage bar ──────────────────────────────────────────────────────────────
export function CoverageBar({ label, total, verified, gaps, tint, onClick, sub }:
  { label:string; total:number; verified:number; gaps:number; tint?:string; onClick?:()=>void; sub?:string }) {
  const pct = total ? Math.round(verified / total * 100) : 0;
  const barColor = pct >= 70 ? '#16A34A' : pct >= 40 ? '#CA8A04' : '#DC2626';
  return (
    <button onClick={onClick} style={{ display:'block', width:'100%', textAlign:'left', border:'none', background:'transparent', cursor:onClick?'pointer':'default', fontFamily:'inherit', padding:'7px 0' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
        {tint && <span style={{ width:8, height:8, borderRadius:2, background:tint, flexShrink:0 }}/>}
        <span style={{ fontSize:12.5, fontWeight:500, color:'hsl(var(--foreground))', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
        {sub && <span style={{ fontSize:11, color:'hsl(var(--muted-foreground))' }}>{sub}</span>}
        <span style={{ fontSize:12, fontWeight:600, color:barColor, width:34, textAlign:'right' }}>{pct}%</span>
      </div>
      <div style={{ height:7, borderRadius:9999, background:'hsl(var(--border))', overflow:'hidden', display:'flex' }}>
        <div style={{ width:`${pct}%`, background:'#16A34A', transition:'width .6s' }}/>
        {gaps > 0 && <div style={{ width:`${Math.round(gaps/total*100)}%`, background:softTint('#DC2626',0.5) }}/>}
      </div>
    </button>
  );
}

// ── ScoreRing ─────────────────────────────────────────────────────────────────
export function ScoreRing({ pct, tint, grade, size=72 }: { pct:number; tint:string; grade:string; size?:number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={7}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={tint} strokeWidth={7}
          strokeDasharray={`${circ*pct/100} ${circ*(1-pct/100)}`}
          style={{ transition:'stroke-dasharray .7s cubic-bezier(.4,0,.2,1)' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:size*0.3, fontWeight:700, color:tint, lineHeight:1 }}>{grade}</span>
      </div>
    </div>
  );
}
