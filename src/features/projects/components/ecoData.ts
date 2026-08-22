// ECO (Engineering Change Order) — types, enums, mock data, color helpers
import type {
  ApiEcoListItem, ApiEcoDetail, ApiEcoPart, ApiEcoPipelineStep,
  ApiEcoDiffRow, ApiEcoActivity,
} from '@/hooks/useECOs';

// ── Enumerations ──────────────────────────────────────────────────────────────

export type ECOType =
  | 'DESIGN_CHANGE' | 'COMPONENT_CHANGE' | 'SUPPLIER_CHANGE' | 'PROCESS_CHANGE'
  | 'DOCUMENTATION_CHANGE' | 'COST_REDUCTION' | 'DEVIATION' | 'OBSOLESCENCE' | 'OTHER';

export type ECOReason =
  | 'PERFORMANCE' | 'COST' | 'QUALITY' | 'SUPPLY_CHAIN' | 'SAFETY' | 'COMPLIANCE'
  | 'CUSTOMER_REQUEST' | 'EOL_OBSOLESCENCE' | 'MANUFACTURABILITY' | 'OTHER';

export type ECODisposition =
  | 'USE_AS_IS' | 'REWORK' | 'SCRAP' | 'RETURN_TO_SUPPLIER' | 'USE_UP_THEN_CHANGE';

export type ECOPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ECOStatus =
  | 'DRAFT' | 'IN_REVIEW' | 'REWORK' | 'APPROVED'
  | 'RELEASED' | 'VERIFIED' | 'CLOSED' | 'ON_HOLD' | 'CANCELLED';

export type ChangeClass = 'I' | 'II' | 'III';

export type EffectivityType = 'DATE' | 'SERIAL' | 'LOT';

export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type ChangeLabel = 'MODIFIED' | 'IMPROVED' | 'INCREASED' | 'DECREASED' | 'ADDED' | 'REMOVED';

export type DecisionType = 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'PENDING' | 'HOLD';

// ── Display labels ────────────────────────────────────────────────────────────

export const ECO_TYPE_LABEL: Record<ECOType, string> = {
  DESIGN_CHANGE: 'Design Change',
  COMPONENT_CHANGE: 'Component Change',
  SUPPLIER_CHANGE: 'Supplier Change',
  PROCESS_CHANGE: 'Process Change',
  DOCUMENTATION_CHANGE: 'Documentation Change',
  COST_REDUCTION: 'Cost Reduction',
  DEVIATION: 'Deviation',
  OBSOLESCENCE: 'Obsolescence',
  OTHER: 'Other',
};

export const REASON_LABEL: Record<ECOReason, string> = {
  PERFORMANCE: 'Performance',
  COST: 'Cost',
  QUALITY: 'Quality',
  SUPPLY_CHAIN: 'Supply Chain',
  SAFETY: 'Safety',
  COMPLIANCE: 'Compliance',
  CUSTOMER_REQUEST: 'Customer Request',
  EOL_OBSOLESCENCE: 'EOL / Obsolescence',
  MANUFACTURABILITY: 'Manufacturability',
  OTHER: 'Other',
};

export const DISPOSITION_LABEL: Record<ECODisposition, string> = {
  USE_AS_IS: 'Use As-Is',
  REWORK: 'Rework',
  SCRAP: 'Scrap',
  RETURN_TO_SUPPLIER: 'Return to Supplier',
  USE_UP_THEN_CHANGE: 'Use Up, Then Change',
};

export const PRIORITY_LABEL: Record<ECOPriority, string> = {
  CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low',
};

export const STATUS_LABEL: Record<ECOStatus, string> = {
  DRAFT: 'Draft', IN_REVIEW: 'In Review', REWORK: 'Rework', APPROVED: 'Approved',
  RELEASED: 'Released', VERIFIED: 'Verified', CLOSED: 'Closed', ON_HOLD: 'On Hold', CANCELLED: 'Cancelled',
};

export const MAIN_STATUSES: ECOStatus[] = [
  'DRAFT', 'IN_REVIEW', 'REWORK', 'APPROVED', 'RELEASED', 'VERIFIED', 'CLOSED', 'ON_HOLD',
];

export const CHANGE_LABEL_MAP: Record<ChangeLabel, string> = {
  MODIFIED: 'Modified', IMPROVED: 'Improved', INCREASED: 'Increased',
  DECREASED: 'Decreased', ADDED: 'Added', REMOVED: 'Removed',
};

export const IMPACT_LABEL: Record<ImpactLevel, string> = {
  HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low',
};

export const IMPACT_AREA_OPTIONS = [
  'schedule', 'cost', 'quality', 'safety', 'compliance',
  'software', 'firmware', 'manufacturing', 'procurement', 'reliability', 'other',
] as const;
export type ImpactArea = typeof IMPACT_AREA_OPTIONS[number];
export const IMPACT_AREA_LABEL: Record<ImpactArea, string> = {
  schedule: 'Schedule',
  cost: 'Cost',
  quality: 'Quality',
  safety: 'Safety',
  compliance: 'Compliance',
  software: 'Software',
  firmware: 'Firmware',
  manufacturing: 'Manufacturing',
  procurement: 'Procurement',
  reliability: 'Reliability',
  other: 'Other',
};

export function impactAreaLabel(area: string | null | undefined): string {
  if (!area) return '—';
  return IMPACT_AREA_LABEL[area as ImpactArea] ?? (area.charAt(0).toUpperCase() + area.slice(1));
}

