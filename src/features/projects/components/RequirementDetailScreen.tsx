import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft, PenLine, GitPullRequest, ChevronRight, Check, X, Plus,
  Unlink, PackageX, FlaskConical, AlertTriangle, Send, ChevronDown,
  Activity, Sparkles, GitBranch, ClipboardCheck, BookOpen, MessageSquare,
  Link2, GitMerge, ArrowUpRight, ArrowDownRight, ArrowRight as ArrowRightIcon,
} from 'lucide-react';
import {
  REQS, BY_KEY, REQ_TYPE, REQ_STATUS, REQ_STATUS_FLOW, REQ_VSTATUS, REQ_CATEGORY,
  REQ_PRIORITY, REQ_LINKTYPE, GAP_META, ownerOf, synthCriteria, analyzeQuality,
  type Requirement, type ReqStatus,
} from './requirementsData';
import {
  ReqKeyTag, TypePill, CatPill, StatusBadge, VStatusBadge, PriorityPill,
  CoverageCell, OwnerAvatar, ScoreRing, softTint,
} from './RequirementsShared';
import {
  useCreateRequirementLink, useDeleteRequirementLink,
  type RequirementLinkType,
} from '@/hooks/useRequirements';

// ── Entry point ────────────────────────────────────────────────────────────────
export default function RequirementDetailScreen({ reqKey, projectId, onClose, onEdit, onImpact, onNavigate }:
  { reqKey: string; projectId: string; onClose: () => void; onEdit: (k:string) => void; onImpact: (k:string) => void; onNavigate: (k:string) => void }) {

  const r = BY_KEY[reqKey];
  const [tab, setTab] = useState<'overview'|'trace'|'verify'>('overview');
  const [activityOpen, setActivityOpen] = useState(true);

  // Hooks must run unconditionally (before the `if (!r) return` below) — with
  // the old static mock this branch was effectively dead code (BY_KEY never
  // lost an entry), so the violation never fired at runtime. With live data,
  // BY_KEY is rebuilt from scratch on every fetch/mutation, so `r` can
  // transiently be undefined (e.g. right after a delete). Depending on `r`
  // itself rather than `reqKey` also fixes a staleness bug: rebuilds create a
  // fresh object per requirement, so keying off the stable `reqKey` string
  // would have kept showing the AI score/acceptance criteria from before the
  // most recent edit.
  const ai = useMemo(() => (r ? analyzeQuality(r) : null), [r]);
  const criteria = useMemo(() => (r ? synthCriteria(r) : []), [r]);

  if (!r || !ai) return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', alignItems:'center', justifyContent:'center', gap:12 }}>
      <span style={{ fontSize:15, color:'hsl(var(--muted-foreground))' }}>Requirement not found: {reqKey}</span>
      <button onClick={onClose} style={{ padding:'6px 16px', borderRadius:8, border:'1px solid hsl(var(--border))', background:'hsl(var(--card))', cursor:'pointer', fontFamily:'inherit', color:'hsl(var(--foreground))' }}>Back</button>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'hsl(var(--background))' }}>
      {/* Top bar */}
      <div style={{ borderBottom:'1px solid hsl(var(--border))', background:'hsl(var(--card))', padding:'10px 16px 0', display:'flex', flexDirection:'column', gap:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:7, border:'1px solid hsl(var(--border))', background:'hsl(var(--card))', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .1s' }}
            onMouseEnter={e=>(e.currentTarget.style.background='hsl(var(--muted))')} onMouseLeave={e=>(e.currentTarget.style.background='hsl(var(--card))')}>
            <ArrowLeft size={16} color="hsl(var(--muted-foreground))"/>
          </button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <ReqKeyTag reqKey={r.key}/>
              <TypePill type={r.type}/>
              <PriorityPill priority={r.priority}/>
              {r.hasGap && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:9999, fontSize:10.5, fontWeight:600, background:softTint('#D97706',0.12), color:'#D97706', border:`1px solid ${softTint('#D97706',0.28)}` }}><AlertTriangle size={11} color="#D97706"/>Has gaps</span>}
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:'hsl(var(--foreground))', marginTop:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <TopBtn icon={GitPullRequest} label="Impact" tint="#D97706" onClick={() => onImpact(r.key)}/>
            <TopBtn icon={PenLine} label="Edit" tint="hsl(var(--foreground))" onClick={() => onEdit(r.key)} primary/>
          </div>
        </div>

        {/* Tabs (left) + Lifecycle stepper (right) in one row */}
        <div style={{ display:'flex', alignItems:'center', gap:0, marginTop:4 }}>

          {/* Tabs */}
          {([
            ['overview', 'Overview',     BookOpen,       null           ] as const,
            ['trace',    'Traceability', GitBranch,      r.links.length ] as const,
            ['verify',   'Verification', ClipboardCheck, null           ] as const,
          ]).map(([k, label, Ic, count]) => {
            const active = tab === k;
            return (
              <button key={k} onClick={() => setTab(k as typeof tab)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', border:'none',
                  borderBottom: active ? '2px solid #3B82F6' : '2px solid transparent',
                  background:'transparent', cursor:'pointer', fontFamily:'inherit',
                  fontSize:13, fontWeight: active ? 600 : 400,
                  color: active ? '#3B82F6' : 'hsl(var(--muted-foreground))',
                  transition:'color .1s', whiteSpace:'nowrap' }}>
                <Ic size={13} color={active ? '#3B82F6' : 'hsl(var(--muted-foreground))'}/>
                {label}
                {count != null && count > 0 && (
                  <span style={{ fontSize:11, fontWeight:600, color:'hsl(var(--muted-foreground))', background:'hsl(var(--muted))', borderRadius:9999, padding:'1px 6px', marginLeft:2 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ flex:1 }}/>

          {/* Lifecycle stepper */}
          <LifecycleStepper status={r.status}/>

          {/* Activity toggle */}
          <button onClick={() => setActivityOpen(p=>!p)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', border:'none', borderBottom:'2px solid transparent', background:'transparent', cursor:'pointer', color:'hsl(var(--muted-foreground))', fontFamily:'inherit', fontSize:12.5, marginLeft:8 }}>
            <MessageSquare size={13}/>{activityOpen ? 'Hide' : 'Activity'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          {tab === 'overview' && <OverviewTab r={r} ai={ai} criteria={criteria} onNavigate={onNavigate}/>}
          {tab === 'trace'    && <TraceTab    r={r} projectId={projectId} onNavigate={onNavigate}/>}
          {tab === 'verify'   && <VerifyTab   r={r}/>}
        </div>
        {activityOpen && <ActivityPanel reqKey={r.key}/>}
      </div>
    </div>
  );
}

function TopBtn({ icon:Ic, label, tint, onClick, primary }: { icon:React.ElementType; label:string; tint:string; onClick:()=>void; primary?:boolean }) {
  return (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:5, height:32, padding:'0 12px', borderRadius:7, border:`1px solid ${primary ? 'transparent' : softTint(tint,0.3)}`, background:primary?tint:softTint(tint,0.08), color:primary?'#fff':tint, cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}>
      <Ic size={13}/>{label}
    </button>
  );
}

// ── Lifecycle stepper ──────────────────────────────────────────────────────────
function LifecycleStepper({ status }: { status: ReqStatus }) {
  const cur = REQ_STATUS[status].step;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, padding:'0 8px', flexShrink:0 }}>
      {REQ_STATUS_FLOW.map((s, i) => {
        const m = REQ_STATUS[s];
        const done = cur > i;
        const active = cur === i;
        const future = cur < i;
        const col = future ? 'hsl(var(--border))' : m.tint;
        const labelCol = future ? 'hsl(var(--muted-foreground))' : m.tint;
        const lineCol = done ? m.tint : 'hsl(var(--border))';
        return (
          <React.Fragment key={s}>
            {i > 0 && (
              <div style={{ width:26, height:1.5, background:lineCol, flexShrink:0 }}/>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
              {/* Circle */}
              <div style={{
                width:20, height:20, borderRadius:9999, flexShrink:0,
                background: active ? col : 'transparent',
                border: `2px solid ${col}`,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                {(done || active) && <Check size={10} color={active ? '#fff' : col}/>}
                {future && <span style={{ width:5, height:5, borderRadius:9999, background:'hsl(var(--muted-foreground))', opacity:0.4 }}/>}
              </div>
              {/* Label */}
              <span style={{ fontSize:11.5, fontWeight: active ? 700 : 400, color:labelCol, whiteSpace:'nowrap' }}>
                {m.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ r, ai, criteria, onNavigate }:
  { r: Requirement; ai: ReturnType<typeof analyzeQuality>; criteria: ReturnType<typeof synthCriteria>; onNavigate:(k:string)=>void }) {

  const typeM = REQ_TYPE[r.type];

  return (
    <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
      {/* left column */}
      <div style={{ flex:'2 1 500px', minWidth:0, display:'flex', flexDirection:'column', gap:14 }}>
        {/* gap banner */}
        {r.hasGap && (
          <div style={{ padding:'10px 14px', borderRadius:10, border:`1px solid ${softTint('#D97706',0.35)}`, background:softTint('#D97706',0.06), display:'flex', alignItems:'flex-start', gap:10 }}>
            <AlertTriangle size={15} color="#D97706" style={{ flexShrink:0, marginTop:1 }}/>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#D97706', marginBottom:4 }}>Requirement gaps</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {r.coverage.orphan        && <GapBadge type="orphan"/>}
                {r.coverage.untested      && <GapBadge type="untested"/>}
                {r.coverage.unimplemented && <GapBadge type="unimplemented"/>}
                {r.coverage.suspect       && <GapBadge type="suspect"/>}
              </div>
            </div>
          </div>
        )}

        {/* Requirement statement */}
        <DetailCard title="Requirement statement" icon={BookOpen}>
          <p style={{ fontSize:14, color:'hsl(var(--foreground))', lineHeight:1.65, margin:0 }}>
            {highlightEARS(r.statement)}
          </p>
          {r.rationale && (
            <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid hsl(var(--border))', fontSize:12.5, color:'hsl(var(--muted-foreground))', lineHeight:1.55 }}>
              <span style={{ fontWeight:600, color:'hsl(var(--foreground))' }}>Rationale: </span>{r.rationale}
            </div>
          )}
          {r.target && (
            <div style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:8, background:softTint('#3B82F6',0.08), border:`1px solid ${softTint('#3B82F6',0.25)}` }}>
              <span style={{ fontSize:11.5, color:'hsl(var(--muted-foreground))' }}>Target:</span>
              <span style={{ fontSize:13.5, fontWeight:700, color:'#3B82F6' }}>{r.target.value}</span>
              {r.target.tolerance && <span style={{ fontSize:12, color:'hsl(var(--muted-foreground))' }}>{r.target.tolerance}</span>}
              <span style={{ fontSize:12.5, fontWeight:600, color:'hsl(var(--foreground))' }}>{r.target.unit}</span>
            </div>
          )}
        </DetailCard>

        {/* Attributes grid */}
        <DetailCard title="Attributes" icon={Activity}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:12 }}>
            <MetaField label="Type"><TypePill type={r.type}/></MetaField>
            <MetaField label="Category"><CatPill category={r.category}/></MetaField>
            <MetaField label="Priority"><PriorityPill priority={r.priority}/></MetaField>
            <MetaField label="Status"><StatusBadge status={r.status}/></MetaField>
            <MetaField label="V-Method"><span style={{ fontSize:12.5 }}>{r.vmethod}</span></MetaField>
            <MetaField label="V-Status"><VStatusBadge vstatus={r.vstatus}/></MetaField>
            <MetaField label="Owner"><div style={{ display:'flex', alignItems:'center', gap:6 }}><OwnerAvatar ownerId={r.owner} size={22}/><span style={{ fontSize:12.5 }}>{ownerOf(r.owner).name}</span></div></MetaField>
            <MetaField label="Version"><span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>{r.version}</span></MetaField>
            {r.standard && <MetaField label="Standard"><span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:'#3B82F6' }}>{r.standard}</span></MetaField>}
            {r.alloc?.length > 0 && <MetaField label="Allocated to"><span style={{ fontSize:12 }}>{r.alloc.join(', ')}</span></MetaField>}
          </div>
        </DetailCard>

        {/* Acceptance criteria */}
        <DetailCard title="Acceptance criteria" icon={ClipboardCheck} accent="#16A34A">
          {criteria.map((c, i) => (
            <div key={i} style={{ padding:'10px 12px', borderRadius:9, border:'1px solid hsl(var(--border))', background:'hsl(var(--muted))', marginBottom:i < criteria.length-1 ? 8 : 0 }}>
              <CritLine color="#0EA5E9" label="GIVEN" text={c.given}/>
              <CritLine color="#9333EA" label="WHEN"  text={c.when}/>
              <CritLine color="#16A34A" label="THEN"  text={c.then}/>
            </div>
          ))}
        </DetailCard>

        {/* Decomposition tree */}
        {r.childKeys.length > 0 && (
          <DetailCard title={`Child requirements (${r.childKeys.length})`} icon={GitBranch}>
            {r.childKeys.map(k => {
              const c = BY_KEY[k]; if (!c) return null;
              return (
                <div key={k} onClick={() => onNavigate(k)} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, border:'1px solid hsl(var(--border))', marginBottom:6, cursor:'pointer', transition:'background .1s' }}
                  onMouseEnter={e=>(e.currentTarget.style.background='hsl(var(--muted))')}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <ReqKeyTag reqKey={c.key}/>
                  <span style={{ flex:1, fontSize:13, color:'hsl(var(--foreground))', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</span>
                  <StatusBadge status={c.status}/>
                  <ChevronRight size={13} color="hsl(var(--muted-foreground))"/>
                </div>
              );
            })}
          </DetailCard>
        )}
      </div>

      {/* right column — AI quality panel */}
      <div style={{ flex:'1 1 260px', minWidth:0, display:'flex', flexDirection:'column', gap:14 }}>
        <AIQualityPanel ai={ai} req={r}/>
      </div>
    </div>
  );
}

function CritLine({ color, label, text }: { color:string; label:string; text:string }) {
  return (
    <div style={{ display:'flex', gap:8, marginBottom:4 }}>
      <span style={{ fontSize:10, fontWeight:800, color, width:38, flexShrink:0, paddingTop:2, letterSpacing:'0.04em' }}>{label}</span>
      <span style={{ fontSize:12.5, color:'hsl(var(--foreground))', lineHeight:1.45 }}>{text}</span>
    </div>
  );
}

function GapBadge({ type }: { type: keyof typeof GAP_META }) {
  const m = GAP_META[type];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:9999, fontSize:11, fontWeight:600, background:softTint(m.tint,0.12), color:m.tint, border:`1px solid ${softTint(m.tint,0.28)}` }}>
      <AlertTriangle size={11} color={m.tint}/>{m.label.split(' ')[0]}
    </span>
  );
}

// ── Trace tab ─────────────────────────────────────────────────────────────────
function TraceTab({ r, projectId, onNavigate }: { r: Requirement; projectId: string; onNavigate:(k:string)=>void }) {
  const upstream   = r.links.filter(l => REQ_LINKTYPE[l.type]?.dir === 'up');
  const downstream = r.links.filter(l => REQ_LINKTYPE[l.type]?.dir === 'down');
  const peer       = r.links.filter(l => REQ_LINKTYPE[l.type]?.dir === 'side');

  const [addOpen, setAddOpen] = useState(false);
  const createLink = useCreateRequirementLink(projectId);
  const deleteLink = useDeleteRequirementLink(projectId);

  const handleDelete = (linkId: string) => {
    deleteLink.mutate(linkId, {
      onSuccess: () => toast.success('Link removed'),
      onError: () => toast.error('Failed to remove link'),
    });
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={() => setAddOpen(true)} style={{ display:'inline-flex', alignItems:'center', gap:6, height:30, padding:'0 12px', borderRadius:7, border:'1px solid hsl(var(--border))', background:'hsl(var(--card))', color:'hsl(var(--foreground))', cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:500 }}>
          <Plus size={13}/>Add link
        </button>
      </div>
      {addOpen && (
        <AddLinkForm r={r} onClose={() => setAddOpen(false)}
          pending={createLink.isPending}
          onCreate={(toKey, linkType) => {
            const target = BY_KEY[toKey];
            if (!r._id || !target?._id) { toast.error('This requirement is still syncing — try again in a moment'); return; }
            createLink.mutate({ fromId: r._id, toId: target._id, linkType }, {
              onSuccess: () => { toast.success('Link created'); setAddOpen(false); },
              onError: () => toast.error('Failed to create link — it may already exist'),
            });
          }} />
      )}
      <LinkGroup title="Upstream" icon={ArrowUpRight} links={upstream} onNavigate={onNavigate} onDelete={handleDelete} tint="#9333EA"/>
      <LinkGroup title="Downstream" icon={ArrowDownRight} links={downstream} onNavigate={onNavigate} onDelete={handleDelete} tint="#2563EB"/>
      <LinkGroup title="Peer" icon={ArrowRightIcon} links={peer} onNavigate={onNavigate} onDelete={handleDelete} tint="#64748B"/>
    </div>
  );
}

function AddLinkForm({ r, onClose, onCreate, pending }: { r: Requirement; onClose: () => void; onCreate: (toKey: string, linkType: RequirementLinkType) => void; pending: boolean }) {
  const options = useMemo(() => REQS.filter(o => o.key !== r.key && o._id), [r.key]);
  const [toKey, setToKey] = useState(options[0]?.key ?? '');
  const [linkType, setLinkType] = useState<RequirementLinkType>('depends_on');

  const selStyle: React.CSSProperties = { flex:1, height:32, borderRadius:7, border:'1px solid hsl(var(--border))', background:'hsl(var(--background))', color:'hsl(var(--foreground))', fontFamily:'inherit', fontSize:12.5, padding:'0 8px' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, padding:14, borderRadius:10, border:'1px solid hsl(var(--border))', background:'hsl(var(--muted)/0.4)' }}>
      <div style={{ display:'flex', gap:8 }}>
        <select value={linkType} onChange={e => setLinkType(e.target.value as RequirementLinkType)} style={{ ...selStyle, flex:'0 0 160px' }}>
          <option value="derives_from">Derives from</option>
          <option value="depends_on">Depends on</option>
          <option value="conflicts_with">Conflicts with</option>
        </select>
        <select value={toKey} onChange={e => setToKey(e.target.value)} style={selStyle}>
          {options.length === 0 && <option value="">No other requirements yet</option>}
          {options.map(o => <option key={o.key} value={o.key}>{o.key} — {o.title}</option>)}
        </select>
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onClose} style={{ height:30, padding:'0 12px', borderRadius:7, border:'1px solid hsl(var(--border))', background:'hsl(var(--card))', color:'hsl(var(--foreground))', cursor:'pointer', fontFamily:'inherit', fontSize:12.5 }}>Cancel</button>
        <button onClick={() => toKey && onCreate(toKey, linkType)} disabled={!toKey || pending}
          style={{ height:30, padding:'0 12px', borderRadius:7, border:'none', background: !toKey || pending ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))', color:'hsl(var(--primary-foreground))', cursor: !toKey || pending ? 'default' : 'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}>
          {pending ? 'Linking…' : 'Create link'}
        </button>
      </div>
    </div>
  );
}

