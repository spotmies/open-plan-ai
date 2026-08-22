import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, Sparkles, Check, X, Zap, Activity, ToggleRight, ShieldAlert,
  GitBranch, PenLine, Infinity as InfinityIcon, ChevronDown, ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import {
  BY_KEY, REQ_TYPE, REQ_CATEGORY, REQ_STATUS, REQ_VSTATUS, REQ_PRIORITY,
  REQ_GROUP, REQ_TEAM, EARS, analyzeQuality, ownerOf,
  type ReqType, type ReqCategory, type ReqStatus, type ReqVStatus, type ReqPriority, type ReqGroup,
  type EARSPattern,
} from './requirementsData';
import { ScoreRing, softTint } from './RequirementsShared';

interface FormState {
  pattern: string; subject: string; response: string; trigger: string;
  state: string; feature: string; condition: string; free: string;
  type: ReqType; category: ReqCategory; priority: ReqPriority; status: ReqStatus;
  vmethod: string; owner: string; rationale: string;
  targetValue: string; targetTolerance: string; targetUnit: string;
}

const defaultForm = (): FormState => ({
  pattern:'ubiquitous', subject:'system', response:'', trigger:'', state:'', feature:'', condition:'', free:'',
  type:'system-req', category:'functional', priority:'medium', status:'draft', vmethod:'test',
  owner: REQ_TEAM[0].id, rationale:'', targetValue:'', targetTolerance:'', targetUnit:'',
});

const PATTERN_ICONS: Record<string, React.ElementType> = {
  ubiquitous: InfinityIcon, event: Zap, state: Activity, optional: ToggleRight, unwanted: ShieldAlert, complex: GitBranch, free: PenLine,
};

const REWRITE: Record<string, string> = {
  quickly:'within the specified time', fast:'within the specified time', meaningful:'the specified amount of',
  practical:'specified', minimal:'no more than the specified', 'user-friendly':'compliant with the HMI spec',
  easy:'per the HMI spec', efficient:'at the specified efficiency', robust:'per the reliability spec',
  flexible:'configurable', 'as needed':'per the configured schedule', sufficient:'the specified',
  adequate:'the specified', reasonable:'the specified', optimal:'the specified', seamless:'uninterrupted',
  intuitive:'per the HMI spec', support:'provide', handle:'process',
};

function rewriteWeak(text: string): string {
  let out = text;
  Object.keys(REWRITE).forEach(w => { out = out.replace(new RegExp('\\b'+w.replace('/','\\/')+'\\b','gi'), REWRITE[w]); });
  return out.replace(/\s{2,}/g,' ').trim();
}

function previewStatement(form: FormState): string {
  const p = EARS[form.pattern];
  if (!p) return '';
  const fields: Record<string,string> = { subject:form.subject||'system', response:form.response, trigger:form.trigger, state:form.state, feature:form.feature, condition:form.condition, free:form.free };
  return p.tpl(fields);
}

function highlightEARS(text: string): React.ReactNode {
  const parts = text.split(/(\bWhile\b|\bWhen\b|\bIf\b|\bWhere\b|\bthen\b|\bshall\b)/g);
  return parts.map((p, i) => {
    const low = p.toLowerCase();
    if (['while','when','if','where','then'].includes(low)) return <strong key={i} style={{ color:'#2563EB' }}>{p}</strong>;
    if (low === 'shall') return <strong key={i} style={{ color:'#9333EA' }}>{p}</strong>;
    return <span key={i}>{p}</span>;
  });
}