export const CHANGE_CLASS_LABEL: Record<ChangeClass, string> = {
  I: 'Class I — Safety / Regulatory',
  II: 'Class II — Form-Fit-Function',
  III: 'Class III — Documentation',
};

export const CHANGE_CLASS_SHORT: Record<ChangeClass, string> = {
  I: 'Class I', II: 'Class II', III: 'Class III',
};

export const EFFECTIVITY_LABEL: Record<EffectivityType, string> = {
  DATE: 'Date', SERIAL: 'Serial-number break', LOT: 'Lot break',
};

export function effectivityText(eff: Effectivity | null | undefined): string {
  if (!eff) return '—';
  if (eff.type === 'SERIAL') return 'From S/N ' + eff.value;
  if (eff.type === 'LOT') return 'From Lot ' + eff.value;
  return eff.value;
}

// ── Pill style helpers ────────────────────────────────────────────────────────

export interface PillStyle {
  background: string;
  color: string;
  border: string;
  label: string;
}

function pill(color: string, label: string): PillStyle {
  return { background: `${color}22`, color, border: `1px solid ${color}44`, label };
}

export function statusMeta(status: ECOStatus): PillStyle {
  const c: Record<ECOStatus, string> = {
    DRAFT: '#6B7280', IN_REVIEW: '#F59E0B', REWORK: '#f97316', APPROVED: '#16A34A',
    RELEASED: '#2563EB', VERIFIED: '#9333EA', CLOSED: '#6B7280', ON_HOLD: '#F59E0B', CANCELLED: '#9CA3AF',
  };
  return pill(c[status] ?? '#6B7280', STATUS_LABEL[status] ?? status);
}

export function priorityMeta(p: ECOPriority): PillStyle {
  const c: Record<ECOPriority, string> = {
    CRITICAL: '#DC2626', HIGH: '#f97316', MEDIUM: '#F59E0B', LOW: '#6B7280',
  };
  return pill(c[p] ?? '#6B7280', PRIORITY_LABEL[p] ?? p);
}

export function changeMeta(cls: ChangeLabel): PillStyle {
  const c: Record<ChangeLabel, string> = {
    MODIFIED: '#2563EB', IMPROVED: '#16A34A', INCREASED: '#F59E0B',
    DECREASED: '#0891B2', ADDED: '#9333EA', REMOVED: '#DC2626',
  };
  return pill(c[cls] ?? '#6B7280', CHANGE_LABEL_MAP[cls] ?? cls);
}

export function impactMeta(i: ImpactLevel): PillStyle {
  const c: Record<ImpactLevel, string> = { HIGH: '#DC2626', MEDIUM: '#F59E0B', LOW: '#16A34A' };
  return pill(c[i] ?? '#6B7280', IMPACT_LABEL[i] ?? i);
}

export function dispositionMeta(d: ECODisposition): PillStyle {
  const c: Record<ECODisposition, string> = {
    USE_AS_IS: '#16A34A', REWORK: '#F59E0B', SCRAP: '#DC2626',
    RETURN_TO_SUPPLIER: '#2563EB', USE_UP_THEN_CHANGE: '#9333EA',
  };
  return pill(c[d] ?? '#6B7280', DISPOSITION_LABEL[d] ?? d);
}

export function changeClassMeta(cc: ChangeClass): PillStyle {
  const c: Record<ChangeClass, string> = { I: '#DC2626', II: '#F59E0B', III: '#2563EB' };
  return pill(c[cc] ?? '#6B7280', CHANGE_CLASS_SHORT[cc] ?? cc);
}

// ── Data interfaces ───────────────────────────────────────────────────────────

export interface Effectivity {
  type: EffectivityType;
  value: string;
}

export interface PipelineStep {
  order: number;
  stage: string;
  name: string;
  role: string;
  approverId?: string | null;
  optional?: boolean;
  optionalReason?: string;
  justification?: string;
  decision?: DecisionType;
  date?: string;
  note?: string | null;
  decidedById?: string | null;
  decidedByName?: string | null;
}

export interface DiffRow {
  param: string;
  from: string;
  to: string;
  cls: ChangeLabel;
  unit?: string;
}

export interface ECOPart {
  pn: string;
  partId: string;
  bomNodeId?: string;
  name?: string;
  desc: string;
  rev: { from: string; to: string } | null;
  impact: ImpactLevel;
  disp: ECODisposition;
  qty: number;
  paths: string[][];
}

export interface ECOImpact {
  schedule: ImpactLevel;
  milestones: string[];
  unitCostDelta: number;
  oneTimeCost: number;
  recert: boolean;
  certNotes: string;
  impactArea: string | null;
  firmware: boolean;
  inventoryQty: number;
}

export interface ActivityEntry {
  actor: string;
  action: string;
  when: string;
  note?: string;
}

export interface ECNTask {
  task: string;
  assignee: string;
  due: string;
  status: 'todo' | 'done';
}

export interface ECNData {
  num: string;
  distribution: string[];
  recalc: { count: number; days: number; gate: string };
  tasks: ECNTask[];
}

export interface Rejection {
  stage: string;
  by: string;
  when: string;
  reason: string;
}

export interface ECOListItem {
  id: string;
  num: string;
  title: string;
  desc: string;
  type: ECOType;
  typeOther?: string | null;
  status: ECOStatus;
  priority: ECOPriority;
  reason: ECOReason;
  reasonOther?: string | null;
  changeClass: ChangeClass;
  ecr: string | null;
  effectivity: Effectivity;
  originator: string;
  owner: string;
  created: string;
  target: string;
  revFrom: string;
  revTo: string;
  parts: number;
  docs: string[];
  modules: string[];
  awaitingMe: boolean;
}

