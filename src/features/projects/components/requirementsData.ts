// Requirements data model — types, enums, mock data, and helpers

// ── Team mock ────────────────────────────────────────────────────────────────
export interface TeamMember { id: string; name: string; initials: string; color: string; }
export const REQ_TEAM: TeamMember[] = [
  { id: 'tm-1', name: 'Sana Arif',    initials: 'SA', color: '#7C3AED' },
  { id: 'tm-2', name: 'Marcus Lee',   initials: 'ML', color: '#2563EB' },
  { id: 'tm-3', name: 'Kabir Anand',  initials: 'KA', color: '#059669' },
  { id: 'tm-4', name: 'Jin Park',     initials: 'JP', color: '#D97706' },
  { id: 'tm-5', name: 'Nina Torres',  initials: 'NT', color: '#DC2626' },
  { id: 'tm-6', name: 'Aria Roy',     initials: 'AR', color: '#0891B2' },
];
const own = (i: number) => REQ_TEAM[i % REQ_TEAM.length].id;
export const ownerOf = (id: string): TeamMember =>
  REQ_TEAM.find(m => m.id === id) ?? { id, name: '—', initials: '?', color: '#888' };

// ── Enum types ────────────────────────────────────────────────────────────────
export type ReqType = 'stakeholder-need' | 'stakeholder-req' | 'system-req' | 'subsystem-req' | 'component-req';
export type ReqCategory = 'functional' | 'performance' | 'interface' | 'constraint' | 'quality' | 'regulatory';
export type ReqStatus = 'draft' | 'reviewed' | 'approved' | 'verified' | 'validated' | 'obsolete';
export type ReqVMethod = 'test' | 'analysis' | 'inspection' | 'demonstration';
export type ReqVStatus = 'not-verified' | 'in-progress' | 'passed' | 'failed' | 'waived';
export type ReqPriority = 'critical' | 'high' | 'medium' | 'low';
export type ReqGroup = 'SYS' | 'PWR' | 'CTL' | 'CHD' | 'ENC' | 'HMI' | 'SAF' | 'SEC' | 'STK';

