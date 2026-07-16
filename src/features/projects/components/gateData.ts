export type GateStatus = 'done' | 'active' | 'upcoming';
export type CriteriaStatus = 'pass' | 'partial' | 'fail' | 'na';
export type ReviewerState = 'signed' | 'pending' | 'blocked';
export type GateRecommendation = 'go' | 'conditional' | 'hold' | 'nogo';

export interface GatePhase {
  id: string;
  label: string;
  startPct: number;
  endPct: number;
  status: GateStatus;
}

export interface GateMilestone {
  id: string;
  phase: string;
  gate: string;
  owner: string;
  ownerIdx: number;
  due: string;
  pct: number;
  status: GateStatus;
  tasks: number;
  openIssues: number;
}

export interface CriteriaItem {
  name: string;
  metric: string;
  status: CriteriaStatus;
}

export interface CriteriaGroup {
  key: string;
  label: string;
  iconKey: string;
  source: string;
  items: CriteriaItem[];
}

export interface GateSubscore {
  key: string;
  label: string;
  score: number;
  status: CriteriaStatus;
  iconKey: string;
}

export interface GateReviewer {
  name: string;
  role: string;
  idx: number;
  state: ReviewerState;
}

export interface GateEvidence {
  name: string;
  meta: string;
  iconKey: string;
}

export interface GateKpi {
  label: string;
  value: string;
  sub?: string;
  token: string;
  iconKey: string;
}

export interface GateDetail {
  gate: string;
  phase: string;
  dualLabel: string;
  title: string;
  owner: string;
  ownerIdx: number;
  due: string;
  daysTo: number;
  status: string;
  readiness: number;
  recommendation: GateRecommendation;
  kpis: GateKpi[];
  subscores: GateSubscore[];
  groups: CriteriaGroup[];
  reviewers: GateReviewer[];
  evidence: GateEvidence[];
}

export const GATE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

export const GATE_PHASES: GatePhase[] = [
  { id: 'concept', label: 'Concept',     startPct: 0,  endPct: 15,  status: 'done' },
  { id: 'pdr',     label: 'PDR',         startPct: 15, endPct: 30,  status: 'done' },
  { id: 'cdr',     label: 'CDR',         startPct: 30, endPct: 50,  status: 'done' },
  { id: 'mrr',     label: 'MRR',         startPct: 50, endPct: 62,  status: 'active' },
  { id: 'pilot',   label: 'Pilot Build', startPct: 62, endPct: 80,  status: 'upcoming' },
  { id: 'mass',    label: 'Mass Prod.',  startPct: 80, endPct: 100, status: 'upcoming' },
];

export const GATE_MILESTONES: GateMilestone[] = [
  { id: 'g0', phase: 'Concept',     gate: 'Gate 0', owner: 'Sarah Chen',   ownerIdx: 0, due: 'Jan 31, 2026', pct: 100, status: 'done',     tasks: 12, openIssues: 0 },
  { id: 'g1', phase: 'PDR',         gate: 'Gate 1', owner: 'Dr. Patel',    ownerIdx: 1, due: 'Feb 28, 2026', pct: 100, status: 'done',     tasks: 24, openIssues: 0 },
  { id: 'g2', phase: 'CDR',         gate: 'Gate 2', owner: 'Marcus Webb',  ownerIdx: 4, due: 'Mar 31, 2026', pct: 100, status: 'done',     tasks: 38, openIssues: 2 },
  { id: 'g3', phase: 'MRR',         gate: 'Gate 3', owner: 'Linda Torres', ownerIdx: 5, due: 'May 15, 2026', pct: 62,  status: 'active',   tasks: 41, openIssues: 5 },
  { id: 'g4', phase: 'Pilot Build', gate: 'Gate 4', owner: 'James Okafor', ownerIdx: 3, due: 'Jul 31, 2026', pct: 0,   status: 'upcoming', tasks: 56, openIssues: 0 },
  { id: 'g5', phase: 'Mass Prod.',  gate: 'Gate 5', owner: 'TBD',          ownerIdx: 2, due: 'Oct 1, 2026',  pct: 0,   status: 'upcoming', tasks: 62, openIssues: 0 },
];