export interface ECODetail extends Omit<ECOListItem, 'parts'> {
  parts: ECOPart[];
  steps: PipelineStep[];
  rejections: Rejection[];
  diff: DiffRow[];
  impact: ECOImpact;
  activity: ActivityEntry[];
  ecn: ECNData | null;
}

// ── Module colors ─────────────────────────────────────────────────────────────

export const MODULE_COLORS: Record<string, string> = {
  enclosure: '#2563EB', manufacturing: '#16A34A', pcb: '#9333EA',
  procurement: '#D97706', qa: '#DC2626', firmware: '#0891B2',
  software: '#7C3AED', mechanical: '#0D9488', testing: '#16A34A',
};

// ── Lifecycle helpers ─────────────────────────────────────────────────────────

export function lifecycleIndex(status: ECOStatus): number {
  const map: Partial<Record<ECOStatus, number>> = {
    DRAFT: 0, IN_REVIEW: 1, REWORK: 1, ON_HOLD: 1, APPROVED: 2, RELEASED: 3, VERIFIED: 4, CLOSED: 5,
  };
  return map[status] ?? 0;
}

// ── Pipeline template ─────────────────────────────────────────────────────────

export const PIPELINE_TEMPLATE: PipelineStep[] = [
  { order: 1, stage: 'Originator',         name: 'Sarah Chen',   role: 'Mech. Engineer' },
  { order: 2, stage: 'Engineering Review', name: 'Dr. Patel',    role: 'Lead Engineer' },
  {
    order: 3, stage: 'Quality Assurance',  name: 'Marcus Webb',  role: 'QA Manager',
    optional: true, optionalReason: 'Low geometric risk — QA review waived by Dr. Patel for FFF-class change.',
  },
  { order: 4, stage: 'Final Approval',     name: 'Linda Torres', role: 'VP Engineering' },
];

// Stage skeleton for the create wizard — no fake approvers. The caller must
// assign a real project member to each stage before submitting.
export const PIPELINE_STAGE_DEFS: PipelineStep[] = PIPELINE_TEMPLATE.map(s => ({
  order: s.order,
  stage: s.stage,
  name: '',
  role: '',
  approverId: null,
  optional: s.optional,
  optionalReason: s.optionalReason,
}));

function pipelineForStatus(status: ECOStatus, steps: PipelineStep[]): PipelineStep[] {
  const decided = (n: number) =>
    steps.slice(0, n).map((s, i) => ({
      ...s, decision: 'APPROVED' as DecisionType,
      date: (['Apr 14', 'Apr 17', 'Apr 21', 'Apr 24'] as string[])[i] ?? '—',
    }));
  const pend = (arr: PipelineStep[]) =>
    arr.map(s => ({ ...s, decision: 'PENDING' as DecisionType, date: 'Pending' }));

  switch (status) {
    case 'DRAFT':
      return steps.map((s, i) => ({
        ...s,
        decision: (i === 0 ? 'APPROVED' : 'PENDING') as DecisionType,
        date: i === 0 ? 'Apr 14' : 'Pending',
      }));
    case 'REWORK':
      return steps.map((s, i) => ({
        ...s,
        decision: (i === 0 ? 'ACTIVE' : 'PENDING') as DecisionType,
        date: i === 0 ? 'Revising' : 'Pending',
      }));
    case 'IN_REVIEW':
      return [
        ...decided(2),
        { ...steps[2], decision: 'ACTIVE' as DecisionType, date: 'Apr 21' },
        ...pend(steps.slice(3)),
      ];
    case 'ON_HOLD':
      return [
        ...decided(2),
        { ...steps[2], decision: 'HOLD' as DecisionType, date: 'On hold' },
        ...pend(steps.slice(3)),
      ];
    case 'APPROVED':
    case 'RELEASED':
    case 'VERIFIED':
    case 'CLOSED':
      return steps.map((s, i) => ({
        ...s, decision: 'APPROVED' as DecisionType,
        date: (['Apr 14', 'Apr 17', 'Apr 21', 'Apr 24'] as string[])[i] ?? '—',
      }));
    default:
      return pend(steps);
  }
}

// ── Top-assembly rollup ───────────────────────────────────────────────────────

export function topAssemblies(part: ECOPart): string[] {
  const tops = (part.paths ?? []).map(p => p[p.length - 1]).filter(Boolean);
  return Array.from(new Set(tops));
}

// ── ECO list data ─────────────────────────────────────────────────────────────