// ── Display metadata ──────────────────────────────────────────────────────────
export const REQ_TYPE: Record<ReqType, { label: string; short: string; tier: number; tint: string }> = {
  'stakeholder-need': { label: 'Stakeholder Need', short: 'Need',      tier: 0, tint: '#64748B' },
  'stakeholder-req':  { label: 'Stakeholder Req',  short: 'Stk Req',   tier: 1, tint: '#64748B' },
  'system-req':       { label: 'System Req',       short: 'System',    tier: 2, tint: '#2563EB' },
  'subsystem-req':    { label: 'Subsystem Req',    short: 'Subsystem', tier: 3, tint: '#9333EA' },
  'component-req':    { label: 'Component Req',    short: 'Component', tier: 4, tint: '#16A34A' },
};
export const REQ_CATEGORY: Record<ReqCategory, { label: string; tint: string }> = {
  functional:  { label: 'Functional',  tint: '#2563EB' },
  performance: { label: 'Performance', tint: '#9333EA' },
  interface:   { label: 'Interface',   tint: '#0EA5E9' },
  constraint:  { label: 'Constraint',  tint: '#D97706' },
  quality:     { label: 'Quality',     tint: '#16A34A' },
  regulatory:  { label: 'Regulatory',  tint: '#DC2626' },
};
export const REQ_STATUS: Record<ReqStatus, { label: string; tint: string; step: number }> = {
  draft:     { label: 'Draft',     tint: '#94A3B8', step: 0 },
  reviewed:  { label: 'Reviewed',  tint: '#0EA5E9', step: 1 },
  approved:  { label: 'Approved',  tint: '#2563EB', step: 2 },
  verified:  { label: 'Verified',  tint: '#9333EA', step: 3 },
  validated: { label: 'Validated', tint: '#16A34A', step: 4 },
  obsolete:  { label: 'Obsolete',  tint: '#A1A1AA', step: -1 },
};
export const REQ_STATUS_FLOW: ReqStatus[] = ['draft', 'reviewed', 'approved', 'verified', 'validated'];
export const REQ_VMETHOD: Record<ReqVMethod, { label: string }> = {
  test:          { label: 'Test' },
  analysis:      { label: 'Analysis' },
  inspection:    { label: 'Inspection' },
  demonstration: { label: 'Demonstration' },
};
export const REQ_VSTATUS: Record<ReqVStatus, { label: string; tint: string }> = {
  'not-verified': { label: 'Not Verified', tint: '#94A3B8' },
  'in-progress':  { label: 'In Progress',  tint: '#D97706' },
  passed:         { label: 'Passed',       tint: '#16A34A' },
  failed:         { label: 'Failed',       tint: '#DC2626' },
  waived:         { label: 'Waived',       tint: '#64748B' },
};
export const REQ_PRIORITY: Record<ReqPriority, { label: string; tint: string; rank: number }> = {
  critical: { label: 'Critical', tint: '#DC2626', rank: 0 },
  high:     { label: 'High',     tint: '#D97706', rank: 1 },
  medium:   { label: 'Medium',   tint: '#CA8A04', rank: 2 },
  low:      { label: 'Low',      tint: '#64748B', rank: 3 },
};
export const REQ_GROUP: Record<ReqGroup, { label: string; tint: string; icon: string }> = {
  SYS: { label: 'System',              tint: '#2563EB', icon: 'Boxes' },
  PWR: { label: 'Power Electronics',   tint: '#9333EA', icon: 'Zap' },
  CTL: { label: 'Control & Comms',     tint: '#2563EB', icon: 'Cpu' },
  CHD: { label: 'Charging Connectors', tint: '#16A34A', icon: 'Package' },
  ENC: { label: 'Enclosure & Mech.',   tint: '#D97706', icon: 'Box' },
  HMI: { label: 'HMI & Interface',     tint: '#0EA5E9', icon: 'Monitor' },
  SAF: { label: 'Safety & Protection', tint: '#DC2626', icon: 'Shield' },
  SEC: { label: 'Security',            tint: '#9333EA', icon: 'Lock' },
  STK: { label: 'Stakeholder',         tint: '#64748B', icon: 'Flag' },
};
export const REQ_LINKTYPE: Record<string, { label: string; dir: 'up' | 'down' | 'side' }> = {
  derives_from:     { label: 'Derives from',     dir: 'up' },
  refines:          { label: 'Refines',          dir: 'up' },
  traces_to_source: { label: 'Traces to source', dir: 'up' },
  refined_by:       { label: 'Refined by',       dir: 'down' },
  satisfies:        { label: 'Satisfied by',     dir: 'down' },
  implements:       { label: 'Implemented by',   dir: 'down' },
  verifies:         { label: 'Verified by',      dir: 'down' },
  validates:        { label: 'Validated by',     dir: 'down' },
  allocated_to:     { label: 'Allocated to',     dir: 'down' },
  depends_on:       { label: 'Depends on',       dir: 'side' },
  conflicts_with:   { label: 'Conflicts with',   dir: 'side' },
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ReqTarget { value: number; tolerance: string; unit: string; }
export interface ReqLink {
  type: string; target: string; status: 'valid' | 'suspect';
  external?: boolean; kind?: 'part' | 'test'; result?: ReqVStatus;
}
export interface ReqCoverage {
  orphan: boolean; untested: boolean; unimplemented: boolean; suspect: boolean;
}
export interface Requirement {
  key: string; parent: string | null; type: ReqType; category: ReqCategory;
  priority: ReqPriority; status: ReqStatus; vmethod: ReqVMethod; vstatus: ReqVStatus;
  owner: string; title: string; statement: string; rationale: string; source: string;
  standard: string | null; target: ReqTarget | null; version: string; baselines: string[];
  alloc: string[]; depends: string[]; conflicts: string[]; suspect: boolean;
  updated: string; group: ReqGroup; childKeys: string[]; links: ReqLink[];
  coverage: ReqCoverage; hasGap: boolean; _seq: number;
}
export interface PhaseGate { id: string; name: string; short: string; date: string; state: 'passed' | 'current' | 'upcoming'; }
export interface ComplianceStandard { code: string; title: string; domain: string; }

// ── Gap metadata ──────────────────────────────────────────────────────────────
export const GAP_META = {
  orphan:        { icon: 'Unlink',        tint: '#DC2626', label: 'Orphan — no source link' },
  unimplemented: { icon: 'PackageX',      tint: '#D97706', label: 'Unimplemented — not allocated' },
  untested:      { icon: 'FlaskConical',  tint: '#D97706', label: 'Untested — no verification' },
  suspect:       { icon: 'AlertTriangle', tint: '#DC2626', label: 'Suspect link — upstream changed' },
} as const;

// ── Data builder ──────────────────────────────────────────────────────────────
let SEQ = 0;
const mk = (o: Partial<Requirement>): Requirement => ({
  version: '1.0', rationale: '', source: '', target: null, baselines: ['BL-2.0'],
  alloc: [], depends: [], conflicts: [], suspect: false, standard: null,
  updated: 'Apr 2026', group: 'SYS', childKeys: [], links: [],
  coverage: { orphan: false, untested: false, unimplemented: false, suspect: false },
  hasGap: false, _seq: SEQ++,
  ...o,
} as Requirement);

const groupOf = (key: string): ReqGroup => {
  const m = key.match(/^([A-Z]+)/);
  const p = m ? m[1] : 'SYS';
  if (p === 'STKN' || p === 'STK') return 'STK';
  if (p === 'MEC' || p === 'ENV') return 'ENC';
  if (p === 'UI') return 'HMI';
  if (p === 'REG') return 'SAF';
  if (p === 'NET') return 'CTL';
  return (REQ_GROUP[p as ReqGroup] ? p : 'SYS') as ReqGroup;
};

// ── Stakeholder needs & reqs ──────────────────────────────────────────────────
const REQS: Requirement[] = [
  mk({ key:'STKN-001', parent:null, type:'stakeholder-need', category:'functional', priority:'critical', status:'validated', vmethod:'demonstration', vstatus:'passed', owner:own(4),
    title:'Drivers can charge an EV quickly',
    statement:'The charging station shall enable EV drivers to add meaningful range to a vehicle in the shortest practical time.',
    rationale:'Charge time is the primary purchase driver for public DC fast charging; benchmarked against competitor 150–350kW stations.' }),
  mk({ key:'STKN-002', parent:null, type:'stakeholder-need', category:'regulatory', priority:'critical', status:'validated', vmethod:'inspection', vstatus:'passed', owner:own(3),
    title:'Sites operate safely and to code',
    statement:'The charging station shall protect people and property and comply with applicable electrical and EVSE safety codes.',
    rationale:'Required for permitting, insurance, and UL/CE listing; non-negotiable for deployment.' }),
  mk({ key:'STKN-003', parent:null, type:'stakeholder-need', category:'functional', priority:'high', status:'approved', vmethod:'demonstration', vstatus:'in-progress', owner:own(2),
    title:'Operators monitor and bill remotely',
    statement:'The charging station shall let network operators remotely monitor sessions, manage availability, and bill users.',
    rationale:'Operators run hundreds of stations; remote operations and OCPP billing are core to the business model.' }),
  mk({ key:'STKN-004', parent:null, type:'stakeholder-need', category:'quality', priority:'high', status:'approved', vmethod:'analysis', vstatus:'in-progress', owner:own(0),
    title:'Stations stay available',
    statement:'The charging station shall achieve high field availability with minimal unplanned downtime.',
    rationale:'Uptime drives revenue and network reputation; SLA target is ≥99% station availability.' }),
  mk({ key:'STKN-005', parent:null, type:'stakeholder-need', category:'quality', priority:'medium', status:'reviewed', vmethod:'inspection', vstatus:'not-verified', owner:own(5),
    title:'Technicians can service stations',
    statement:'The charging station shall support field service with replaceable modules and clear diagnostics.',
    rationale:'Mean-time-to-repair affects availability and operating cost; modular design reduces truck rolls.' }),
  mk({ key:'STK-001', parent:'STKN-001', type:'stakeholder-req', category:'performance', priority:'critical', status:'verified', vmethod:'test', vstatus:'passed', owner:own(0),
    title:'Deliver ≥150 kW continuous DC',
    statement:'The charging station shall deliver at least 150 kW of continuous DC power to a connected vehicle.',
    target:{ value:150, tolerance:'+0 / −5', unit:'kW' },
    rationale:'150 kW adds ~250 km of range in ~20 minutes for a typical 70 kWh pack.' }),
  mk({ key:'STK-002', parent:'STKN-001', type:'stakeholder-req', category:'interface', priority:'critical', status:'approved', vmethod:'test', vstatus:'in-progress', owner:own(5),
    title:'Support CCS2, CHAdeMO and Type 2',
    statement:'The charging station shall support charging vehicles equipped with CCS2, CHAdeMO, or Type 2 connectors.',
    rationale:'Mixed fleet compatibility maximizes addressable vehicles per site.' }),
  mk({ key:'STK-003', parent:'STKN-002', type:'stakeholder-req', category:'regulatory', priority:'critical', status:'verified', vmethod:'inspection', vstatus:'passed', owner:own(3),
    title:'Protect users from electrical hazards',
    statement:'The charging station shall prevent user exposure to hazardous voltages under normal and single-fault conditions.',
    standard:'IEC 61851-1', rationale:'Core electrical-safety obligation for public EVSE.' }),
  mk({ key:'STK-004', parent:'STKN-002', type:'stakeholder-req', category:'regulatory', priority:'high', status:'approved', vmethod:'inspection', vstatus:'in-progress', owner:own(3),
    title:'Meet EVSE listing standards',
    statement:'The charging station shall comply with IEC 62196, IEC 61851, and UL 2202 for DC charging equipment.',
    standard:'IEC 62196', rationale:'Listing is a precondition for sale and grid interconnection.' }),
  mk({ key:'STK-005', parent:'STKN-003', type:'stakeholder-req', category:'interface', priority:'high', status:'approved', vmethod:'demonstration', vstatus:'in-progress', owner:own(2),
    title:'Remote management over OCPP',
    statement:'The charging station shall interoperate with operator back-ends using the Open Charge Point Protocol.',
    rationale:'OCPP is the network-operator standard for session control and billing.' }),
  mk({ key:'STK-006', parent:'STKN-004', type:'stakeholder-req', category:'quality', priority:'high', status:'reviewed', vmethod:'analysis', vstatus:'not-verified', owner:own(0),
    title:'≥99% station availability',
    statement:'The charging station shall achieve at least 99% monthly availability averaged across the fleet.',
    target:{ value:99, tolerance:'≥', unit:'%' }, rationale:'Contractual SLA with site hosts.' }),
];

// ── System requirements ───────────────────────────────────────────────────────
type SysRow = [string,string,ReqCategory,ReqPriority,ReqStatus,ReqVMethod,ReqVStatus,number,string,string,ReqTarget|null,Record<string,unknown>?];
const SYS: SysRow[] = [
  ['SYS-001','STK-001','performance','critical','verified','test','passed',0,'Rated DC output power','The charging station shall provide a rated DC output of 150 kW into a 200–920 V vehicle battery.',{value:150,tolerance:'±2',unit:'kW'},{ alloc:['EV-PWR-010'], source:'STK-001' }],
  ['SYS-002','STK-001','functional','high','verified','test','passed',0,'Dual-port simultaneous charging','Where two vehicles are connected, the charging station shall share available power across both ports without interruption.',null,{ alloc:['EV-CS-001'], source:'STK-001' }],
  ['SYS-003','STK-001','performance','high','approved','analysis','in-progress',0,'Thermal management of power stage','While delivering rated power, the charging station shall keep all power-stage junction temperatures within rated limits.',{value:125,tolerance:'max',unit:'°C'},{ alloc:['EV-PWR-010'], source:'STK-001' }],
  ['SYS-004','STK-003','functional','critical','verified','test','passed',3,'Connector interlock','While a connector is energized, the charging station shall prevent it from being unlatched from the vehicle.',null,{ alloc:['EV-CHD-030'], source:'IEC 61851-1' }],
  ['SYS-005','STK-003','regulatory','critical','verified','test','passed',3,'Ground-fault protection','If a ground fault exceeding the trip threshold is detected, then the charging station shall de-energize the output within the required time.',{value:20,tolerance:'max',unit:'mA'},{ alloc:['EV-SAF-061'], standard:'IEC 62955', source:'STK-003' }],
  ['SYS-006','STK-003','functional','critical','approved','demonstration','in-progress',3,'Emergency stop','When the emergency-stop control is actuated, the charging station shall remove power from all outputs within 1 second.',{value:1,tolerance:'max',unit:'s'},{ alloc:['EV-SAF-062'], source:'STK-003' }],
  ['SYS-007','STK-005','interface','high','approved','demonstration','in-progress',2,'OCPP 2.0.1 back-end interface','The charging station shall communicate with the operator back-end using OCPP 2.0.1 over a secure WebSocket connection.',null,{ alloc:['EV-CTL-025'], source:'STK-005' }],
  ['SYS-008','STK-005','functional','medium','approved','test','in-progress',2,'User authentication','Before starting a billed session, the charging station shall authenticate the user via RFID or app.',null,{ alloc:['EV-HMI-052'], source:'STK-005' }],
  ['SYS-009','STK-004','constraint','high','verified','inspection','passed',5,'Ingress protection','The charging station enclosure shall provide IP54 ingress protection for outdoor installation.',{value:54,tolerance:'min',unit:'IP'},{ alloc:['EV-ENC-041'], standard:'IEC 60529', source:'STK-004' }],
  ['SYS-010','STKN-001','interface','medium','approved','demonstration','passed',2,'Driver interface','The charging station shall present charging status and instructions on a daylight-readable display.',null,{ alloc:['EV-HMI-051'], source:'STKN-001' }],
  ['SYS-011','STK-003','regulatory','high','approved','test','in-progress',3,'Surge protection','The charging station shall withstand and divert grid surges up to 40 kA without damage.',{value:40,tolerance:'min',unit:'kA'},{ alloc:['EV-SAF-063'], standard:'IEC 61643', source:'STK-003' }],
  ['SYS-012','STKN-005','functional','medium','reviewed','demonstration','not-verified',1,'Field firmware update','The charging station shall support signed over-the-air firmware updates without on-site service.',null,{ alloc:['EV-CTL-020'], source:'STKN-005' }],
  ['SYS-013','STK-006','quality','high','draft','analysis','not-verified',0,'Output regulation','While charging, the charging station shall regulate DC output voltage within ±1% of setpoint.',{value:1,tolerance:'±',unit:'%'},{ source:'STK-006', suspect:true }],
  ['SYS-014','STK-002','interface','high','approved','test','in-progress',5,'Plug-and-charge handshake','When a vehicle is connected, the charging station shall complete the ISO 15118 handshake before energizing.',null,{ alloc:['EV-CHD-031'], standard:'ISO 15118', source:'STK-002' }],
];
SYS.forEach(r => REQS.push(mk({
  key:r[0], parent:r[1], type:'system-req', category:r[2], priority:r[3], status:r[4],
  vmethod:r[5], vstatus:r[6], owner:own(r[7]), title:r[8], statement:r[9], target:r[10],
  ...(r[11] ?? {}),
})));

// ── Subsystem requirements ────────────────────────────────────────────────────
type SubRow = [string,string,ReqCategory,ReqPriority,ReqStatus,ReqVMethod,ReqVStatus,number,string,string,ReqTarget|null,string[]];
const SUB: SubRow[] = [
  ['PWR-001','SYS-001','performance','critical','verified','test','passed',0,'Power module efficiency','While delivering rated power, the power electronics module shall operate at ≥96% conversion efficiency.',{value:96,tolerance:'min',unit:'%'},['EV-PWR-010']],
  ['PWR-002','SYS-001','performance','high','verified','test','passed',0,'Output current capability','The power electronics module shall source up to 200 A of continuous DC output current.',{value:200,tolerance:'min',unit:'A'},['EV-PWR-010']],
  ['PWR-003','PWR-001','performance','high','approved','test','in-progress',0,'IGBT bridge rating','The IGBT power bridge shall switch 150 A continuous at 1200 V without exceeding thermal limits.',{value:150,tolerance:'min',unit:'A'},['EV-PWR-011']],
  ['PWR-004','PWR-001','interface','medium','approved','analysis','passed',1,'Gate-drive timing','The gate driver shall provide dead-time control with ≤100 ns resolution to prevent shoot-through.',{value:100,tolerance:'max',unit:'ns'},['EV-PWR-012']],
  ['PWR-005','SYS-003','performance','high','reviewed','test','not-verified',0,'DC-bus ripple','While charging, DC-bus voltage ripple shall not exceed 2% of nominal under full load.',{value:2,tolerance:'max',unit:'%'},['EV-PWR-013']],
  ['PWR-006','SYS-001','quality','medium','approved','test','passed',0,'Current-sense accuracy','The current-sense network shall measure output current to within ±0.5% of reading.',{value:0.5,tolerance:'±',unit:'%'},['EV-PWR-014']],
  ['CTL-001','SYS-007','functional','high','approved','demonstration','in-progress',2,'Charge session control','The controller shall manage start, stop, pause, and resume of a charging session per OCPP commands.',null,['EV-CTL-020']],
  ['CTL-002','SYS-012','functional','medium','reviewed','demonstration','not-verified',2,'Telemetry reporting','The controller shall report session energy, power, and fault telemetry at least once per second.',{value:1,tolerance:'min',unit:'Hz'},['EV-CTL-020']],
  ['CTL-003','CTL-001','performance','high','approved','test','in-progress',2,'Control loop rate','The control MCU shall execute the power control loop at a minimum 20 kHz update rate.',{value:20,tolerance:'min',unit:'kHz'},['EV-CTL-021']],
  ['CTL-004','SYS-004','interface','high','approved','test','passed',1,'CAN safety bus','The controller shall exchange interlock and fault signals over a redundant 5 Mbps CAN-FD bus.',{value:5,tolerance:'min',unit:'Mbps'},['EV-CTL-022']],
  ['CTL-005','SYS-007','interface','medium','approved','demonstration','in-progress',2,'Cellular backhaul','Where wired backhaul is unavailable, the controller shall maintain connectivity over 4G/LTE.',null,['EV-CTL-023']],
  ['CTL-006','SYS-007','quality','low','draft','analysis','not-verified',2,'Connectivity failover','If the primary network link drops, then the controller shall fail over to backup within 30 s.',{value:30,tolerance:'max',unit:'s'},['EV-CTL-023']],
  ['CTL-007','SYS-007','interface','low','approved','inspection','passed',2,'Local Ethernet','The controller shall provide a 1 Gbps Ethernet port for commissioning and local diagnostics.',{value:1,tolerance:'min',unit:'Gbps'},['EV-CTL-024']],
  ['CTL-008','SYS-007','interface','high','approved','demonstration','in-progress',2,'OCPP protocol stack','The controller shall run a certified OCPP 2.0.1 protocol stack.',null,['EV-CTL-025']],
  ['CTL-009','CTL-008','interface','medium','approved','test','passed',2,'OCPP 1.6 fallback','Where an operator back-end supports only OCPP 1.6, the controller shall negotiate down to OCPP 1.6J.',null,['EV-CTL-025A']],
  ['CTL-010','CTL-008','functional','medium','reviewed','test','in-progress',2,'Smart-charging profiles','The controller shall accept and enforce OCPP smart-charging power profiles.',null,['EV-CTL-025B']],
  ['CHD-001','STK-002','interface','critical','verified','test','passed',5,'Connector compatibility','The connector assembly shall provide CCS2, CHAdeMO, and Type 2 interfaces per their respective standards.',null,['EV-CHD-030']],
  ['CHD-002','CHD-001','interface','high','verified','test','passed',5,'CCS2 interface','The CCS2 connector shall support DC charging up to 500 A with active liquid cooling.',{value:500,tolerance:'max',unit:'A'},['EV-CHD-031']],
  ['CHD-003','CHD-001','interface','medium','approved','test','in-progress',5,'CHAdeMO interface','The CHAdeMO connector shall support DC charging up to 62.5 A per the CHAdeMO 2.0 standard.',{value:62.5,tolerance:'max',unit:'A'},['EV-CHD-032']],
  ['CHD-004','CHD-001','interface','medium','reviewed','inspection','not-verified',5,'Type 2 AC interface','The Type 2 connector shall support AC charging up to 32 A three-phase.',{value:32,tolerance:'max',unit:'A'},['EV-CHD-033']],
  ['MEC-001','SYS-009','constraint','high','approved','inspection','passed',5,'Structural enclosure','The enclosure shall support all internal modules and withstand a 250 N point load on any panel.',{value:250,tolerance:'min',unit:'N'},['EV-ENC-040']],
  ['MEC-002','MEC-001','interface','low','approved','inspection','passed',5,'Display cutout','The front door panel shall provide a sealed cutout for the 7-inch HMI display.',null,['EV-ENC-042']],
  ['MEC-003','MEC-001','constraint','low','draft','inspection','not-verified',5,'Pedestal mounting','The pedestal base shall mount to a concrete pad using four M12 anchors.',null,['EV-ENC-044']],
  ['ENV-001','SYS-009','constraint','high','approved','test','in-progress',5,'Operating temperature','The charging station shall operate from −30 °C to +50 °C ambient.',{value:-30,tolerance:'to +50',unit:'°C'},['EV-ENC-040']],
  ['ENV-002','SYS-009','constraint','medium','approved','inspection','passed',5,'Ingress sealing','The sheet-metal cabinet shall maintain IP54 sealing across the operating temperature range.',{value:54,tolerance:'min',unit:'IP'},['EV-ENC-041']],
  ['UI-001','SYS-010','interface','medium','approved','demonstration','passed',2,'HMI display','The HMI shall present session status, pricing, and instructions on a 7-inch touchscreen.',null,['EV-HMI-050']],
  ['UI-002','UI-001','performance','medium','approved','test','passed',2,'Display readability','The display shall remain readable at 800 cd/m² in direct sunlight.',{value:800,tolerance:'min',unit:'cd/m²'},['EV-HMI-051']],
  ['UI-003','SYS-008','interface','medium','approved','test','in-progress',2,'RFID authentication','The HMI shall read ISO 14443 RFID cards at 13.56 MHz to authenticate users.',null,['EV-HMI-052']],
  ['UI-004','UI-001','functional','low','reviewed','demonstration','not-verified',2,'Status indication','The station shall indicate availability with an RGB LED visible from 20 m.',{value:20,tolerance:'min',unit:'m'},['EV-HMI-053']],
  ['UI-005','SYS-008','interface','medium','draft','demonstration','not-verified',2,'Payment terminal','Where card payment is enabled, the HMI shall accept contactless payment via an integrated terminal.',null,['EV-HMI-054']],
  ['SAF-001','STK-003','regulatory','critical','verified','test','passed',3,'Safety protection systems','The charging station shall provide ground-fault, surge, and thermal protection as an integrated safety subsystem.',null,['EV-SAF-060']],
  ['SAF-002','SAF-001','regulatory','critical','verified','test','passed',3,'Residual-current detection','If DC residual current exceeds 6 mA, then the station shall interrupt charging within 100 ms.',{value:6,tolerance:'max',unit:'mA'},['EV-SAF-061']],
  ['SAF-003','SYS-005','regulatory','critical','verified','test','passed',3,'GFCI device','The ground-fault detection device shall comply with IEC 62955 Type B for DC charging.',null,['EV-SAF-061']],
  ['SAF-004','SYS-006','functional','critical','approved','demonstration','in-progress',3,'Emergency-stop button','The emergency-stop button shall be IP65-rated and latch until manually reset.',null,['EV-SAF-062']],
  ['SAF-005','SYS-011','regulatory','high','approved','test','in-progress',3,'Surge protection device','The surge protection device shall divert 40 kA (8/20 µs) without interrupting service.',{value:40,tolerance:'min',unit:'kA'},['EV-SAF-063']],
  ['SAF-006','SAF-001','constraint','high','approved','test','passed',3,'Thermal fuse','The DC path shall include a 250 A thermal fuse rated for 500 VDC.',{value:250,tolerance:'',unit:'A'},['EV-SAF-064']],
  ['REG-001','SYS-005','regulatory','critical','approved','inspection','in-progress',3,'GFCI compliance','The ground-fault subsystem shall be certified to IEC 62955.',null,['EV-SAF-061']],
  ['REG-002','SYS-011','regulatory','high','reviewed','inspection','not-verified',3,'Surge compliance','The surge protection shall be certified to IEC 61643-11 Class I+II.',null,['EV-SAF-063']],
  ['SEC-001','SYS-008','quality','high','approved','analysis','in-progress',2,'Credential security','The station shall store user credentials and keys in a hardware secure element.',null,['EV-HMI-052']],
  ['SEC-002','SYS-008','regulatory','high','draft','analysis','not-verified',2,'Payment data protection','Where card payment is enabled, the station shall handle cardholder data per PCI-DSS.',null,['EV-HMI-054']],
];
SUB.forEach(r => REQS.push(mk({
  key:r[0], parent:r[1], type:'subsystem-req', category:r[2], priority:r[3], status:r[4],
  vmethod:r[5], vstatus:r[6], owner:own(r[7]), title:r[8], statement:r[9], target:r[10],
  alloc:r[11], source:r[1],
})));

// ── Component requirements ────────────────────────────────────────────────────
type CompRow = [string,string,ReqCategory,ReqPriority,ReqStatus,ReqVMethod,ReqVStatus,number,string,string,ReqTarget|null,string[]];
const COMP: CompRow[] = [
  ['PWR-011','PWR-003','performance','high','approved','test','passed',0,'IGBT junction temperature','While at rated load, IGBT junction temperature shall not exceed 125 °C.',{value:125,tolerance:'max',unit:'°C'},['EV-PWR-011']],
  ['PWR-012','PWR-003','performance','medium','reviewed','test','not-verified',0,'Switching frequency','The IGBT bridge shall switch at 20 kHz nominal.',{value:20,tolerance:'±1',unit:'kHz'},['EV-PWR-011']],
  ['PWR-013','PWR-004','interface','low','approved','inspection','passed',1,'Gate-drive isolation','The gate driver shall provide ≥4 kV galvanic isolation.',{value:4,tolerance:'min',unit:'kV'},['EV-PWR-012']],
  ['PWR-014','PWR-005','performance','medium','draft','test','not-verified',0,'Bus capacitance','The DC-bus capacitor bank shall provide ≥9000 µF total.',{value:9000,tolerance:'min',unit:'µF'},['EV-PWR-013']],
  ['PWR-015','PWR-006','quality','low','approved','analysis','passed',0,'Sense resistor drift','The current-sense resistor shall drift ≤25 ppm/°C.',{value:25,tolerance:'max',unit:'ppm/°C'},['EV-PWR-014']],
  ['PWR-016','PWR-001','performance','medium','approved','test','in-progress',0,'Standby power','In idle, the power module shall draw ≤15 W.',{value:15,tolerance:'max',unit:'W'},['EV-PWR-010']],
  ['CTL-011','CTL-003','performance','medium','approved','test','passed',2,'MCU clock','The control MCU shall run at ≥400 MHz.',{value:400,tolerance:'min',unit:'MHz'},['EV-CTL-021']],
  ['CTL-012','CTL-003','constraint','low','approved','inspection','passed',2,'Watchdog','The MCU shall reset via independent watchdog within 500 ms of a hang.',{value:500,tolerance:'max',unit:'ms'},['EV-CTL-021']],
  ['CTL-013','CTL-004','interface','medium','approved','test','passed',1,'CAN termination','Each CAN-FD bus end shall be terminated at 120 Ω.',{value:120,tolerance:'±5',unit:'Ω'},['EV-CTL-022']],
  ['CTL-014','CTL-005','performance','low','draft','test','not-verified',2,'LTE bands','The modem shall support LTE bands B1/B3/B7/B20.',null,['EV-CTL-023']],
  ['CTL-015','CTL-007','interface','low','approved','inspection','passed',2,'PoE option','Where PoE is used, the Ethernet port shall accept 802.3af power.',null,['EV-CTL-024']],
  ['CHD-011','CHD-002','performance','high','approved','test','in-progress',5,'CCS2 cooling','The CCS2 cable coolant loop shall hold conductor temperature ≤90 °C at 500 A.',{value:90,tolerance:'max',unit:'°C'},['EV-CHD-031']],
  ['CHD-012','CHD-002','quality','medium','reviewed','test','not-verified',5,'Mating cycles','The CCS2 connector shall withstand ≥10,000 mating cycles.',{value:10000,tolerance:'min',unit:'cycles'},['EV-CHD-031']],
  ['CHD-013','CHD-003','interface','low','approved','inspection','passed',5,'CHAdeMO locking','The CHAdeMO connector shall mechanically lock during charging.',null,['EV-CHD-032']],
  ['CHD-014','CHD-004','interface','low','draft','inspection','not-verified',5,'Type 2 pilot','The Type 2 connector shall implement the IEC 61851 control-pilot signaling.',null,['EV-CHD-033']],
  ['UI-011','UI-002','performance','low','approved','test','passed',2,'Touch latency','The touchscreen shall register input within 80 ms.',{value:80,tolerance:'max',unit:'ms'},['EV-HMI-051']],
  ['UI-012','UI-003','interface','medium','approved','test','in-progress',2,'RFID range','The RFID reader shall read cards within 40 mm.',{value:40,tolerance:'max',unit:'mm'},['EV-HMI-052']],
  ['UI-013','UI-004','constraint','low','reviewed','demonstration','not-verified',2,'LED brightness','The status LED shall output ≥200 lumens.',{value:200,tolerance:'min',unit:'lm'},['EV-HMI-053']],
  ['SAF-011','SAF-002','regulatory','critical','verified','test','passed',3,'RCD trip time','On a 30 mA AC fault, the RCD shall trip within 300 ms.',{value:300,tolerance:'max',unit:'ms'},['EV-SAF-061']],
  ['SAF-012','SAF-004','functional','high','approved','demonstration','in-progress',3,'E-stop reset','The e-stop shall require a deliberate two-step reset.',null,['EV-SAF-062']],
  ['SAF-013','SAF-005','performance','high','approved','test','passed',3,'SPD clamping','The SPD shall clamp surges to ≤2.5 kV residual.',{value:2.5,tolerance:'max',unit:'kV'},['EV-SAF-063']],
  ['SAF-014','SAF-006','constraint','medium','approved','inspection','passed',3,'Fuse breaking capacity','The thermal fuse shall have ≥30 kA breaking capacity.',{value:30,tolerance:'min',unit:'kA'},['EV-SAF-064']],
  ['SEC-011','SEC-001','quality','medium','draft','analysis','not-verified',2,'Secure boot','The controller shall verify signed firmware at boot.',null,['EV-CTL-020']],
  ['SEC-012','SEC-002','regulatory','medium','draft','analysis','not-verified',2,'TLS','OCPP traffic shall use TLS 1.3.',null,['EV-CTL-025']],
];
COMP.forEach(r => REQS.push(mk({
  key:r[0], parent:r[1], type:'component-req', category:r[2], priority:r[3], status:r[4],
  vmethod:r[5], vstatus:r[6], owner:own(r[7]), title:r[8], statement:r[9], target:r[10],
  alloc:r[11], source:r[1],
})));

// ── Generated acceptance-level reqs ──────────────────────────────────────────
const PARENTS_FOR_GEN = REQS.filter(r => r.type === 'subsystem-req');
const GEN_TPL: [ReqCategory, string, string, ReqVMethod, ReqVStatus][] = [
  ['interface','EMC emissions','Conducted and radiated emissions shall meet CISPR 11 Class A.', 'inspection', 'passed'],
  ['quality','Insulation resistance','Insulation resistance shall exceed 10 MΩ at 1 kV.', 'test', 'passed'],
  ['constraint','Humidity tolerance','Operation shall be unaffected at 95% relative humidity, non-condensing.', 'test', 'in-progress'],
  ['quality','Vibration tolerance','Mounted components shall survive IEC 60068-2-6 vibration.', 'test', 'not-verified'],
];
let gi = 0;
PARENTS_FOR_GEN.forEach((p) => {
  if (p._seq % 2 === 0) {
    const t = GEN_TPL[gi % GEN_TPL.length]; gi++;
    const g = groupOf(p.key);
    REQS.push(mk({
      key:`${g}-Q${String(gi).padStart(2,'0')}`, parent:p.key, type:'component-req',
      category:t[0], priority:'low', status: gi % 3 === 0 ? 'draft' : 'approved',
      vmethod:t[3], vstatus:t[4], owner:p.owner,
      title:t[1], statement:`The ${REQ_GROUP[g].label.toLowerCase()} subsystem shall comply: ${t[2]}`,
      target:null, alloc: gi % 3 === 0 ? [] : p.alloc.slice(0,1), source:p.key,
    }));
  }
});

// ── Loose (orphan) requirements ───────────────────────────────────────────────
type LooseRow = [string,ReqCategory,ReqPriority,ReqStatus,ReqVMethod,ReqVStatus,number,string,string,ReqTarget|null];
const LOOSE: LooseRow[] = [
  ['SYS-015','performance','medium','draft','analysis','not-verified',0,'Audible noise limit','While charging at rated power, the station shall not exceed 65 dBA at 1 m.',{value:65,tolerance:'max',unit:'dBA'}],
  ['NET-001','interface','low','draft','analysis','not-verified',2,'Backhaul data budget','The station shall operate within a 2 GB/month backhaul data budget.',{value:2,tolerance:'max',unit:'GB/mo'}],
  ['UI-006','quality','low','draft','inspection','not-verified',2,'Control accessibility','The HMI controls shall meet ADA reach-range requirements.',null],
  ['ENV-003','constraint','medium','reviewed','test','not-verified',5,'Altitude derating','Where installed above 2000 m, the station shall derate output per IEC 60664.',null],
];
LOOSE.forEach(r => REQS.push(mk({
  key:r[0], parent:null, type:'subsystem-req', category:r[1], priority:r[2], status:r[3],
  vmethod:r[4], vstatus:r[5], owner:own(r[6]), title:r[7], statement:r[8], target:r[9],
  alloc:[], source:'',
})));

// ── Index + derived ───────────────────────────────────────────────────────────
export const BY_KEY: Record<string, Requirement> = {};
REQS.forEach(r => { BY_KEY[r.key] = r; r.group = groupOf(r.key); });

const CHILDREN: Record<string, string[]> = {};
REQS.forEach(r => { if (r.parent) (CHILDREN[r.parent] = CHILDREN[r.parent] ?? []).push(r.key); });
REQS.forEach(r => { r.childKeys = CHILDREN[r.key] ?? []; });

const DEP: Record<string, string[]> = {
  'SYS-002':['SYS-001','SYS-003'], 'SYS-014':['SYS-008'], 'CTL-001':['CTL-008'],
  'SYS-006':['CTL-004'], 'PWR-005':['PWR-001'], 'UI-003':['SEC-001'], 'SYS-007':['SEC-002'],
};
const CONF: Record<string, string[]> = { 'SYS-013':['SYS-003'], 'PWR-016':['CTL-006'] };
Object.entries(DEP).forEach(([k,v]) => { if (BY_KEY[k]) BY_KEY[k].depends = v.filter(x => BY_KEY[x]); });
Object.entries(CONF).forEach(([k,v]) => { if (BY_KEY[k]) BY_KEY[k].conflicts = v.filter(x => BY_KEY[x]); });

REQS.forEach(r => {
  const links: ReqLink[] = [];
  if (r.parent && BY_KEY[r.parent]) links.push({ type:'derives_from', target:r.parent, status: r.suspect ? 'suspect' : 'valid' });
  else if (r.type !== 'stakeholder-need' && r.source) links.push({ type:'traces_to_source', target:r.source, status:'valid', external:true });
  r.childKeys.forEach(c => links.push({ type:'refined_by', target:c, status:'valid' }));
  (r.alloc ?? []).forEach(pn => links.push({ type:'allocated_to', target:pn, status:'valid', external:true, kind:'part' }));
  (r.depends ?? []).forEach(d => links.push({ type:'depends_on', target:d, status:'valid' }));
  (r.conflicts ?? []).forEach(d => links.push({ type:'conflicts_with', target:d, status:'suspect' }));
  const tested = r.vstatus !== 'not-verified';
  if (tested) links.push({ type:'verifies', target:`TC-${r.key}`, status: r.vstatus === 'failed' ? 'suspect' : 'valid', external:true, kind:'test', result:r.vstatus });
  if (r.suspect) links.push({ type:'verifies', target:`TC-${r.key}-A`, status:'suspect', external:true, kind:'test' });
  r.links = links;
  const hasSource = r.type === 'stakeholder-need' || links.some(l => l.type === 'derives_from' || l.type === 'traces_to_source');
  const needsImpl = r.type === 'subsystem-req' || r.type === 'component-req';
  const hasImpl = (r.alloc && r.alloc.length > 0);
  r.coverage = { orphan:!hasSource, untested:!tested, unimplemented:needsImpl && !hasImpl, suspect:links.some(l => l.status === 'suspect') };
  r.hasGap = r.coverage.orphan || r.coverage.untested || r.coverage.unimplemented || r.coverage.suspect;
});

export const REQ_ROOTS = REQS.filter(r => !r.parent).map(r => r.key);
export { REQS };

// ── Helpers ───────────────────────────────────────────────────────────────────
export function flattenTree(expanded: Record<string,boolean>, filterSet: Set<string> | null): (Requirement & { depth: number })[] {
  const out: (Requirement & { depth: number })[] = [];
  const walk = (key: string, depth: number) => {
    const r = BY_KEY[key]; if (!r) return;
    if (filterSet && !filterSet.has(key)) return;
    out.push({ ...r, depth });
    if (expanded[key] !== false && r.childKeys.length) r.childKeys.forEach(c => walk(c, depth + 1));
  };
  REQ_ROOTS.forEach(k => walk(k, 0));
  return out;
}

export function matchWithAncestors(pred: (r: Requirement) => boolean): Set<string> {
  const inc = new Set<string>();
  REQS.forEach(r => {
    if (pred(r)) {
      inc.add(r.key);
      let p = r.parent;
      while (p && BY_KEY[p]) { inc.add(p); p = BY_KEY[p].parent; }
    }
  });
  return inc;
}

export function descendants(key: string): string[] {
  const out: string[] = [];
  const walk = (k: string) => { (BY_KEY[k]?.childKeys ?? []).forEach(c => { out.push(c); walk(c); }); };
  walk(key); return out;
}

export function ancestors(key: string): string[] {
  const out: string[] = []; let p = BY_KEY[key]?.parent;
  while (p && BY_KEY[p]) { out.push(p); p = BY_KEY[p].parent; }
  return out;
}

export function reqStats() {
  const total = REQS.length;
  const verified = REQS.filter(r => r.status === 'verified' || r.status === 'validated').length;
  const orphan   = REQS.filter(r => r.coverage.orphan).length;
  const untested = REQS.filter(r => r.coverage.untested).length;
  const unimplemented = REQS.filter(r => r.coverage.unimplemented).length;
  const suspect  = REQS.filter(r => r.coverage.suspect).length;
  const approved = REQS.filter(r => REQ_STATUS[r.status].step >= 2 && r.status !== 'obsolete').length;
  return { total, verified, orphan, untested, unimplemented, suspect, approved,
    verifiedPct: Math.round(verified/total*100), approvedPct: Math.round(approved/total*100) };
}

export function vDistribution() {
  const d: Record<ReqVStatus,number> = { 'not-verified':0, 'in-progress':0, passed:0, failed:0, waived:0 };
  REQS.forEach(r => d[r.vstatus]++);
  return d;
}

export function coverageBy(accessor: (r:Requirement)=>string, order?: string[]) {
  const map: Record<string,{key:string;total:number;verified:number;gaps:number}> = {};
  REQS.forEach(r => {
    const k = accessor(r);
    const m = map[k] ?? (map[k] = { key:k, total:0, verified:0, gaps:0 });
    m.total++;
    if (r.status === 'verified' || r.status === 'validated') m.verified++;
    if (r.hasGap) m.gaps++;
  });
  const keys = order ?? Object.keys(map);
  return keys.filter(k => map[k]).map(k => map[k]);
}

export function worstOffenders(n: number) {
  return REQS.map(r => ({ r, n: (['orphan','untested','unimplemented','suspect'] as const).filter(g => r.coverage[g]).length }))
    .filter(x => x.n > 0)
    .sort((a,b) => b.n - a.n || REQ_PRIORITY[a.r.priority].rank - REQ_PRIORITY[b.r.priority].rank)
    .slice(0, n);
}

export function impactOf(key: string) {
  const desc = descendants(key);
  const all = [key, ...desc];
  const parts = new Set<string>(); all.forEach(k => (BY_KEY[k]?.alloc ?? []).forEach(p => parts.add(p)));
  const tests = all.filter(k => BY_KEY[k]?.vstatus !== 'not-verified');
  return { descendants: desc, parts: Array.from(parts), tests, blast: desc.length + parts.size + tests.length };
}

// ── Phase gate data ───────────────────────────────────────────────────────────
export const GATES: PhaseGate[] = [
  { id:'G0', name:'Concept',              short:'Concept', date:'Jan 30', state:'passed' },
  { id:'G1', name:'Design Freeze',        short:'Design',  date:'Mar 12', state:'passed' },
  { id:'G2', name:'Design Verification',  short:'DVT',     date:'Apr 24', state:'current' },
  { id:'G3', name:'Production Validation',short:'PVT',     date:'Jun 05', state:'upcoming' },
  { id:'G4', name:'Production Release',   short:'MP',      date:'Jul 18', state:'upcoming' },
];

export const STANDARDS: ComplianceStandard[] = [
  { code:'IEC 61851-1', title:'EV conductive charging — general requirements', domain:'Electrical safety' },
  { code:'IEC 62196',   title:'Plugs, socket-outlets & connectors',            domain:'Connectors' },
  { code:'ISO 15118',   title:'Vehicle-to-grid comms — Plug & Charge',          domain:'Communication' },
  { code:'IEC 62955',   title:'Residual DC detecting device (RDC-DD)',          domain:'Safety' },
  { code:'IEC 61643',   title:'Surge protective devices',                       domain:'Safety' },
  { code:'IEC 60529',   title:'Degrees of protection (IP code)',                domain:'Environmental' },
  { code:'IEC 60068',   title:'Environmental testing',                          domain:'Environmental' },
  { code:'CISPR 11',    title:'EMC — industrial RF equipment',                  domain:'EMC' },
  { code:'UL 2202',     title:'EV charging system equipment (listing)',         domain:'Listing' },
  { code:'PCI-DSS',     title:'Payment card data security',                     domain:'Security' },
];

const matchesStandard = (r: Requirement, code: string) =>
  r.standard === code || new RegExp(code.replace(/[-/]/g,'[-/ ]?'),'i').test(r.statement);

export function standardsRollup() {
  return STANDARDS.map(s => {
    const reqs = REQS.filter(r => matchesStandard(r, s.code));
    const verified = reqs.filter(r => r.status === 'verified' || r.status === 'validated').length;
    const passed = reqs.filter(r => r.vstatus === 'passed').length;
    const gaps = reqs.filter(r => r.hasGap).length;
    let status: 'compliant' | 'in-progress' | 'gap' = 'gap';
    if (reqs.length && verified === reqs.length && gaps === 0) status = 'compliant';
    else if (passed > 0 || verified > 0) status = 'in-progress';
    return { ...s, reqs, count:reqs.length, verified, passed, gaps, status, pct: reqs.length ? Math.round(verified/reqs.length*100) : 0 };
  }).filter(s => s.count > 0);
}

export function gateReadiness() {
  const critical = REQS.filter(r => r.priority === 'critical' || r.priority === 'high');
  const approved = critical.filter(r => REQ_STATUS[r.status].step >= 2).length;
  const sysSub   = REQS.filter(r => r.type === 'system-req' || r.type === 'subsystem-req');
  const verified = sysSub.filter(r => r.vstatus === 'passed' || r.status === 'verified' || r.status === 'validated').length;
  const blockers = critical.filter(r => r.coverage.orphan || r.coverage.suspect || REQ_STATUS[r.status].step < 2);
  const approvedPct = Math.round(approved/critical.length*100);
  const verifiedPct = Math.round(verified/sysSub.length*100);
  const score = Math.round(approvedPct*0.5 + verifiedPct*0.5);
  return { critical:critical.length, approved, approvedPct, sysSub:sysSub.length, verified, verifiedPct, blockers, score };
}

export function manufacturingReadiness() {
  return (Object.keys(REQ_GROUP) as ReqGroup[]).map(g => {
    const reqs = REQS.filter(r => r.group === g && (r.type === 'subsystem-req' || r.type === 'component-req'));
    if (!reqs.length) return null;
    const parts = new Set<string>(); reqs.forEach(r => (r.alloc ?? []).forEach(p => parts.add(p)));
    const verif = reqs.filter(r => r.status === 'verified' || r.status === 'validated' || r.vstatus === 'passed').length;
    const open = reqs.filter(r => r.hasGap).length;
    const pct = Math.round(verif/reqs.length*100);
    const status: 'ready' | 'at-risk' | 'blocked' = pct >= 80 && open <= 1 ? 'ready' : pct >= 50 ? 'at-risk' : 'blocked';
    return { key:g, parts:parts.size, reqs:reqs.length, verified:verif, open, pct, status };
  }).filter((x): x is NonNullable<typeof x> => x !== null).sort((a,b) => b.reqs - a.reqs);
}

// ── Acceptance criteria synthesis ─────────────────────────────────────────────
export interface AccCriterion { given: string; when: string; then: string; }
export function synthCriteria(r: Requirement): AccCriterion[] {
  const out: AccCriterion[] = [];
  const t = r.target;
  if (t) {
    const cmp = t.tolerance === 'min' ? 'at least' : t.tolerance === 'max' ? 'no more than' : (t.tolerance && /to/.test(t.tolerance)) ? 'within' : '';
    out.push({ given:'the station is operating within its rated envelope', when:`${r.title.toLowerCase()} is measured under nominal conditions`, then:`the measured value is ${cmp || 'equal to'} ${t.value}${t.tolerance && !cmp ? ' '+t.tolerance : ''} ${t.unit}` });
    out.push({ given:'a worst-case corner (temperature, line, and load extremes)', when:'the same measurement is repeated', then:`the value remains within the specified ${t.unit} limit with margin ≥ 5%` });
  } else {
    out.push({ given:'a vehicle is connected and a session is authorized', when:'the described condition occurs', then:'the station performs the specified response and logs the event' });
  }
  if (r.standard) out.push({ given:`an accredited test setup per ${r.standard}`, when:'the conformance procedure is executed', then:`results meet every clause of ${r.standard}` });
  return out;
}

// ── Quality analysis ──────────────────────────────────────────────────────────
const WEAK = ['quickly','fast','meaningful','practical','minimal','appropriate','user-friendly','easy','efficient','robust','flexible','as needed','etc','sufficient','adequate','reasonable','support','handle','process','optimal','seamless','intuitive'];

export interface QualityCheck { id: string; label: string; pass: boolean; detail: string; }
export interface QualitySuggestion { icon: string; kind: string; text: string; }
export interface QualityResult { pct: number; grade: string; tint: string; checks: QualityCheck[]; suggestions: QualitySuggestion[]; }

export function analyzeQuality(r: Partial<Requirement>): QualityResult {
  const text = ((r.statement ?? '')).toLowerCase();
  const checks: QualityCheck[] = [];
  const hasShall = /\bshall\b/.test(text);
  checks.push({ id:'ears', label:'Uses normative "shall" + EARS pattern', pass:hasShall, detail: hasShall ? 'Statement is written as a binding "shall" requirement.' : 'No normative verb — rewrite as "The system shall…".' });
  const compound = /\b(and|and\/or)\b.*\bshall\b|\bshall\b.*\b(and also|as well as)\b/.test(text) || ((text.match(/\band\b/g) ?? []).length > 2);
  checks.push({ id:'atomic', label:'Single, atomic obligation', pass:!compound, detail: compound ? 'Appears to combine multiple obligations — consider splitting.' : 'Expresses one verifiable obligation.' });
  const hasTarget = !!r.target || /\b\d+(\.\d+)?\s?(%|kw|a|v|ms|s|hz|khz|mhz|°c|mm|m|db|kv|ma|µf|ppm|n|gb|mbps)\b/i.test(r.statement ?? '');
  const needsTarget = r.category === 'performance' || r.category === 'constraint';
  checks.push({ id:'measurable', label:'Quantified / measurable', pass: hasTarget || !needsTarget, detail: hasTarget ? 'Includes a measurable threshold.' : (needsTarget ? 'Performance/constraint requirement lacks a numeric target.' : 'Functional requirement — qualitative is acceptable.') });
  const found = WEAK.filter(w => new RegExp('\\b'+w.replace('/','\\/')+'\\b').test(text));
  checks.push({ id:'unambiguous', label:'No ambiguous language', pass: found.length === 0, detail: found.length ? `Ambiguous term(s): ${found.map(f=>`"${f}"`).join(', ')}.` : 'No vague or subjective terms detected.' });
  const verifiable = r.vstatus !== 'not-verified' || hasTarget;
  const vmLabel = r.vmethod ? REQ_VMETHOD[r.vmethod]?.label ?? r.vmethod : 'unknown';
  checks.push({ id:'verifiable', label:'Verifiable', pass:verifiable, detail: verifiable ? `Verification method: ${vmLabel}.` : 'No verification method or measurable criterion.' });
  checks.push({ id:'rationale', label:'Rationale captured', pass:!!r.rationale, detail: r.rationale ? 'Design intent is documented.' : 'No rationale — capture why this requirement exists.' });
  const traced = r.type === 'stakeholder-need' || !!(r.parent || r.source);
  checks.push({ id:'traced', label:'Traced to a source', pass:!!traced, detail: traced ? 'Linked to a parent or external source.' : 'Orphan — not derived from any need or standard.' });
  const W: Record<string,number> = { ears:18, atomic:12, measurable:18, unambiguous:20, verifiable:14, rationale:8, traced:10 };
  let score = 0, max = 0;
  checks.forEach(c => { max += W[c.id]; if (c.pass) score += W[c.id]; });
  const pct = Math.round(score / max * 100);
  const grade = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 68 ? 'C' : pct >= 55 ? 'D' : 'E';
  const tint = pct >= 80 ? '#16A34A' : pct >= 65 ? '#CA8A04' : '#DC2626';
  const suggestions: QualitySuggestion[] = [];
  if (!hasShall) suggestions.push({ icon:'PenLine', kind:'Rewrite', text:'Restructure as an EARS requirement: "While <state>, the <subject> shall <response>."' });
  if (found.length) suggestions.push({ icon:'Replace', kind:'Clarify', text:`Replace ${found.map(f=>`"${f}"`).join(', ')} with a measurable threshold or precise term.` });
  if (needsTarget && !hasTarget) suggestions.push({ icon:'Ruler', kind:'Quantify', text:'Add a numeric target with tolerance and unit so the requirement is testable.' });
  if (!r.rationale) suggestions.push({ icon:'MessageSquareQuote', kind:'Document', text:'Capture rationale — the design intent behind this requirement.' });
  if (r.coverage?.orphan) suggestions.push({ icon:'GitMerge', kind:'Link', text:'Create a derive-from link to the parent need or source standard.' });
  if (r.coverage?.untested) suggestions.push({ icon:'FlaskConical', kind:'Verify', text:'Define a verification method and link a test case.' });
  return { pct, grade, tint, checks, suggestions };
}

// ── EARS patterns ─────────────────────────────────────────────────────────────
export interface EARSPattern { label: string; hint: string; icon: string; fields: [string,string,string][]; desc: string; tpl: (f: Record<string,string>) => string; }
export const EARS: Record<string, EARSPattern> = {
  ubiquitous: { label:'Ubiquitous', hint:'Always-active', icon:'Infinity', fields:[], desc:'An invariant the system must always uphold.', tpl:f => `The ${f.subject} shall ${f.response||'…'}.` },
  event:      { label:'Event-driven', hint:'When …', icon:'Zap', fields:[['trigger','When this trigger occurs','a vehicle is connected']], desc:'Triggered by a discrete event.', tpl:f => `When ${f.trigger||'…'}, the ${f.subject} shall ${f.response||'…'}.` },
  state:      { label:'State-driven', hint:'While …', icon:'Activity', fields:[['state','While in this state','charging at rated power']], desc:'Active for the duration of a state.', tpl:f => `While ${f.state||'…'}, the ${f.subject} shall ${f.response||'…'}.` },
  optional:   { label:'Optional feature', hint:'Where …', icon:'ToggleRight', fields:[['feature','Where this feature is present','card payment is enabled']], desc:'Applies only when a feature is included.', tpl:f => `Where ${f.feature||'…'}, the ${f.subject} shall ${f.response||'…'}.` },
  unwanted:   { label:'Unwanted behavior', hint:'If … then', icon:'ShieldAlert', fields:[['condition','If this condition occurs','a ground fault is detected']], desc:'Guards against a fault or hazard.', tpl:f => `If ${f.condition||'…'}, then the ${f.subject} shall ${f.response||'…'}.` },
  complex:    { label:'Complex', hint:'While + When', icon:'GitBranch', fields:[['state','While in this state','a session is active'],['trigger','When this trigger occurs','the e-stop is pressed']], desc:'Combines a state and an event.', tpl:f => `While ${f.state||'…'}, when ${f.trigger||'…'}, the ${f.subject} shall ${f.response||'…'}.` },
  free:       { label:'Free-form', hint:'Write it', icon:'PenLine', fields:[], desc:'Author the full statement yourself.', tpl:f => f.free||'…' },
};