export const GATE_DETAILS: Record<string, GateDetail> = {
  g3: {
    gate: 'Gate 3', phase: 'MRR', dualLabel: 'DVT',
    title: 'Manufacturing Readiness Review',
    owner: 'Linda Torres', ownerIdx: 5,
    due: 'May 15, 2026', daysTo: 22, status: 'In Review',
    readiness: 78, recommendation: 'conditional',
    kpis: [
      { label: 'Readiness Score', value: '78', sub: '/ 100', token: '--priority-medium',    iconKey: 'activity' },
      { label: 'Criteria Met',    value: '9 / 16',           token: '--status-in-progress', iconKey: 'clipboard-check' },
      { label: 'Open Blockers',   value: '3',                token: '--status-blocked',     iconKey: 'alert-triangle' },
      { label: 'Days to Gate',    value: '22',               token: '--priority-medium',    iconKey: 'clock' },
    ],
    subscores: [
      { key: 'req',  label: 'Requirements',      score: 91, status: 'pass',    iconKey: 'git-branch' },
      { key: 'bom',  label: 'BOM / Procurement', score: 71, status: 'partial', iconKey: 'boxes' },
      { key: 'risk', label: 'Risk Register',     score: 58, status: 'fail',    iconKey: 'shield' },
      { key: 'dfm',  label: 'DFM / Mfg',         score: 83, status: 'partial', iconKey: 'factory' },
      { key: 'test', label: 'Test / Cert',        score: 74, status: 'partial', iconKey: 'activity' },
      { key: 'ext',  label: 'External Deps',      score: 62, status: 'fail',    iconKey: 'truck' },
    ],
    groups: [
      {
        key: 'req', label: 'Requirements & Traceability', iconKey: 'git-branch', source: 'Requirements module',
        items: [
          { name: 'All Class-A requirements verified', metric: '48 / 48 verified', status: 'pass' },
          { name: 'Requirement traceability ≥ 90%', metric: '91% traced (142 / 156)', status: 'pass' },
          { name: 'No open requirement change requests', metric: '2 open CRs', status: 'partial' },
        ],
      },
      {
        key: 'bom', label: 'BOM & Procurement', iconKey: 'boxes', source: 'BOM · Procurement',
        items: [
          { name: 'BOM sourced ≥ 95%', metric: '88% sourced', status: 'partial' },
          { name: 'Second-source coverage on critical parts ≥ 80%', metric: '64% covered', status: 'fail' },
          { name: 'Long-lead items ordered', metric: '3 of 6 unordered', status: 'partial' },
        ],
      },
      {
        key: 'risk', label: 'Risk Register', iconKey: 'shield', source: 'Risk module',
        items: [
          { name: 'No open risks ≥ High severity', metric: '2 open High risks', status: 'fail' },
          { name: 'FMEA reviewed & signed', metric: 'Complete · 4 reviewers', status: 'pass' },
        ],
      },
      {
        key: 'dfm', label: 'DFM / Manufacturing', iconKey: 'factory', source: 'Manufacturing Readiness',
        items: [
          { name: 'Zero open High DFM findings', metric: '1 open High finding', status: 'partial' },
          { name: 'CM line-readiness assessment', metric: 'Complete · Foxlink', status: 'pass' },
          { name: 'First-article inspection plan approved', metric: 'Approved Apr 28', status: 'pass' },
        ],
      },
      {
        key: 'test', label: 'Test & Certification', iconKey: 'activity', source: 'Test campaigns · Cert',
        items: [
          { name: 'DVT test campaign complete', metric: '76% · 38 of 50 cases', status: 'partial' },
          { name: 'EMC / FCC pre-scan passed', metric: 'Scheduled Jun 12 · ext. lab', status: 'partial' },
          { name: 'HALT reliability report', metric: 'Complete · 0 escapes', status: 'pass' },
        ],
      },
      {
        key: 'ext', label: 'External Dependencies', iconKey: 'truck', source: 'Long-lead · Cert lab',
        items: [
          { name: 'Enclosure tooling delivered', metric: '11 wk lead · 2 wk over buffer', status: 'fail' },
          { name: 'Certification lab slot booked', metric: 'Booked Jun 12', status: 'pass' },
        ],
      },
    ],
    reviewers: [
      { name: 'Linda Torres', role: 'Phase Owner · Eng Lead', idx: 5, state: 'signed' },
      { name: 'Dr. Patel',    role: 'Quality & Reliability',  idx: 1, state: 'signed' },
      { name: 'Marcus Webb',  role: 'Hardware',               idx: 4, state: 'pending' },
      { name: 'James Okafor', role: 'Manufacturing',          idx: 3, state: 'blocked' },
      { name: 'Sarah Chen',   role: 'Program · PM',           idx: 0, state: 'pending' },
    ],
    evidence: [
      { name: 'DVT Test Report v3', meta: 'PDF · 4.2 MB · Apr 29',  iconKey: 'file-text' },
      { name: 'FMEA worksheet',     meta: 'XLSX · updated 2d ago',   iconKey: 'shield' },
      { name: 'DFM findings export',meta: 'CSV · 1 open High',       iconKey: 'factory' },
      { name: 'BOM cost roll-up',   meta: 'Live · Procurement',      iconKey: 'boxes' },
    ],
  },
};

export function gateCriteriaColor(status: CriteriaStatus): string {
  switch (status) {
    case 'pass':    return 'hsl(var(--status-done))';
    case 'partial': return 'hsl(var(--priority-medium))';
    case 'fail':    return 'hsl(var(--status-blocked))';
    case 'na':      return 'hsl(var(--muted-foreground))';
  }
}

export function gateStatusColor(status: GateStatus): string {
  switch (status) {
    case 'done':     return 'hsl(var(--status-done))';
    case 'active':   return 'hsl(var(--status-in-progress))';
    case 'upcoming': return 'hsl(var(--muted-foreground))';
  }
}

export const OWNER_PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--status-review))',
];