export const ECO_LIST: ECOListItem[] = [
  {
    id: '047', num: 'ECO-2026-047', title: 'Motor Housing Redesign',
    desc: 'Switch housing from cast aluminum A380 to die-cast magnesium AZ91D — cuts weight 25% and raises ingress protection to IP65.',
    type: 'DESIGN_CHANGE', status: 'IN_REVIEW', priority: 'HIGH', reason: 'PERFORMANCE',
    changeClass: 'II', ecr: 'ECR-2026-088', effectivity: { type: 'DATE', value: 'Jun 02, 2026' },
    originator: 'Sarah Chen', owner: 'Dr. Patel', created: 'Apr 14', target: 'Jun 02',
    revFrom: 'A', revTo: 'B', parts: 6, docs: ['Drawing', 'BOM', 'CAD'],
    modules: ['enclosure', 'manufacturing'], awaitingMe: true,
  },
  {
    id: '046', num: 'ECO-2026-046', title: 'Replace U2 PMIC with TPS65990',
    desc: 'TPS65987 reaching end-of-life — substitute pin-compatible TPS65990. No functional change, mandatory supplier swap.',
    type: 'OBSOLESCENCE', status: 'APPROVED', priority: 'HIGH', reason: 'EOL_OBSOLESCENCE',
    changeClass: 'II', ecr: null, effectivity: { type: 'SERIAL', value: 'EVC-1450' },
    originator: 'James Dean', owner: 'Aiko Kaur', created: 'Apr 19', target: 'May 28',
    revFrom: 'C', revTo: 'D', parts: 3, docs: ['Schematic', 'BOM'],
    modules: ['pcb', 'procurement'], awaitingMe: false,
  },
  {
    id: '045', num: 'ECO-2026-045', title: 'Add ESD protection on USB-C lines',
    desc: 'ESD failure during EMC pre-compliance at 8 kV contact discharge — add TVS array on CC/SBU lines. Requires recertification.',
    type: 'DESIGN_CHANGE', status: 'IN_REVIEW', priority: 'CRITICAL', reason: 'COMPLIANCE',
    changeClass: 'I', ecr: 'ECR-2026-091', effectivity: { type: 'DATE', value: 'May 22, 2026' },
    originator: 'Aiko Kaur', owner: 'Dr. Patel', created: 'Apr 18', target: 'May 22',
    revFrom: 'B', revTo: 'C', parts: 4, docs: ['Schematic', 'Layout'],
    modules: ['pcb', 'qa'], awaitingMe: true,
  },
  {
    id: '044', num: 'ECO-2026-044', title: 'Update crystal load capacitors to 12 pF',
    desc: 'Measured XTAL frequency drift — adjust load caps to 12 pF per oscillator spec. Light pipeline, low impact.',
    type: 'COMPONENT_CHANGE', status: 'RELEASED', priority: 'LOW', reason: 'QUALITY',
    changeClass: 'II', ecr: null, effectivity: { type: 'LOT', value: '2026-W18' },
    originator: 'Maria Lopez', owner: 'Maria Lopez', created: 'Apr 08', target: 'Apr 30',
    revFrom: 'A', revTo: 'B', parts: 2, docs: ['Schematic', 'BOM'],
    modules: ['pcb'], awaitingMe: false,
  },
  {
    id: '043', num: 'ECO-2026-043', title: 'Connector supplier swap Molex → TE',
    desc: 'Second-source the DC inlet connector to de-risk lead time. Same form/fit/function, different vendor.',
    type: 'SUPPLIER_CHANGE', status: 'DRAFT', priority: 'LOW', reason: 'SUPPLY_CHAIN',
    changeClass: 'II', ecr: 'ECR-2026-090', effectivity: { type: 'DATE', value: 'Jul 10, 2026' },
    originator: 'James Dean', owner: 'James Dean', created: 'Apr 24', target: 'Jul 10',
    revFrom: 'A', revTo: 'A', parts: 1, docs: ['BOM'],
    modules: ['procurement'], awaitingMe: false,
  },
  {
    id: '042', num: 'ECO-2026-042', title: 'Swap DDR4 footprint to LPDDR4X',
    desc: 'LPDDR4X offers 50% power reduction but requires firmware retarget — held pending FW team capacity.',
    type: 'COMPONENT_CHANGE', status: 'ON_HOLD', priority: 'MEDIUM', reason: 'PERFORMANCE',
    changeClass: 'II', ecr: null, effectivity: { type: 'DATE', value: 'Aug 01, 2026' },
    originator: 'James Dean', owner: 'Dr. Patel', created: 'Apr 12', target: 'Aug 01',
    revFrom: 'B', revTo: 'C', parts: 5, docs: ['Schematic', 'Layout', 'Firmware'],
    modules: ['pcb', 'firmware'], awaitingMe: false,
  },
  {
    id: '041', num: 'ECO-2026-041', title: 'Revise enclosure finish to RAL 7016',
    desc: 'Documentation-only update of powder-coat color and work instruction. No part geometry change.',
    type: 'DOCUMENTATION_CHANGE', status: 'CLOSED', priority: 'LOW', reason: 'CUSTOMER_REQUEST',
    changeClass: 'III', ecr: null, effectivity: { type: 'DATE', value: 'Apr 15, 2026' },
    originator: 'Maria Lopez', owner: 'Maria Lopez', created: 'Mar 28', target: 'Apr 15',
    revFrom: 'A', revTo: 'B', parts: 2, docs: ['Drawing', 'WorkInstr'],
    modules: ['enclosure', 'manufacturing'], awaitingMe: false,
  },
];

// ── Detail overrides ──────────────────────────────────────────────────────────

type DetailOverride = {
  rejections?: Rejection[];
  diff?: DiffRow[];
  parts?: ECOPart[];
  impact?: ECOImpact;
  activity?: ActivityEntry[];
  ecn?: ECNData | null;
};