// ── Editor entry point ────────────────────────────────────────────────────────
export default function RequirementEditor({ reqKey, onClose, onSaved }:
  { reqKey: string|null; onClose: () => void; onSaved: () => void }) {

  const existing = reqKey ? BY_KEY[reqKey] : null;
  const [form, setForm] = useState<FormState>(() => {
    if (!existing) return defaultForm();
    return {
      pattern:'free', subject:'system', response:'', trigger:'', state:'', feature:'', condition:'',
      free: existing.statement,
      type: existing.type, category: existing.category, priority: existing.priority,
      status: existing.status, vmethod: existing.vmethod, owner: existing.owner,
      rationale: existing.rationale,
      targetValue: existing.target?.value.toString() ?? '',
      targetTolerance: existing.target?.tolerance ?? '',
      targetUnit: existing.target?.unit ?? '',
    };
  });

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));
  const preview = previewStatement(form);
  const ai = useMemo(() => analyzeQuality({ statement:preview, type:form.type, category:form.category, vmethod:form.vmethod as any, vstatus:'not-verified', rationale:form.rationale, parent:null, source:'' }), [preview, form.type, form.category, form.vmethod, form.rationale]);

  const pat = EARS[form.pattern];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'hsl(var(--background))' }}>
      {/* header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderBottom:'1px solid hsl(var(--border))', background:'hsl(var(--card))' }}>
        <button onClick={onClose} style={{ width:30, height:30, borderRadius:7, border:'1px solid hsl(var(--border))', background:'hsl(var(--card))', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
          onMouseEnter={e=>(e.currentTarget.style.background='hsl(var(--muted))')} onMouseLeave={e=>(e.currentTarget.style.background='hsl(var(--card))')}>
          <ArrowLeft size={16} color="hsl(var(--muted-foreground))"/>
        </button>
        <span style={{ fontSize:16, fontWeight:700, color:'hsl(var(--foreground))' }}>{existing ? `Edit ${existing.key}` : 'New Requirement'}</span>
        <div style={{ flex:1 }}/>
        <button onClick={onSaved} style={{ display:'flex', alignItems:'center', gap:6, height:34, padding:'0 16px', borderRadius:8, border:'none', background:'hsl(var(--foreground))', color:'hsl(var(--background))', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
          <Check size={14}/> {existing ? 'Save changes' : 'Create'}
        </button>
      </div>

      {/* body */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* main form */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          <div style={{ maxWidth:700 }}>

            {/* 1. EARS pattern */}
            <EditorCard num="1" title="EARS pattern" icon={GitBranch}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                {Object.keys(EARS).map(k => {
                  const p = EARS[k]; const Ic = PATTERN_ICONS[k] ?? PenLine; const active = form.pattern === k;
                  return (
                    <button key={k} onClick={() => upd('pattern', k)} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:9999, border:`1px solid ${active?'hsl(var(--foreground))':'hsl(var(--border))'}`, background: active?'hsl(var(--muted))':'hsl(var(--card))', color:'hsl(var(--foreground))', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:active?700:400 }}>
                      <Ic size={12}/>{p.label}
                    </button>
                  );
                })}
              </div>
              {pat && (
                <div style={{ padding:'8px 12px', borderRadius:8, background:'hsl(var(--muted))', fontSize:12.5, color:'hsl(var(--muted-foreground))' }}>
                  <span style={{ fontWeight:600, color:'hsl(var(--foreground))' }}>{pat.label}</span> — {pat.desc}
                </div>
              )}
            </EditorCard>

            {/* 2. Statement fields */}
            <EditorCard num="2" title="Statement fields" icon={PenLine}>
              <Field label="Subject" required hint="The entity that shall do something">
                <EdInput value={form.subject} onChange={v => upd('subject',v)} placeholder="e.g. charging station"/>
              </Field>
              {pat?.fields.map(([name, label, placeholder]) => (
                <Field key={name} label={label}>
                  <EdInput value={form[name as keyof FormState] as string} onChange={v => upd(name as keyof FormState, v)} placeholder={placeholder}/>
                </Field>
              ))}
              {form.pattern !== 'free' && (
                <Field label="Response" required hint="What shall happen">
                  <EdTextarea value={form.response} onChange={v => upd('response',v)} placeholder="provide DC output at the rated power…" rows={2}/>
                </Field>
              )}

              {/* preview */}
              <div style={{ marginTop:12, padding:'10px 14px', borderRadius:9, border:'1px solid hsl(var(--border))', background:'hsl(var(--muted))' }}>
                <div style={{ fontSize:10.5, fontWeight:700, color:'hsl(var(--muted-foreground))', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Live preview</div>
                <p style={{ fontSize:13.5, color:'hsl(var(--foreground))', lineHeight:1.65, margin:0 }}>{highlightEARS(preview || '…')}</p>
                {preview && (
                  <button onClick={() => { const rw = rewriteWeak(form.free || preview); upd('free', rw); if (form.pattern !== 'free') upd('pattern','free'); }}
                    style={{ marginTop:8, fontSize:11.5, color:'#3B82F6', border:'none', background:'transparent', cursor:'pointer', textDecoration:'underline', padding:0, fontFamily:'inherit' }}>
                    ✨ Auto-clarify ambiguous terms
                  </button>
                )}
              </div>
            </EditorCard>

            {/* 3. Target */}
            <EditorCard num="3" title="Quantitative target (optional)" icon={Activity}>
              <div style={{ display:'flex', gap:10 }}>
                <Field label="Value" hint="numeric"><EdInput value={form.targetValue} onChange={v => upd('targetValue',v)} placeholder="150"/></Field>
                <Field label="Tolerance"><EdInput value={form.targetTolerance} onChange={v => upd('targetTolerance',v)} placeholder="±2 or max or min"/></Field>
                <Field label="Unit"><EdInput value={form.targetUnit} onChange={v => upd('targetUnit',v)} placeholder="kW"/></Field>
              </div>
            </EditorCard>

            {/* 4. Metadata */}
            <EditorCard num="4" title="Metadata" icon={Activity}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Field label="Type">
                  <EdSelect value={form.type} onChange={v => upd('type', v as ReqType)} options={Object.keys(REQ_TYPE).map(k => ({ value:k, label:REQ_TYPE[k as ReqType].label }))}/>
                </Field>
                <Field label="Category">
                  <EdSelect value={form.category} onChange={v => upd('category', v as ReqCategory)} options={Object.keys(REQ_CATEGORY).map(k => ({ value:k, label:REQ_CATEGORY[k as ReqCategory].label }))}/>
                </Field>
                <Field label="Priority">
                  <EdSelect value={form.priority} onChange={v => upd('priority', v as ReqPriority)} options={Object.keys(REQ_PRIORITY).map(k => ({ value:k, label:REQ_PRIORITY[k as ReqPriority].label }))}/>
                </Field>
                <Field label="Status">
                  <EdSelect value={form.status} onChange={v => upd('status', v as ReqStatus)} options={Object.keys(REQ_STATUS).filter(k => k!=='obsolete').map(k => ({ value:k, label:REQ_STATUS[k as ReqStatus].label }))}/>
                </Field>
                <Field label="Verification method">
                  <EdSelect value={form.vmethod} onChange={v => upd('vmethod', v)} options={[{value:'test',label:'Test'},{value:'analysis',label:'Analysis'},{value:'inspection',label:'Inspection'},{value:'demonstration',label:'Demonstration'}]}/>
                </Field>
                <Field label="Owner">
                  <EdSelect value={form.owner} onChange={v => upd('owner', v)} options={REQ_TEAM.map(m => ({ value:m.id, label:m.name }))}/>
                </Field>
              </div>
              <div style={{ marginTop:12 }}>
                <Field label="Rationale" hint="Why does this requirement exist?">
                  <EdTextarea value={form.rationale} onChange={v => upd('rationale',v)} placeholder="Explain the design intent and source of this requirement…" rows={3}/>
                </Field>
              </div>
            </EditorCard>

          </div>
        </div>

        {/* live AI quality panel */}
        <div style={{ width:300, flexShrink:0, borderLeft:'1px solid hsl(var(--border))', background:'hsl(var(--card))', overflowY:'auto', padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:14 }}>
            <Sparkles size={14} color="#3B82F6"/>
            <span style={{ fontSize:13.5, fontWeight:600, color:'hsl(var(--foreground))' }}>Live AI quality</span>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16, padding:'12px 14px', borderRadius:10, border:`1px solid ${softTint(ai.tint,0.3)}`, background:softTint(ai.tint,0.05) }}>
            <ScoreRing pct={ai.pct} tint={ai.tint} grade={ai.grade} size={64}/>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:ai.tint, lineHeight:1 }}>{ai.pct}%</div>
              <div style={{ fontSize:11, color:'hsl(var(--muted-foreground))', marginTop:3 }}>quality score</div>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
            {ai.checks.map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'flex-start', gap:7 }}>
                <span style={{ width:15, height:15, borderRadius:9999, flexShrink:0, marginTop:1, background: c.pass?softTint('#16A34A',0.15):softTint('#DC2626',0.15), display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                  {c.pass ? <Check size={9} color="#16A34A"/> : <X size={9} color="#DC2626"/>}
                </span>
                <div>
                  <div style={{ fontSize:11.5, fontWeight:600, color:'hsl(var(--foreground))' }}>{c.label}</div>
                  <div style={{ fontSize:10.5, color:'hsl(var(--muted-foreground))', lineHeight:1.35 }}>{c.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {ai.suggestions.length > 0 && (
            <div style={{ borderTop:'1px solid hsl(var(--border))', paddingTop:12 }}>
              <div style={{ fontSize:11.5, fontWeight:700, color:'hsl(var(--foreground))', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.04em' }}>Suggestions</div>
              {ai.suggestions.map((s, i) => (
                <div key={i} style={{ display:'flex', gap:7, padding:'6px 9px', borderRadius:8, background:'hsl(var(--muted))', marginBottom:5 }}>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 5px', borderRadius:4, background:softTint('#3B82F6',0.12), color:'#3B82F6', flexShrink:0 }}>{s.kind}</span>
                  <span style={{ fontSize:11, color:'hsl(var(--foreground))', lineHeight:1.4 }}>{s.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Form primitives ───────────────────────────────────────────────────────────
function EditorCard({ num, title, icon:Ic, children }: { num:string; title:string; icon:React.ElementType; children:React.ReactNode }) {
  return (
    <div style={{ background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius:12, overflow:'hidden', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderBottom:'1px solid hsl(var(--border))' }}>
        <span style={{ width:22, height:22, borderRadius:9999, flexShrink:0, background:softTint('#3B82F6',0.12), color:'#3B82F6', fontSize:11.5, fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>{num}</span>
        <Ic size={14} color="hsl(var(--muted-foreground))"/>
        <span style={{ fontSize:14, fontWeight:600, color:'hsl(var(--foreground))' }}>{title}</span>
      </div>
      <div style={{ padding:16 }}>{children}</div>
    </div>
  );
}

function Field({ label, hint, required, children }: { label:string; hint?:string; required?:boolean; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:5 }}>
        <label style={{ fontSize:12, fontWeight:600, color:'hsl(var(--muted-foreground))' }}>{label}</label>
        {required && <span style={{ fontSize:11, color:'#DC2626' }}>*</span>}
        {hint && <span style={{ fontSize:11, color:'hsl(var(--muted-foreground))' }}>· {hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputBase: React.CSSProperties = { width:'100%', boxSizing:'border-box', background:'hsl(var(--background))', border:'1px solid hsl(var(--border))', borderRadius:8, padding:'8px 10px', fontSize:13, color:'hsl(var(--foreground))', outline:'none', fontFamily:'inherit' };

function EdInput({ value, onChange, placeholder, mono }: { value:string; onChange:(v:string)=>void; placeholder?:string; mono?:boolean }) {
  const [f, setF] = useState(false);
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...inputBase, fontFamily: mono?"'JetBrains Mono',monospace":'inherit', borderColor:f?'hsl(var(--foreground))':'hsl(var(--border))', boxShadow:f?'0 0 0 3px hsl(var(--border))':`none`, transition:'border-color .12s, box-shadow .12s' }}/>
  );
}

function EdTextarea({ value, onChange, placeholder, rows=3 }: { value:string; onChange:(v:string)=>void; placeholder?:string; rows?:number }) {
  const [f, setF] = useState(false);
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...inputBase, resize:'vertical', lineHeight:1.55, borderColor:f?'hsl(var(--foreground))':'hsl(var(--border))', boxShadow:f?'0 0 0 3px hsl(var(--border))':`none`, transition:'border-color .12s, box-shadow .12s' }}/>
  );
}

function EdSelect({ value, onChange, options }: { value:string; onChange:(v:string)=>void; options:{value:string;label:string}[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ ...inputBase, cursor:'pointer' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
