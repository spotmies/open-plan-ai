import { useState, useMemo, useEffect } from 'react';
import {
  GitMerge, X, AlertCircle, ChevronDown, ChevronRight, ChevronLeft, Check, CheckCircle, Clock, Plus,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  ECOType, ECOReason, ECOPriority, ImpactLevel, ChangeLabel, ImpactArea,
  ECO_TYPE_LABEL, REASON_LABEL, PRIORITY_LABEL, IMPACT_LABEL,
  IMPACT_AREA_OPTIONS, IMPACT_AREA_LABEL,
  PipelineStep, PIPELINE_STAGE_DEFS,
} from './ecoData';
import { ECOAvatar } from './ECOShared';
import { useCreateECO } from '@/hooks/useECOs';
import { useProjectMembers } from '@/hooks/useProjectTeam';
import { BOMNode, BOMStatus, getCategoryMeta, UOM_OPTIONS } from './bomData';
import { toast } from 'sonner';

// ── Local helpers ─────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-muted/40 border border-border rounded-md text-foreground text-[13px] px-3 py-2 outline-none focus:border-primary/40 placeholder:text-muted-foreground/50 font-[inherit]';

function FL({ label, required, children, className }: {
  label: string; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function FInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input {...props} className={cn('h-8 text-sm bg-muted border-border focus-visible:ring-1', props.className)} />
  );
}