const DETAIL_OVERRIDES: Record<string, DetailOverride> = {
  '047': {
    rejections: [
      { stage: 'Quality Assurance', by: 'Marcus Webb', when: 'Apr 19', reason: 'Salt-spray corrosion data missing for AZ91D — resubmit with 96h ASTM B117 results.' },
    ],
    diff: [
      { param: 'Housing Material',    from: 'Cast Aluminum A380',  to: 'Die-Cast Magnesium AZ91D', cls: 'MODIFIED' },
      { param: 'Wall Thickness',      from: '4.5 mm',              to: '3.2 mm',                   cls: 'DECREASED', unit: 'mm' },
      { param: 'Mounting Holes',      from: '4× M6',               to: '6× M6',                    cls: 'INCREASED' },
      { param: 'Surface Finish',      from: 'Anodized Type II',    to: 'Powder Coat RAL 7016',     cls: 'MODIFIED' },
      { param: 'IP Rating',           from: 'IP54',                to: 'IP65',                     cls: 'IMPROVED' },
      { param: 'Thermal Vents',       from: 'Stamped slots',       to: 'CNC-machined fins',        cls: 'MODIFIED' },
      { param: 'Weight',              from: '2.4 kg',              to: '1.8 kg',                   cls: 'DECREASED', unit: 'kg' },
      { param: 'Estimated Unit Cost', from: '$48.20',              to: '$52.75',                   cls: 'INCREASED', unit: '$' },
      { param: 'Anodize Step',        from: 'Required',            to: '—',                        cls: 'REMOVED' },
      { param: 'Assembly Fixture',    from: '—',                   to: 'Custom jig JIG-047',       cls: 'ADDED' },
    ],
    parts: [
      { pn: 'EV-ENC-041', desc: 'Sheet Metal Cabinet IP54', rev: { from: 'A', to: 'B' }, impact: 'HIGH', disp: 'REWORK', qty: 240, paths: [['EV-ASM-110 Door Frame', 'EV-ASM-100 Main Assembly'], ['EV-ASM-200 Field Service Kit']] },
      { pn: 'EV-ENC-042', desc: 'Front Door Panel w/ Display Cutout', rev: { from: 'A', to: 'B' }, impact: 'HIGH', disp: 'SCRAP', qty: 180, paths: [['EV-ASM-110 Door Frame', 'EV-ASM-100 Main Assembly']] },
      { pn: 'EV-ENC-043', desc: 'DIN Rail Assembly Kit', rev: { from: 'A', to: 'A' }, impact: 'LOW', disp: 'USE_AS_IS', qty: 0, paths: [['EV-ASM-100 Main Assembly']] },
      { pn: 'EV-ENC-044', desc: 'Pedestal Mounting Base', rev: { from: 'A', to: 'B' }, impact: 'MEDIUM', disp: 'USE_UP_THEN_CHANGE', qty: 95, paths: [['EV-ASM-130 Pedestal Frame', 'EV-ASM-100 Main Assembly']] },
      { pn: 'EV-CHD-034', desc: 'Cable Management Bracket', rev: { from: 'A', to: 'B' }, impact: 'MEDIUM', disp: 'REWORK', qty: 60, paths: [['EV-ASM-120 Harness Sub-Assy', 'EV-ASM-100 Main Assembly']] },
      { pn: 'EV-SAF-062', desc: 'Emergency Stop Button IP65', rev: { from: 'A', to: 'A' }, impact: 'LOW', disp: 'USE_AS_IS', qty: 0, paths: [['EV-ASM-110 Door Frame', 'EV-ASM-100 Main Assembly']] },
    ],
    impact: {
      schedule: 'HIGH', milestones: ['CDR — Critical Design Review', 'MRR — Mfg Readiness'],
      unitCostDelta: 4.55, oneTimeCost: 12400, recert: true, certNotes: 'CE LVD + IEC 61851 re-test',
      impactArea: 'compliance', firmware: false, inventoryQty: 575,
    },
    activity: [
      { actor: 'Sarah Chen',  action: 'RESUBMITTED',  when: 'Apr 20', note: 'Attached 96h salt-spray report; revised artifacts resubmitted to the pipeline.' },
      { actor: 'Marcus Webb', action: 'REJECTED',     when: 'Apr 19', note: 'Rework at QA — salt-spray corrosion data missing for AZ91D.' },
      { actor: 'Dr. Patel',   action: 'APPROVED',     when: 'Apr 17', note: 'Engineering review passed — thermal & structural FEA attached.' },
      { actor: 'Sarah Chen',  action: 'FIELD_CHANGED', when: 'Apr 16', note: 'Wall thickness 3.5 → 3.2 mm after topology optimization.' },
      { actor: 'Sarah Chen',  action: 'ITEM_ADDED',   when: 'Apr 15', note: 'Added EV-CHD-034 Cable Management Bracket (clearance).' },
      { actor: 'Sarah Chen',  action: 'SUBMITTED',    when: 'Apr 15', note: 'Submitted finished artifacts for review (6 affected parts).' },
      { actor: 'Sarah Chen',  action: 'CREATED',      when: 'Apr 14', note: 'Draft created from ECR-2026-088.' },
    ],
    ecn: {
      num: 'ECN-2026-031',
      distribution: ['Dr. Patel', 'Marcus Webb', 'Aiko Kaur', 'James Dean', 'Maria Lopez'],
      recalc: { count: 3, days: 5, gate: 'CDR' },
      tasks: [
        { task: 'Order magnesium die-cast tooling',             assignee: 'Aiko Kaur',   due: 'Jun 09', status: 'todo' },
        { task: 'Update CAD master & release Rev B drawings',   assignee: 'Sarah Chen',  due: 'Jun 05', status: 'todo' },
        { task: 'Revise enclosure work instruction WI-114',     assignee: 'Maria Lopez', due: 'Jun 12', status: 'todo' },
        { task: 'Notify supplier of finish change to RAL 7016', assignee: 'James Dean',  due: 'Jun 04', status: 'todo' },
        { task: 'Schedule CE LVD + IEC 61851 recertification',  assignee: 'Marcus Webb', due: 'Jun 20', status: 'todo' },
      ],
    },
  },

  '046': {
    diff: [
      { param: 'PMIC Part Number',   from: 'TPS65987DDK',  to: 'TPS65990ABRSH', cls: 'MODIFIED' },
      { param: 'Package',            from: 'VQFN-64',      to: 'VQFN-64',       cls: 'MODIFIED' },
      { param: 'Lifecycle Status',   from: 'EOL (LTB Q3)', to: 'Active',         cls: 'IMPROVED' },
      { param: 'Unit Cost',          from: '$3.85',        to: '$3.40',          cls: 'DECREASED', unit: '$' },
    ],
    parts: [
      { pn: 'EV-PCB-002', desc: 'Main Controller PCBA',        rev: { from: 'C', to: 'D' }, impact: 'MEDIUM', disp: 'USE_UP_THEN_CHANGE', qty: 320, paths: [['EV-ASM-100 Main Assembly']] },
      { pn: 'EV-IC-U2',   desc: 'USB-C PD Controller PMIC',    rev: null,                   impact: 'HIGH',   disp: 'RETURN_TO_SUPPLIER',  qty: 500, paths: [['EV-PCB-002 Main Controller PCBA', 'EV-ASM-100 Main Assembly']] },
      { pn: 'EV-DOC-SCH', desc: 'Schematic Sheet 4 — Power',   rev: { from: 'C', to: 'D' }, impact: 'LOW',    disp: 'USE_AS_IS',           qty: 0,   paths: [] },
    ],
    impact: {
      schedule: 'LOW', milestones: ['PVT Build'],
      unitCostDelta: -0.45, oneTimeCost: 0, recert: false, certNotes: '',
      impactArea: 'cost', firmware: true, inventoryQty: 320,
    },
    activity: [
      { actor: 'Linda Torres', action: 'APPROVED',   when: 'Apr 22', note: 'Approved — pin-compatible, no layout change.' },
      { actor: 'Marcus Webb',  action: 'APPROVED',   when: 'Apr 21', note: 'QA: verified register map identical.' },
      { actor: 'James Dean',   action: 'SUBMITTED',  when: 'Apr 19', note: 'EOL swap, last-time-buy window closing Q3.' },
      { actor: 'James Dean',   action: 'CREATED',    when: 'Apr 19', note: 'Draft created.' },
    ],
    ecn: {
      num: 'ECN-2026-030',
      distribution: ['Aiko Kaur', 'James Dean', 'Maria Lopez'],
      recalc: { count: 0, days: 0, gate: 'PVT Build' },
      tasks: [
        { task: 'Run out existing TPS65987 stock (500 units)', assignee: 'Aiko Kaur',  due: 'Jun 30', status: 'todo' },
        { task: 'Place first PO for TPS65990',                 assignee: 'James Dean', due: 'May 30', status: 'todo' },
        { task: 'Confirm firmware PD stack compatibility',     assignee: 'Dr. Patel',  due: 'May 27', status: 'done' },
      ],
    },
  },

  '045': {
    diff: [
      { param: 'CC1/CC2 Protection',       from: 'None',  to: 'TVS Diode Array',   cls: 'ADDED' },
      { param: 'SBU1/SBU2 Protection',     from: 'None',  to: 'ESD Suppressor',    cls: 'ADDED' },
      { param: 'Contact Discharge Rating', from: '4 kV',  to: '8 kV',              cls: 'IMPROVED' },
      { param: 'BOM Line Count',           from: '412',   to: '416',               cls: 'INCREASED' },
    ],
    parts: [
      { pn: 'EV-PCB-002', desc: 'Main Controller PCBA',         rev: { from: 'B', to: 'C' }, impact: 'HIGH',   disp: 'REWORK',     qty: 120, paths: [['EV-ASM-100 Main Assembly']] },
      { pn: 'EV-IC-D14',  desc: 'TVS Diode Array 0.5pF',       rev: null,                   impact: 'MEDIUM', disp: 'USE_AS_IS',  qty: 0,   paths: [['EV-PCB-002 Main Controller PCBA', 'EV-ASM-100 Main Assembly']] },
      { pn: 'EV-IC-D15',  desc: 'ESD Suppressor SBU',           rev: null,                   impact: 'MEDIUM', disp: 'USE_AS_IS',  qty: 0,   paths: [['EV-PCB-002 Main Controller PCBA', 'EV-ASM-100 Main Assembly']] },
      { pn: 'EV-DOC-LAY', desc: 'Layout — USB-C Connector Zone',rev: { from: 'B', to: 'C' }, impact: 'LOW',    disp: 'USE_AS_IS',  qty: 0,   paths: [] },
    ],
    impact: {
      schedule: 'MEDIUM', milestones: ['EMC Pre-Compliance', 'DVT Exit'],
      unitCostDelta: 0.18, oneTimeCost: 3200, recert: true, certNotes: 'Re-run IEC 61000-4-2 ESD; CE re-declaration',
      impactArea: 'safety', firmware: false, inventoryQty: 120,
    },
    activity: [
      { actor: 'Dr. Patel',  action: 'APPROVED',  when: 'Apr 20', note: 'Eng review passed — TVS placement near connector OK.' },
      { actor: 'Aiko Kaur',  action: 'SUBMITTED', when: 'Apr 18', note: 'Critical — blocks EMC sign-off.' },
      { actor: 'Aiko Kaur',  action: 'CREATED',   when: 'Apr 18', note: 'Draft created from ECR-2026-091.' },
    ],
    ecn: null,
  },
};