function LinkGroup({ title, icon:Ic, links, onNavigate, onDelete, tint }: { title:string; icon:React.ElementType; links:Requirement['links']; onNavigate:(k:string)=>void; onDelete:(linkId:string)=>void; tint:string }) {
  if (!links.length) return null;
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ width:26, height:26, borderRadius:7, background:softTint(tint,0.12), display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
          <Ic size={13} color={tint}/>
        </span>
        <span style={{ fontSize:13.5, fontWeight:600, color:'hsl(var(--foreground))' }}>{title}</span>
        <span style={{ fontSize:12, color:'hsl(var(--muted-foreground))' }}>{links.length}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {links.map((l,i) => {
          const target = BY_KEY[l.target];
          const isSuspect = l.status === 'suspect';
          return (
            <div key={i} onClick={() => { if (target && !l.external) onNavigate(l.target); }}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, border:`1px solid ${isSuspect ? softTint('#DC2626',0.35) : 'hsl(var(--border))'}`, background: isSuspect ? softTint('#DC2626',0.04) : 'hsl(var(--card))', cursor: target && !l.external ? 'pointer' : 'default', transition:'background .1s' }}
              onMouseEnter={e=>{ if(target&&!l.external) e.currentTarget.style.background='hsl(var(--muted))'; }}
              onMouseLeave={e=>{ e.currentTarget.style.background=isSuspect?softTint('#DC2626',0.04):'hsl(var(--card))'; }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11.5, fontWeight:600, color: l.kind==='part'?'#D97706':l.kind==='test'?'#9333EA':'#3B82F6', width:90, flexShrink:0 }}>{l.target}</span>
              <span style={{ color:'hsl(var(--muted-foreground))', flex:'0 0 100px', fontSize:11, fontWeight:500 }}>{REQ_LINKTYPE[l.type]?.label ?? l.type}</span>
              <span style={{ flex:1, fontSize:12.5, color:'hsl(var(--foreground))', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{target ? target.title : l.kind==='part' ? 'BOM part / assembly' : l.kind==='test' ? 'Test case' : 'External source'}</span>
              {isSuspect && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10.5, fontWeight:700, color:'#DC2626', flexShrink:0 }}><AlertTriangle size={11} color="#DC2626"/>suspect</span>}
              {l._linkId && (
                <button onClick={e => { e.stopPropagation(); onDelete(l._linkId!); }}
                  style={{ width:22, height:22, borderRadius:6, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
                  onMouseEnter={e=>(e.currentTarget.style.background='hsl(var(--destructive)/0.12)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <X size={12} color="hsl(var(--muted-foreground))"/>
                </button>
              )}
              {target && !l.external && <ChevronRight size={13} color="hsl(var(--muted-foreground))"/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Verification tab ──────────────────────────────────────────────────────────
function VerifyTab({ r }: { r: Requirement }) {
  const testLinks = r.links.filter(l => l.kind === 'test');
  const vm = r.vmethod;
  const vs = REQ_VSTATUS[r.vstatus];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* stat cards */}
      <div style={{ display:'flex', gap:12 }}>
        <VStatCard label="Method" value={vm} tint="#3B82F6"/>
        <VStatCard label="Status" value={vs.label} tint={vs.tint}/>
        <VStatCard label="Test cases" value={String(testLinks.length)} tint="#9333EA"/>
      </div>

      {/* test case table */}
      {testLinks.length > 0 ? (
        <div style={{ background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid hsl(var(--border))', fontSize:13.5, fontWeight:600, color:'hsl(var(--foreground))' }}>Test cases</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead>
              <tr style={{ background:'hsl(var(--muted))' }}>
                {['Test ID','Type','Result','Notes'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'hsl(var(--muted-foreground))', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {testLinks.map((l,i) => (
                <tr key={i} style={{ borderBottom:'1px solid hsl(var(--border))' }}>
                  <td style={{ padding:'9px 12px', fontFamily:"'JetBrains Mono',monospace", color:'#9333EA', fontWeight:600 }}>{l.target}</td>
                  <td style={{ padding:'9px 12px', color:'hsl(var(--foreground))' }}>{l.type}</td>
                  <td style={{ padding:'9px 12px' }}>{l.result ? <VStatusBadge vstatus={l.result}/> : <span style={{ color:'hsl(var(--muted-foreground))' }}>—</span>}</td>
                  <td style={{ padding:'9px 12px', color:'hsl(var(--muted-foreground))' }}>{l.status === 'suspect' ? <span style={{ color:'#DC2626', fontWeight:600 }}>Re-verification required</span> : 'Current'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding:32, textAlign:'center', color:'hsl(var(--muted-foreground))', fontSize:13 }}>
          <FlaskConical size={32} style={{ marginBottom:8 }}/>
          <div>No test cases linked yet.</div>
        </div>
      )}
    </div>
  );
}

function VStatCard({ label, value, tint }: { label:string; value:string; tint:string }) {
  return (
    <div style={{ flex:1, padding:'14px 16px', borderRadius:12, border:'1px solid hsl(var(--border))', background:'hsl(var(--card))' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'hsl(var(--muted-foreground))', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:17, fontWeight:700, color:tint, textTransform:'capitalize' }}>{value}</div>
    </div>
  );
}

// ── AI quality panel ──────────────────────────────────────────────────────────
function AIQualityPanel({ ai, req }: { ai: ReturnType<typeof analyzeQuality>; req: Requirement }) {
  return (
    <div style={{ background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius:12, overflow:'hidden' }}>
      <div style={{ padding:'12px 14px', borderBottom:'1px solid hsl(var(--border))', display:'flex', alignItems:'center', gap:8 }}>
        <Sparkles size={14} color="#3B82F6"/>
        <span style={{ fontSize:13.5, fontWeight:600, color:'hsl(var(--foreground))' }}>AI quality score</span>
      </div>
      <div style={{ padding:14 }}>
        {/* score ring */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
          <ScoreRing pct={ai.pct} tint={ai.tint} grade={ai.grade} size={72}/>
          <div>
            <div style={{ fontSize:22, fontWeight:800, color:ai.tint, lineHeight:1 }}>{ai.pct}%</div>
            <div style={{ fontSize:11.5, color:'hsl(var(--muted-foreground))', marginTop:4 }}>quality score</div>
          </div>
        </div>

        {/* checks */}
        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
          {ai.checks.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'flex-start', gap:7 }}>
              <span style={{ width:16, height:16, borderRadius:9999, flexShrink:0, marginTop:1, background: c.pass?softTint('#16A34A',0.15):softTint('#DC2626',0.15), display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                {c.pass ? <Check size={9} color="#16A34A"/> : <X size={9} color="#DC2626"/>}
              </span>
              <div>
                <div style={{ fontSize:11.5, fontWeight:600, color:'hsl(var(--foreground))' }}>{c.label}</div>
                <div style={{ fontSize:11, color:'hsl(var(--muted-foreground))', lineHeight:1.35 }}>{c.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* suggestions */}
        {ai.suggestions.length > 0 && (
          <div style={{ borderTop:'1px solid hsl(var(--border))', paddingTop:12 }}>
            <div style={{ fontSize:11.5, fontWeight:700, color:'hsl(var(--foreground))', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.04em' }}>Suggestions</div>
            {ai.suggestions.map((s, i) => (
              <div key={i} style={{ display:'flex', gap:8, padding:'7px 10px', borderRadius:8, background:'hsl(var(--muted))', marginBottom:6 }}>
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4, background:softTint('#3B82F6',0.12), color:'#3B82F6', flexShrink:0 }}>{s.kind}</span>
                <span style={{ fontSize:11.5, color:'hsl(var(--foreground))', lineHeight:1.4 }}>{s.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Activity panel ─────────────────────────────────────────────────────────────
const MOCK_ACTIVITY = [
  { actor:'SA', color:'#7C3AED', action:'approved this requirement', ago:'2h ago' },
  { actor:'ML', color:'#2563EB', action:'changed priority to High', ago:'1d ago' },
  { actor:'KA', color:'#059669', action:'linked test case TC-SYS-001', ago:'2d ago' },
  { actor:'JP', color:'#D97706', action:'added rationale', ago:'3d ago' },
  { actor:'SA', color:'#7C3AED', action:'created this requirement', ago:'5d ago' },
];

function ActivityPanel({ reqKey }: { reqKey:string }) {
  const [comment, setComment] = useState('');

  return (
    <div style={{ width:300, flexShrink:0, borderLeft:'1px solid hsl(var(--border))', background:'hsl(var(--card))', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 14px', borderBottom:'1px solid hsl(var(--border))', fontSize:13.5, fontWeight:600, color:'hsl(var(--foreground))' }}>Activity</div>
      <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
        {MOCK_ACTIVITY.map((a,i) => (
          <div key={i} style={{ display:'flex', gap:9, marginBottom:14 }}>
            <span style={{ width:26, height:26, borderRadius:9999, flexShrink:0, background:softTint(a.color,0.18), color:a.color, fontSize:9.5, fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center', border:`1px solid ${softTint(a.color,0.3)}` }}>{a.actor}</span>
            <div>
              <span style={{ fontSize:12.5, color:'hsl(var(--foreground))' }}>{a.action}</span>
              <div style={{ fontSize:11, color:'hsl(var(--muted-foreground))', marginTop:2 }}>{a.ago}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding:'10px 12px', borderTop:'1px solid hsl(var(--border))' }}>
        <div style={{ display:'flex', gap:7 }}>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Leave a comment…" rows={2}
            style={{ flex:1, resize:'none', borderRadius:7, border:'1px solid hsl(var(--border))', background:'hsl(var(--background))', color:'hsl(var(--foreground))', padding:'7px 9px', fontSize:12.5, fontFamily:'inherit', outline:'none', lineHeight:1.45 }}/>
          <button onClick={() => setComment('')} style={{ alignSelf:'flex-end', width:30, height:30, borderRadius:7, border:'none', background:'hsl(var(--foreground))', color:'hsl(var(--background))', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Send size={13}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function DetailCard({ title, icon:Ic, accent, children }: { title:string; icon:React.ElementType; accent?:string; children:React.ReactNode }) {
  return (
    <div style={{ background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius:12, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'12px 16px', borderBottom:'1px solid hsl(var(--border))' }}>
        <Ic size={14} color={accent ?? 'hsl(var(--muted-foreground))'}/>
        <span style={{ fontSize:13.5, fontWeight:600, color:'hsl(var(--foreground))' }}>{title}</span>
      </div>
      <div style={{ padding:16 }}>{children}</div>
    </div>
  );
}

function MetaField({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize:10.5, fontWeight:700, color:'hsl(var(--muted-foreground))', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function highlightEARS(text: string): React.ReactNode {
  const parts = text.split(/(\bWhile\b|\bWhen\b|\bIf\b|\bWhere\b|\bthen\b|\bshall\b)/g);
  return parts.map((p, i) => {
    const low = p.toLowerCase();
    if (['while','when','if','where','then'].includes(low)) return <strong key={i} style={{ color:'#2563EB', fontWeight:700 }}>{p}</strong>;
    if (low === 'shall') return <strong key={i} style={{ color:'#9333EA', fontWeight:700 }}>{p}</strong>;
    return <span key={i}>{p}</span>;
  });
}