function FSelect<T extends string>({
  value, onChange, options, labels,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  labels: Record<string, string>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="w-full bg-muted/40 border border-border rounded-md text-foreground text-[13px] pl-3 pr-8 py-2 outline-none focus:border-primary/40 cursor-pointer appearance-none font-[inherit]"
      >
        {options.map(o => (
          <option key={o} value={o} className="bg-card">{labels[o] ?? o}</option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
    </div>
  );
}

const TABS = ['part', 'impact', 'reason', 'approval'] as const;
type TabId = typeof TABS[number];
const TAB_LABEL: Record<TabId, string> = {
  part: 'Part Details', impact: 'Impact', reason: 'Reason', approval: 'Approval',
};

// ── Pipeline step with justification ─────────────────────────────────────────

interface PipelineStepLocal extends PipelineStep {
  justification: string;
  isCustom?: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

export function BOMECOSheet({
  open,
  onClose,
  node,
  projectId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  node: BOMNode;
  projectId: string;
  onCreated?: (ecoId: string) => void;
}) {
  const createMutation = useCreateECO(projectId);
  const meta = getCategoryMeta(node.cat);

  const [activeTab, setActiveTab] = useState<TabId>('part');
  const [maxTabReached, setMaxTabReached] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Part Details editable state (pre-filled from node) ──
  const [partName, setPartName] = useState(node.name ?? '');
  const [desc, setDesc] = useState(node.desc ?? '');
  const [status, setStatus] = useState<BOMStatus>(node.status ?? 'pending');
  const [mpn, setMpn] = useState(node.mpn ?? '');
  const [manufacturer, setManufacturer] = useState(node.manufacturer ?? '');
  const [distributor, setDistributor] = useState(node.distributor ?? '');
  const [price, setPrice] = useState(node.price != null ? String(node.price) : '');
  const [leadTime, setLeadTime] = useState(node.leadTime != null ? String(node.leadTime) : '');
  const [qty, setQty] = useState(node.qty != null ? String(node.qty) : '');
  const [uom, setUom] = useState(node.uom ?? 'EA');

  // ── ECO meta state ──
  const [ecoTitle, setEcoTitle] = useState('');
  const [revFrom, setRevFrom] = useState(node.rev ?? 'A');
  const [revTo, setRevTo] = useState('');

  // Resync editable state whenever the sheet is (re)opened for a node — the
  // component stays mounted between opens, so without this, fields silently
  // retain values from whichever part was last edited instead of the current one.
  useEffect(() => {
    if (!open) return;
    setPartName(node.name ?? '');
    setDesc(node.desc ?? '');
    setStatus(node.status ?? 'pending');
    setMpn(node.mpn ?? '');
    setManufacturer(node.manufacturer ?? '');
    setDistributor(node.distributor ?? '');
    setPrice(node.price != null ? String(node.price) : '');
    setLeadTime(node.leadTime != null ? String(node.leadTime) : '');
    setQty(node.qty != null ? String(node.qty) : '');
    setUom(node.uom ?? 'EA');
    setEcoTitle('');
    setRevFrom(node.rev ?? 'A');
    setRevTo('');
    setErrors({});
    setActiveTab('part');
    setMaxTabReached(0);
  }, [open, node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Impact tab state ──
  const [impactArea, setImpactArea] = useState<ImpactArea>('schedule');
  const [impactAreaOther, setImpactAreaOther] = useState('');
  const [impactLevel, setImpactLevel] = useState<ImpactLevel>('MEDIUM');
  const [impactDesc, setImpactDesc] = useState('');

  // ── Reason tab state ──
  const [changeType, setChangeType] = useState<ECOType>('DESIGN_CHANGE');
  const [changeTypeOther, setChangeTypeOther] = useState('');
  const [reasonCode, setReasonCode] = useState<ECOReason>('PERFORMANCE');
  const [reasonCodeOther, setReasonCodeOther] = useState('');
  const [priority, setPriority] = useState<ECOPriority>('MEDIUM');
  const [reasonDesc, setReasonDesc] = useState('');

  // ── Approval tab state (approvers are real project members, picked by the user) ──
  const { data: projectMembers = [] } = useProjectMembers(projectId);

  const defaultOrder = useMemo(() => {
    const m: Record<string, number> = {};
    PIPELINE_STAGE_DEFS.forEach((s, i) => { m[s.stage] = i; });
    return m;
  }, []);

  const [pipeline, setPipeline] = useState<PipelineStepLocal[]>(
    PIPELINE_STAGE_DEFS.map(s => ({ ...s, justification: s.optionalReason ?? '' })),
  );

  // Compute which BOM fields changed from the original node values
  const changedFields = useMemo(() => {
    const rows: { param: string; from: string; to: string; label: ChangeLabel }[] = [];
    const check = (param: string, orig: string, cur: string) => {
      if (orig !== cur) {
        const fromN = parseFloat(orig), toN = parseFloat(cur);
        const label: ChangeLabel =
          !isNaN(fromN) && !isNaN(toN)
            ? toN > fromN ? 'INCREASED' : 'DECREASED'
            : 'MODIFIED';
        rows.push({ param, from: orig || '—', to: cur || '—', label });
      }
    };
    check('Part Name',      node.name ?? '',                                    partName);
    check('Description',   node.desc ?? '',                                    desc);
    check('Manufacturer',  node.manufacturer ?? '',                            manufacturer);
    check('MPN',            node.mpn ?? '',                                     mpn);
    check('Distributor',    node.distributor ?? '',                             distributor);
    check('Unit Price',     node.price != null ? String(node.price) : '',       price);
    check('Lead Time (days)', node.leadTime != null ? String(node.leadTime) : '', leadTime);
    check('Quantity',       node.qty != null ? String(node.qty) : '',           qty);
    check('Unit of Measure', node.uom ?? 'EA',                                  uom);
    return rows;
  }, [node, partName, desc, manufacturer, mpn, distributor, price, leadTime, qty, uom]);

  const assignApprover = (idx: number, memberId: string) => {
    const member = projectMembers.find(m => m.id === memberId);
    setPipeline(pl => pl.map((x, i) => (
      i === idx ? { ...x, approverId: member?.id ?? null, name: member?.name ?? '', role: member?.role ?? '' } : x
    )));
  };

  const stageMoved = (p: PipelineStep, idx: number) =>
    defaultOrder[p.stage] !== undefined && defaultOrder[p.stage] !== idx;

  const pipelineValid = pipeline.every((p, idx) => {
    const needsReason = p.optional || stageMoved(p, idx);
    const reasonOk = !needsReason || (p.justification ?? '').trim().length > 0;
    return reasonOk && !!p.approverId;
  });

  const canSubmit =
    ecoTitle.trim().length > 0 &&
    partName.trim().length > 0 &&
    revTo.trim().length > 0 &&
    desc.trim().length > 0 &&
    manufacturer.trim().length > 0 &&
    mpn.trim().length > 0 &&
    distributor.trim().length > 0 &&
    price.trim().length > 0 && !isNaN(Number(price)) && Number(price) >= 0 &&
    leadTime.trim().length > 0 && !isNaN(Number(leadTime)) && Number(leadTime) >= 0 &&
    qty.trim().length > 0 && !isNaN(Number(qty)) && Number(qty) > 0 &&
    changedFields.length >= 1 &&
    pipeline.length >= 1 &&
    pipelineValid;

  const isTabValid = useMemo(() => {
    if (activeTab === 'part') {
      return (
        ecoTitle.trim().length > 0 &&
        partName.trim().length > 0 &&
        revTo.trim().length > 0 &&
        desc.trim().length > 0 &&
        manufacturer.trim().length > 0 &&
        mpn.trim().length > 0 &&
        distributor.trim().length > 0 &&
        price.trim().length > 0 && !isNaN(Number(price)) && Number(price) >= 0 &&
        leadTime.trim().length > 0 && !isNaN(Number(leadTime)) && Number(leadTime) >= 0 &&
        qty.trim().length > 0 && !isNaN(Number(qty)) && Number(qty) > 0 &&
        changedFields.length >= 1
      );
    }
    if (activeTab === 'impact') {
      return impactArea !== 'other' || impactAreaOther.trim().length > 0;
    }
    if (activeTab === 'reason') {
      return (
        (changeType !== 'OTHER' || changeTypeOther.trim().length > 0) &&
        (reasonCode !== 'OTHER' || reasonCodeOther.trim().length > 0)
      );
    }
    return true;
  }, [
    activeTab, ecoTitle, partName, revTo, desc, manufacturer, mpn, distributor,
    price, leadTime, qty, changedFields, impactArea, impactAreaOther,
    changeType, changeTypeOther, reasonCode, reasonCodeOther,
  ]);

  const validateTab = (tab: TabId): boolean => {
    const e: Record<string, string> = {};
    if (tab === 'part') {
      if (!ecoTitle.trim()) e.title = 'ECO title is required';
      if (!partName.trim()) e.name = 'Part Name is required';
      if (!revTo.trim()) e.revTo = 'Rev To is required';
      if (!desc.trim()) e.desc = 'Description is required';
      if (!manufacturer.trim()) e.manufacturer = 'Manufacturer is required';
      if (!mpn.trim()) e.mpn = 'Manufacturer PN (MPN) is required';
      if (!distributor.trim()) e.distributor = 'Supplier / Distributor is required';
      if (!price.trim() || isNaN(Number(price)) || Number(price) < 0) {
        e.price = 'Unit Price is required and must be 0 or greater';
      }
      if (!leadTime.trim() || isNaN(Number(leadTime)) || Number(leadTime) < 0) {
        e.leadTime = 'Lead Time is required and must be 0 or greater';
      }
      if (!qty.trim() || isNaN(Number(qty)) || Number(qty) <= 0) {
        e.qty = 'Quantity is required and must be a positive number';
      }
      if (changedFields.length === 0) e.changes = 'Change at least one BOM field to proceed';
    }
    if (tab === 'impact' && impactArea === 'other' && !impactAreaOther.trim()) {
      e.impactAreaOther = 'Specify the impact area';
    }
    if (tab === 'reason') {
      if (changeType === 'OTHER' && !changeTypeOther.trim()) e.changeTypeOther = 'Describe the change type';
      if (reasonCode === 'OTHER' && !reasonCodeOther.trim()) e.reasonCodeOther = 'Describe the reason';
    }
    if (tab === 'approval') {
      if (pipeline.length < 1) e.pipeline = 'At least 1 approval stage is required';
      else if (!pipelineValid) e.pipeline = 'Every stage needs an approver, and optional/reordered stages need a justification';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleTabChange = (targetTab: TabId) => {
    const currentIndex = TABS.indexOf(activeTab);
    const targetIndex = TABS.indexOf(targetTab);

    if (targetIndex > currentIndex) {
      for (let i = currentIndex; i < targetIndex; i++) {
        if (!validateTab(TABS[i])) return;
      }
    }
    setErrors({});
    setActiveTab(targetTab);
    setMaxTabReached(m => Math.max(m, targetIndex));
  };

  const handleNext = () => {
    if (!validateTab(activeTab)) return;
    setErrors({});
    const nextIndex = TABS.indexOf(activeTab) + 1;
    setActiveTab(TABS[nextIndex]);
    setMaxTabReached(m => Math.max(m, nextIndex));
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const created = await createMutation.mutateAsync({
        title: ecoTitle.trim(),
        description: reasonDesc || null,
        type: changeType.toLowerCase(),
        typeOther: changeType === 'OTHER' ? changeTypeOther.trim() : null,
        reason: reasonCode.toLowerCase(),
        reasonOther: reasonCode === 'OTHER' ? reasonCodeOther.trim() : null,
        priority: priority.toLowerCase(),
        changeClass: 'II',
        revFrom: revFrom || null,
        revTo: revTo || null,
        scheduleImpact: impactLevel.toLowerCase(),
        impactArea: impactArea === 'other' ? (impactAreaOther.trim() || 'other') : impactArea,
        certNotes: impactDesc || null,
        parts: node._partId ? [{
          partId: node._partId,
          bomNodeId: node.id,
          revFrom: revFrom || null,
          revTo: revTo || null,
          impactLevel: impactLevel.toLowerCase(),
          disposition: 'use_as_is',
          notes: null,
        }] : [],
        diffRows: changedFields.map((r, i) => ({
          order: i,
          parameter: r.param,
          fromValue: r.from,
          toValue: r.to,
          changeLabel: r.label.toLowerCase(),
        })),
        pipelineSteps: pipeline.map((p, i) => ({
          order: i + 1,
          stage: p.stage,
          stageLabel: p.stage,
          approverUserId: p.approverId ?? null,
          approverName: p.name ?? null,
          approverRole: p.role ?? null,
          isOptional: p.optional ?? false,
          optionalReason: p.optionalReason ?? null,
          justification: p.justification || null,
        })),
      });
      toast.success('ECO created successfully');
      onClose();
      if (created?.id) onCreated?.(created.id);
    } catch {
      toast.error('Failed to create ECO');
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-[1050px] w-[90vw] p-0 gap-0 flex flex-col overflow-hidden"
        style={{ maxHeight: '88vh', minHeight: '70vh' }}
      >
        {/* Header */}
        <DialogHeader className="px-7 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <GitMerge className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold leading-none">
                  New Engineering Change Order
                </DialogTitle>
                <span className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-mono font-medium shrink-0">
                  {node.pn}
                </span>
              </div>
              <DialogDescription className="text-[12px] text-muted-foreground mt-0.5">
                Propose a change to this part · ECO number assigned on save
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={v => handleTabChange(v as TabId)} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-7 pt-3 pb-0 border-b border-border shrink-0">
            <TabsList className="bg-transparent h-auto p-0 gap-0 w-full justify-start rounded-none">
              {TABS.map((t, i) => {
                const locked = i > maxTabReached;
                return (
                  <TabsTrigger
                    key={t}
                    value={t}
                    disabled={locked}
                    className={cn(
                      "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent text-muted-foreground text-[13px] font-medium px-4 py-2 capitalize transition-opacity",
                      locked && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {TAB_LABEL[t]}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Part Details tab */}
          <TabsContent value="part" className="flex-1 min-h-0 relative mt-0">
            <div className="absolute inset-0 overflow-y-auto">
              <div className="px-7 py-5 flex flex-col gap-5">

                {/* ECO meta — always at top so it's never hidden below fold */}
                <FL label="ECO Title" required>
                  <FInput
                    value={ecoTitle}
                    onChange={e => { setEcoTitle(e.target.value); if (errors.title) setErrors(({ title: _title, ...rest }) => rest); }}
                    placeholder="e.g. Motor Housing Rev B Redesign"
                    className={cn(errors.title && 'border-destructive')}
                  />
                  {errors.title && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.title}</p>}
                </FL>

                <div className="grid grid-cols-2 gap-4">
                  <FL label="Rev From">
                    <FInput
                      value={revFrom}
                      onChange={e => setRevFrom(e.target.value)}
                      placeholder="e.g. A"
                      maxLength={3}
                    />
                  </FL>
                  <FL label="Rev To" required>
                    <FInput
                      value={revTo}
                      onChange={e => { setRevTo(e.target.value); if (errors.revTo) setErrors(({ revTo: _r, ...rest }) => rest); }}
                      placeholder="e.g. B"
                      className={cn(errors.revTo && 'border-destructive')}
                      maxLength={3}
                    />
                    {errors.revTo && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.revTo}</p>}
                  </FL>
                </div>
                <p className="text-[11px] text-muted-foreground -mt-3">
                  When the ECO is approved, a new BOM revision will be created automatically using the "Rev To" value.
                </p>

                <div className="border-t border-border/60 pt-4 flex flex-col gap-4">
                  {/* Category badge + Part Number (read-only identifier) */}
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider"
                      style={{ background: `${meta.tint}20`, color: meta.tint }}
                    >
                      <span className="w-2 h-2 rounded-sm inline-block" style={{ background: meta.tint }} />
                      {meta.label}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      Part Number&nbsp;<span className="font-mono font-semibold text-foreground">{node.pn}</span>
                      &nbsp;· BOM Level {node.level}
                    </span>
                  </div>

                  {errors.changes && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-[12px] text-destructive">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {errors.changes}
                    </div>
                  )}

                  {/* Part Name (Mandatory) */}
                  <FL label="Part Name" required>
                    <FInput
                      value={partName}
                      onChange={e => { setPartName(e.target.value); if (errors.name) setErrors(({ name: _n, ...rest }) => rest); }}
                      placeholder="Part Name"
                      className={cn(errors.name && 'border-destructive')}
                    />
                    {errors.name && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.name}</p>}
                  </FL>

                  {/* Description (Mandatory) */}
                  <FL label="Description" required>
                    <Textarea
                      value={desc}
                      onChange={e => { setDesc(e.target.value); if (errors.desc) setErrors(({ desc: _d, ...rest }) => rest); }}
                      placeholder="Brief technical description of the part"
                      className={cn('text-sm bg-muted border-border resize-none', errors.desc && 'border-destructive')}
                      rows={3}
                    />
                    {errors.desc && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.desc}</p>}
                  </FL>

                  {/* Sourcing grid */}
                  <div className="grid grid-cols-3 gap-x-5 gap-y-4">
                    <FL label="Manufacturer" required className="col-span-3">
                      <FInput
                        value={manufacturer}
                        onChange={e => { setManufacturer(e.target.value); if (errors.manufacturer) setErrors(({ manufacturer: _m, ...rest }) => rest); }}
                        placeholder="e.g. Texas Instruments"
                        className={cn(errors.manufacturer && 'border-destructive')}
                      />
                      {errors.manufacturer && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.manufacturer}</p>}
                    </FL>
                    <FL label="Manufacturer PN (MPN)" required>
                      <FInput
                        value={mpn}
                        onChange={e => { setMpn(e.target.value); if (errors.mpn) setErrors(({ mpn: _mpn, ...rest }) => rest); }}
                        placeholder="e.g. TI-A4B2"
                        className={cn('font-mono', errors.mpn && 'border-destructive')}
                      />
                      {errors.mpn && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.mpn}</p>}
                    </FL>
                    <FL label="Supplier / Distributor" required>
                      <FInput
                        value={distributor}
                        onChange={e => { setDistributor(e.target.value); if (errors.distributor) setErrors(({ distributor: _dist, ...rest }) => rest); }}
                        placeholder="e.g. Digi-Key"
                        className={cn(errors.distributor && 'border-destructive')}
                      />
                      {errors.distributor && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.distributor}</p>}
                    </FL>
                    <FL label="Unit Price ($)" required>
                      <FInput
                        value={price}
                        onChange={e => { setPrice(e.target.value); if (errors.price) setErrors(({ price: _p, ...rest }) => rest); }}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className={cn(errors.price && 'border-destructive')}
                      />
                      {errors.price && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.price}</p>}
                    </FL>
                    <FL label="Lead Time (days)" required>
                      <FInput
                        value={leadTime}
                        onChange={e => { setLeadTime(e.target.value); if (errors.leadTime) setErrors(({ leadTime: _l, ...rest }) => rest); }}
                        type="number"
                        placeholder="14"
                        className={cn(errors.leadTime && 'border-destructive')}
                      />
                      {errors.leadTime && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.leadTime}</p>}
                    </FL>
                    <FL label="Quantity" required>
                      <FInput
                        value={qty}
                        onChange={e => { setQty(e.target.value); if (errors.qty) setErrors(({ qty: _q, ...rest }) => rest); }}
                        type="number"
                        placeholder="1"
                        className={cn(errors.qty && 'border-destructive')}
                      />
                      {errors.qty && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.qty}</p>}
                    </FL>
                    <FL label="Unit of Measure (UOM)" className="col-span-3">
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {UOM_OPTIONS.map(u => (
                          <button
                            key={u}
                            onClick={() => setUom(u)}
                            className={cn(
                              'px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer transition-colors font-[inherit]',
                              uom === u
                                ? 'bg-primary/10 text-primary border-primary/30'
                                : 'bg-card text-muted-foreground border-border hover:bg-muted'
                            )}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </FL>
                  </div>

                  {/* Changed fields summary */}
                  {changedFields.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {changedFields.slice(0, 4).map(r => (
                        <span
                          key={r.param}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                          style={{ background: 'hsl(var(--primary)/0.08)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary)/0.2)' }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'hsl(var(--primary))' }} />
                          {r.param}
                        </span>
                      ))}
                      {changedFields.length > 4 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-muted-foreground border border-border">
                          +{changedFields.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Impact tab */}
          <TabsContent value="impact" className="flex-1 min-h-0 relative mt-0">
            <div className="absolute inset-0 overflow-y-auto">
              <div className="px-7 py-5 flex flex-col gap-5">
                <p className="text-[13px] text-muted-foreground">
                  Describe the consequences of this engineering change on the product or project.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FL label="Impact Area">
                    <FSelect
                      value={impactArea}
                      onChange={setImpactArea}
                      options={IMPACT_AREA_OPTIONS}
                      labels={IMPACT_AREA_LABEL}
                    />
                  </FL>
                  <FL label="Impact Level">
                    <FSelect
                      value={impactLevel}
                      onChange={setImpactLevel}
                      options={(['HIGH', 'MEDIUM', 'LOW'] as ImpactLevel[])}
                      labels={IMPACT_LABEL}
                    />
                  </FL>
                </div>
                {impactArea === 'other' && (
                  <FL label="Specify Impact Area" required>
                    <FInput
                      value={impactAreaOther}
                      onChange={e => {
                        setImpactAreaOther(e.target.value);
                        if (errors.impactAreaOther) setErrors(({ impactAreaOther: _o, ...rest }) => rest);
                      }}
                      placeholder="e.g. Logistics, Documentation"
                      className={cn(errors.impactAreaOther && 'border-destructive')}
                    />
                    {errors.impactAreaOther && (
                      <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />{errors.impactAreaOther}
                      </p>
                    )}
                  </FL>
                )}
                <FL label="Impact Description">
                  <textarea
                    value={impactDesc}
                    onChange={e => setImpactDesc(e.target.value)}
                    placeholder="Describe the full impact of this change — schedule effects, cost consequences, quality implications, safety considerations, etc."
                    rows={6}
                    className={cn(inputCls, 'resize-none')}
                  />
                </FL>
              </div>
            </div>
          </TabsContent>

          {/* Reason tab */}
          <TabsContent value="reason" className="flex-1 min-h-0 relative mt-0">
            <div className="absolute inset-0 overflow-y-auto">
              <div className="px-7 py-5 flex flex-col gap-5">
                <p className="text-[13px] text-muted-foreground">
                  Specify why this engineering change is needed.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <FL label="Change Type">
                    <FSelect
                      value={changeType}
                      onChange={setChangeType}
                      options={Object.keys(ECO_TYPE_LABEL) as ECOType[]}
                      labels={ECO_TYPE_LABEL}
                    />
                  </FL>
                  <FL label="Reason Code">
                    <FSelect
                      value={reasonCode}
                      onChange={setReasonCode}
                      options={Object.keys(REASON_LABEL) as ECOReason[]}
                      labels={REASON_LABEL}
                    />
                  </FL>
                  <FL label="Priority">
                    <FSelect
                      value={priority}
                      onChange={setPriority}
                      options={(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as ECOPriority[])}
                      labels={PRIORITY_LABEL}
                    />
                  </FL>
                </div>
                {(changeType === 'OTHER' || reasonCode === 'OTHER') && (
                  <div className="grid grid-cols-2 gap-4">
                    {changeType === 'OTHER' && (
                      <FL label="Specify Change Type" required>
                        <FInput
                          value={changeTypeOther}
                          onChange={e => {
                            setChangeTypeOther(e.target.value);
                            if (errors.changeTypeOther) setErrors(({ changeTypeOther: _c, ...rest }) => rest);
                          }}
                          placeholder="e.g. Tooling Change"
                          className={cn(errors.changeTypeOther && 'border-destructive')}
                        />
                        {errors.changeTypeOther && (
                          <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3" />{errors.changeTypeOther}
                          </p>
                        )}
                      </FL>
                    )}
                    {reasonCode === 'OTHER' && (
                      <FL label="Specify Reason" required>
                        <FInput
                          value={reasonCodeOther}
                          onChange={e => {
                            setReasonCodeOther(e.target.value);
                            if (errors.reasonCodeOther) setErrors(({ reasonCodeOther: _r, ...rest }) => rest);
                          }}
                          placeholder="e.g. Field Failure"
                          className={cn(errors.reasonCodeOther && 'border-destructive')}
                        />
                        {errors.reasonCodeOther && (
                          <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3" />{errors.reasonCodeOther}
                          </p>
                        )}
                      </FL>
                    )}
                  </div>
                )}
                <FL label="Reason Description">
                  <textarea
                    value={reasonDesc}
                    onChange={e => setReasonDesc(e.target.value)}
                    placeholder="Explain in detail why this change is necessary — root cause, customer feedback, regulatory requirement, etc."
                    rows={6}
                    className={cn(inputCls, 'resize-none')}
                  />
                </FL>
              </div>
            </div>
          </TabsContent>

          {/* Approval tab */}
          <TabsContent value="approval" className="flex-1 min-h-0 relative mt-0">
            <div className="absolute inset-0 overflow-y-auto">
              <div className="px-7 py-5 flex flex-col gap-2.5">
                <p className="text-[13px] text-muted-foreground mb-1">
                  Ordered sign-off pipeline · assign a project member to each stage · reorder with arrows · mark stages optional. Any change to the default requires a justification.
                </p>
                {projectMembers.length === 0 && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
                    style={{ color: '#F59E0B', background: '#F59E0B14', border: '1px solid #F59E0B33' }}
                  >
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    No project members found — add members to the project team before assigning approvers.
                  </div>
                )}
                {pipeline.map((p, idx) => {
                  const moved = stageMoved(p, idx);
                  const needsReason = p.optional || moved;
                  return (
                    <div
                      key={idx}
                      className="border rounded-lg px-3 py-2.5"
                      style={{ borderColor: needsReason ? '#F59E0B55' : 'hsl(var(--border))' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-muted-foreground w-5">{idx + 1}</span>
                        <ECOAvatar name={p.name || '?'} size={26} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                            {p.isCustom ? (
                              <input
                                value={p.stage}
                                onChange={e => setPipeline(pl => pl.map((x, i) => i === idx ? { ...x, stage: e.target.value } : x))}
                                placeholder="Stage name…"
                                className={inputCls}
                                style={{ fontSize: 13, fontWeight: 600, padding: '1px 6px', width: 160, borderColor: p.stage.trim() ? undefined : '#F59E0B88' }}
                              />
                            ) : p.stage}
                            <span className="text-destructive font-semibold ml-0.5">*</span>
                            {moved && (
                              <span
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ color: '#F59E0B', background: '#F59E0B1f', border: '1px solid #F59E0B33' }}
                              >
                                reordered
                              </span>
                            )}
                          </div>
                          <div className="relative mt-0.5 w-full max-w-[240px]">
                            <select
                              value={p.approverId ?? ''}
                              onChange={e => assignApprover(idx, e.target.value)}
                              className="w-full bg-muted/40 border rounded-md text-foreground text-[11px] pl-2 pr-7 py-1 outline-none focus:border-primary/40 cursor-pointer appearance-none font-[inherit]"
                              style={{ borderColor: p.approverId ? 'hsl(var(--border))' : '#F59E0B88' }}
                            >
                              <option value="" disabled className="bg-card">Select approver *</option>
                              {projectMembers.map(m => (
                                <option key={m.id} value={m.id} className="bg-card">{m.name} · {m.role}</option>
                              ))}
                            </select>
                            <ChevronDown className="w-3 h-3 text-muted-foreground pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>
                        <button
                          onClick={() => setPipeline(pl => pl.map((x, i) => i === idx ? { ...x, optional: !x.optional } : x))}
                          className="px-2 py-1 rounded-full text-[10px] font-semibold transition-colors font-[inherit]"
                          style={{
                            background: p.optional ? '#F59E0B1a' : 'hsl(var(--muted))',
                            color: p.optional ? '#F59E0B' : undefined,
                            border: `1px solid ${p.optional ? '#F59E0B44' : 'hsl(var(--border))'}`,
                            cursor: 'pointer',
                          }}
                        >
                          {p.optional ? 'Optional' : 'Required'}
                        </button>
                        <div className="flex flex-col gap-0.5">
                          <button
                            disabled={idx === 0}
                            onClick={() => setPipeline(pl => { const n = [...pl]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; return n; })}
                            className="disabled:opacity-30 cursor-pointer disabled:cursor-default"
                            style={{ background: 'none', border: 'none', padding: 0 }}
                          >
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground rotate-180" />
                          </button>
                          <button
                            disabled={idx === pipeline.length - 1}
                            onClick={() => setPipeline(pl => { const n = [...pl]; [n[idx + 1], n[idx]] = [n[idx], n[idx + 1]]; return n; })}
                            className="disabled:opacity-30 cursor-pointer disabled:cursor-default"
                            style={{ background: 'none', border: 'none', padding: 0 }}
                          >
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <button
                          onClick={() => setPipeline(pl => pl.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {needsReason && (
                        <div className="mt-2.5 pt-2.5 border-t border-dashed border-border/60">
                          <div
                            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider mb-1.5"
                            style={{ color: '#F59E0B' }}
                          >
                            <AlertCircle className="w-3 h-3" />
                            {p.optional ? 'Why optional' : 'Why reordered'} <span className="text-destructive ml-0.5">*</span> — justification required
                          </div>
                          <input
                            value={p.justification ?? ''}
                            onChange={e => setPipeline(pl => pl.map((x, i) => i === idx ? { ...x, justification: e.target.value } : x))}
                            placeholder={p.optional ? `e.g. ${p.stage} waived — low geometric risk` : 'e.g. moved Final ahead of QA per program waiver'}
                            className={inputCls}
                            style={{ borderColor: (p.justification ?? '').trim() ? undefined : '#F59E0B88' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => setPipeline(pl => [
                    ...pl,
                    { stage: '', name: '', role: '', approverId: null, optional: false, justification: '', isCustom: true },
                  ])}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors w-fit font-[inherit]"
                  style={{ background: 'none', border: '1px dashed hsl(var(--border))', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add stage
                </button>
                {priority === 'LOW' && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                    <AlertCircle className="w-3 h-3" style={{ color: '#F59E0B' }} />
                    Low priority — optional stages may be auto-skipped at submit.
                  </div>
                )}
                {priority === 'CRITICAL' && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                    <AlertCircle className="w-3 h-3" style={{ color: '#DC2626' }} />
                    Critical — full pipeline incl. QA + final is enforced.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-border flex items-center justify-between gap-4 shrink-0 bg-card">
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {activeTab === 'part' && errors.changes ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-destructive" />
                <span className="text-destructive">{errors.changes}</span>
              </>
            ) : activeTab !== 'approval' ? (
              <span>Step {TABS.indexOf(activeTab) + 1} of {TABS.length}</span>
            ) : canSubmit ? (
              <>
                <Check className="w-3.5 h-3.5" style={{ color: '#16A34A' }} />
                <span>Ready to create ECO</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#F59E0B' }} />
                <span>
                  {pipeline.length < 1
                    ? 'At least 1 approval stage is required'
                    : 'Assign an approver to every stage, and a justification for each optional / reordered stage'}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-md text-sm font-medium border border-border bg-transparent text-foreground hover:bg-muted transition-colors font-[inherit]"
            >
              Cancel
            </button>
            {TABS.indexOf(activeTab) > 0 && (
              <button
                onClick={() => { setErrors({}); setActiveTab(TABS[TABS.indexOf(activeTab) - 1]); }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium border border-border bg-transparent text-foreground hover:bg-muted transition-colors font-[inherit]"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {activeTab !== 'approval' ? (
              <button
                onClick={handleNext}
                disabled={!isTabValid}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-[inherit]"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || createMutation.isPending}
                className="px-4 py-1.5 rounded-md text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-[inherit]"
              >
                {createMutation.isPending ? 'Creating…' : 'Create ECO'}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