// Default generators for ECOs without overrides
function defaultDiff(eco: ECOListItem): DiffRow[] {
  return [
    { param: 'Part Number', from: eco.title.split(' ')[0], to: eco.title.split(' ')[0], cls: 'MODIFIED' },
    { param: 'Revision',    from: eco.revFrom, to: eco.revTo, cls: eco.revFrom === eco.revTo ? 'MODIFIED' : 'INCREASED' },
    { param: 'Lead Time',   from: '10 wk',    to: '6 wk',    cls: 'DECREASED', unit: 'wk' },
  ];
}

function defaultParts(eco: ECOListItem): ECOPart[] {
  const r = { from: eco.revFrom, to: eco.revTo };
  const pool: ECOPart[] = [
    { pn: 'EV-GEN-001', desc: 'Primary affected component', rev: r, impact: 'MEDIUM', disp: 'REWORK', qty: 40, paths: [['EV-ASM-100 Main Assembly']] },
    { pn: 'EV-GEN-002', desc: 'Secondary component', rev: r, impact: 'LOW', disp: 'USE_AS_IS', qty: 0, paths: [['EV-ASM-100 Main Assembly']] },
    { pn: 'EV-GEN-003', desc: 'Documentation set', rev: r, impact: 'LOW', disp: 'USE_AS_IS', qty: 0, paths: [] },
    { pn: 'EV-GEN-004', desc: 'Sub-assembly bracket', rev: r, impact: 'MEDIUM', disp: 'USE_UP_THEN_CHANGE', qty: 25, paths: [['EV-ASM-120 Harness Sub-Assy', 'EV-ASM-100 Main Assembly']] },
    { pn: 'EV-GEN-005', desc: 'Fastener pack', rev: { from: eco.revFrom, to: eco.revFrom }, impact: 'LOW', disp: 'USE_AS_IS', qty: 0, paths: [] },
  ];
  return pool.slice(0, Math.max(1, eco.parts));
}

function defaultActivity(eco: ECOListItem): ActivityEntry[] {
  const a: ActivityEntry[] = [
    { actor: eco.originator, action: 'CREATED', when: eco.created, note: `Draft created${eco.ecr ? ' from ' + eco.ecr : ''}.` },
  ];
  if (eco.status !== 'DRAFT') {
    a.unshift({ actor: eco.originator, action: 'SUBMITTED', when: eco.created, note: 'Submitted finished artifacts for review.' });
  }
  if (['APPROVED', 'RELEASED', 'VERIFIED', 'CLOSED'].includes(eco.status)) {
    a.unshift({ actor: eco.owner, action: 'APPROVED', when: eco.target, note: 'All approval steps resolved — authorized for release.' });
  }
  if (eco.status === 'REWORK') {
    a.unshift({ actor: eco.owner, action: 'REJECTED', when: eco.target, note: 'Returned to originator for artifact revision.' });
  }
  if (['RELEASED', 'VERIFIED', 'CLOSED'].includes(eco.status)) {
    a.unshift({ actor: eco.owner, action: 'RELEASED', when: eco.target, note: 'ECN generated & distributed — change promoted to released state.' });
  }
  if (['VERIFIED', 'CLOSED'].includes(eco.status)) {
    a.unshift({ actor: eco.owner, action: 'VERIFIED', when: eco.target, note: 'Implementation verified — effectivity cut-in confirmed.' });
  }
  if (eco.status === 'CLOSED') {
    a.unshift({ actor: eco.owner, action: 'CLOSED', when: eco.target, note: 'ECO/ECN closed.' });
  }
  return a;
}

export function buildDetail(eco: ECOListItem): ECODetail {
  const ov = DETAIL_OVERRIDES[eco.id] ?? {};
  const steps = pipelineForStatus(eco.status, PIPELINE_TEMPLATE);
  return {
    ...eco,
    parts: ov.parts ?? defaultParts(eco),
    steps,
    rejections: ov.rejections ?? [],
    diff: ov.diff ?? defaultDiff(eco),
    impact: ov.impact ?? {
      schedule: 'MEDIUM', milestones: ['DVT Exit'], unitCostDelta: 0, oneTimeCost: 0,
      recert: false, certNotes: '', impactArea: null, firmware: eco.modules.includes('firmware'), inventoryQty: 0,
    },
    activity: ov.activity ?? defaultActivity(eco),
    ecn: ov.ecn !== undefined
      ? ov.ecn
      : {
          num: `ECN-2026-0${20 + (Number(eco.id) % 20)}`,
          distribution: [eco.owner, eco.originator],
          recalc: { count: 1, days: 3, gate: 'DVT Exit' },
          tasks: [{ task: 'Update master records', assignee: eco.owner, due: eco.target, status: 'todo' }],
        },
  };
}

// ── Activity metadata ─────────────────────────────────────────────────────────

export interface ActivityMeta { icon: string; color: string }

export const ACTIVITY_META: Record<string, ActivityMeta> = {
  CREATED:      { icon: 'Plus',          color: '#6B7280' },
  SUBMITTED:    { icon: 'Send',          color: '#2563EB' },
  ITEM_ADDED:   { icon: 'Package',       color: '#9333EA' },
  FIELD_CHANGED:{ icon: 'Pencil',        color: '#F59E0B' },
  COMMENTED:    { icon: 'MessageCircle', color: '#6B7280' },
  APPROVED:     { icon: 'CheckCircle',   color: '#16A34A' },
  REJECTED:     { icon: 'XCircle',       color: '#DC2626' },
  RESUBMITTED:  { icon: 'RefreshCw',     color: '#2563EB' },
  RELEASED:     { icon: 'GitBranch',     color: '#2563EB' },
  VERIFIED:     { icon: 'ClipboardCheck',color: '#9333EA' },
  CLOSED:       { icon: 'Check',         color: '#16A34A' },
  CANCELLED:    { icon: 'Slash',         color: '#6B7280' },
};

// ── API adapters (backend → frontend types) ───────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fromApiEcoListItem(raw: ApiEcoListItem): ECOListItem {
  return {
    id:          raw.id,
    num:         raw.num,
    title:       raw.title,
    desc:        raw.description ?? '',
    type:        raw.type.toUpperCase() as ECOType,
    typeOther:   raw.typeOther ?? null,
    status:      raw.status.toUpperCase() as ECOStatus,
    priority:    raw.priority.toUpperCase() as ECOPriority,
    reason:      raw.reason.toUpperCase() as ECOReason,
    reasonOther: raw.reasonOther ?? null,
    changeClass: raw.changeClass as ChangeClass,
    ecr:         raw.originatingEcr,
    effectivity: {
      type:  (raw.effectivityType?.toUpperCase() ?? 'DATE') as EffectivityType,
      value: raw.effectivityValue ?? '',
    },
    originator:  raw.originatorName ?? '—',
    owner:       raw.ownerName ?? '—',
    created:     fmtDate(raw.initiatedAt),
    target:      raw.targetDate ? fmtDate(raw.targetDate) : '—',
    revFrom:     raw.revFrom ?? '',
    revTo:       raw.revTo ?? '',
    parts:       raw.partCount,
    docs:        [],
    modules:     [],
    awaitingMe:  raw.awaitingMe,
  };
}

function fromApiPart(raw: ApiEcoPart): ECOPart {
  return {
    pn:       raw.partNumber,
    partId:   raw.partId,
    bomNodeId: raw.bomNodeId ?? undefined,
    name:     raw.name,
    desc:   raw.description,
    rev:    (raw.revFrom || raw.revTo)
              ? { from: raw.revFrom ?? '', to: raw.revTo ?? '' }
              : null,
    impact: raw.impactLevel.toUpperCase() as ImpactLevel,
    disp:   raw.disposition.toUpperCase() as ECODisposition,
    qty:    raw.qty ?? 0,
    paths:  raw.whereUsedPaths,
  };
}

function fromApiStep(raw: ApiEcoPipelineStep): PipelineStep {
  const decUp = raw.decision.toUpperCase() as DecisionType;
  let date: string | undefined;
  if (raw.decidedAt) date = fmtDate(raw.decidedAt);
  else if (raw.decision === 'active') date = 'In review';
  else if (raw.decision === 'pending') date = 'Pending';
  return {
    order:         raw.order,
    stage:         raw.stageLabel,
    name:          raw.approverName ?? '—',
    role:          raw.approverRole ?? '—',
    approverId:    raw.approverUserId ?? null,
    optional:      raw.isOptional,
    optionalReason: raw.optionalReason ?? undefined,
    justification:  raw.justification ?? undefined,
    decision:       decUp,
    date,
    note:          raw.note ?? null,
    decidedById:   raw.decidedBy ?? null,
    decidedByName: raw.decidedByName ?? null,
  };
}

export function rejectionsFromSteps(steps: ApiEcoPipelineStep[]): Rejection[] {
  return steps
    .filter((s) => s.decision === 'rejected')
    .sort((a, b) => (a.decidedAt ?? '').localeCompare(b.decidedAt ?? ''))
    .map((s) => ({
      stage:  s.stageLabel,
      by:     s.decidedByName ?? s.approverName ?? '—',
      when:   s.decidedAt ? fmtDate(s.decidedAt) : '—',
      reason: s.note ?? '',
    }));
}

function fromApiDiffRow(raw: ApiEcoDiffRow): DiffRow {
  return {
    param: raw.parameter,
    from:  raw.fromValue ?? '',
    to:    raw.toValue ?? '',
    cls:   raw.changeLabel.toUpperCase() as ChangeLabel,
  };
}

function fromApiActivity(raw: ApiEcoActivity): ActivityEntry {
  const actionKey = raw.type.replace(/^eco\./, '').toUpperCase();
  return {
    actor: raw.userName ?? '—',
    action: actionKey,
    when:   fmtDate(raw.createdAt),
    note:   raw.description ?? raw.title,
  };
}

export function fromApiEcoDetail(raw: ApiEcoDetail): ECODetail {
  const base = fromApiEcoListItem(raw);
  return {
    ...base,
    modules:  raw.modules.map(m => m.name),
    parts:    raw.parts.map(fromApiPart),
    steps:    raw.steps.map(fromApiStep),
    rejections: rejectionsFromSteps(raw.steps),
    diff:     raw.diffRows.map(fromApiDiffRow),
    impact: {
      schedule:     (raw.scheduleImpact?.toUpperCase() ?? 'MEDIUM') as ImpactLevel,
      milestones:   [],
      unitCostDelta: raw.unitCostDelta ?? 0,
      oneTimeCost:   raw.oneTimeCost ?? 0,
      recert:        raw.requiresRecertification,
      certNotes:     raw.certNotes ?? '',
      impactArea:    raw.impactArea ?? null,
      firmware:      raw.firmwareCoupling,
      inventoryQty:  raw.inventoryQty ?? 0,
    },
    activity: raw.activities.map(fromApiActivity),
    ecn: raw.ecn
      ? {
          num:          raw.ecn.num,
          distribution: raw.ecn.distributionList.map(d => d.name),
          recalc:       { count: 0, days: 0, gate: '' },
          tasks:        raw.ecn.implementationTasks.map(t => ({
            task:     t.task,
            assignee: '—',
            due:      '—',
            status:   (t.done ? 'done' : 'todo') as 'done' | 'todo',
          })),
        }
      : null,
  };
}
