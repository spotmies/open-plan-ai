// Requirements data model — types, enums, mock data, and helpers

// ── Team (real project members, once rebuilt) ───────────────────────────────
// A mutable singleton mirroring REQS/BY_KEY's own pattern: starts empty (no
// hardcoded placeholder members — `ownerOf()`'s fallback already renders a
// clean "?" for an id it can't find), populated in place by
// `rebuildTeamFromApi()` from the project's real member list. `color` isn't
// carried by the backend — derived deterministically per id so the same
// member always gets the same tint across renders/sessions.
export interface TeamMember { id: string; name: string; initials: string; color: string; }
export const REQ_TEAM: TeamMember[] = [];
const TEAM_COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2', '#DB2777', '#65A30D'];
const colorForId = (id: string): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TEAM_COLORS[h % TEAM_COLORS.length];
};
/** Minimal shape adapted from `TeamMember` (src/types/index.ts, via
 * `useProjectMembers()`). */
export interface ApiTeamMemberForRebuild { id: string; name: string; initials?: string; }
export function rebuildTeamFromApi(members: ApiTeamMemberForRebuild[]): void {
  REQ_TEAM.length = 0;
  members.forEach(m => REQ_TEAM.push({
    id: m.id, name: m.name,
    initials: m.initials || m.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?',
    color: colorForId(m.id),
  }));
}
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
  depended_on_by:   { label: 'Depended on by',   dir: 'side' },
  conflicts_with:   { label: 'Conflicts with',   dir: 'side' },
  flagged_by_eco:   { label: 'Flagged by ECO',   dir: 'side' },
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ReqTarget { value: number; tolerance: string; unit: string; }
export interface ReqLink {
  type: string; target: string; status: 'valid' | 'suspect';
  external?: boolean; kind?: 'part' | 'test' | 'eco'; result?: ReqVStatus;
  /** Backend requirement_links row id — present only for links that are real,
   * independently deletable rows (depends_on/conflicts_with/extra derives_from).
   * Absent for links synthesized from the tree itself (the primary parent
   * derives_from, refined_by, traces_to_source) — those aren't separate rows. */
  _linkId?: string;
  /** Live Inventory snapshot for `kind:'part'` links only — present when the
   * allocated part has a real `inventory_stock` row for the project's org.
   * Absent (not zero) means "never stocked", not "zero on hand". */
  qty?: AllocatedPartStock;
}
/** Aggregated across every location for one part — see `rebuildRequirementsFromApi`'s
 * `stockByPartId` param. `available` mirrors Inventory's own `availableOf()`
 * (onHand - allocated - quarantineQty) so the two features never disagree. */
export interface AllocatedPartStock { onHand: number; allocated: number; available: number; }
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
  /** Backend UUID — hidden from display, used for API calls (mirrors BOM's `_partId`). */
  _id?: string;
  /** Backend requirement_groups UUID this requirement belongs to. */
  _groupId?: string;
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
// This module used to hardcode a 113-row mock dataset here. It's now a thin,
// mutable index rebuilt from the real backend (requirement-groups + requirements
// modules) — see `rebuildRequirementsFromApi()` below. Every helper past this
// point still reads `REQS`/`BY_KEY` as module-level state, unchanged; only what
// *populates* them changed. Every consumer of this module (RequirementsView,
// RequirementDetailScreen, RequirementImpact, ECOWizard) reads these same live
// bindings, so none of them needed to change either.
let SEQ = 0;
const mk = (o: Partial<Requirement>): Requirement => ({
  version: '1.0', rationale: '', source: '', target: null, baselines: [],
  alloc: [], depends: [], conflicts: [], suspect: false, standard: null,
  updated: '', group: 'SYS', childKeys: [], links: [],
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

// ── Live index (rebuilt from the API — see rebuildRequirementsFromApi) ────────
export const REQS: Requirement[] = [];
export const BY_KEY: Record<string, Requirement> = {};
export const REQ_ROOTS: string[] = [];

const REQ_TYPE_FROM_API: Record<string, ReqType> = {
  stakeholder_need: 'stakeholder-need',
  stakeholder_req: 'stakeholder-req',
  system_req: 'system-req',
  subsystem_req: 'subsystem-req',
  component_req: 'component-req',
};

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Minimal shape adapted from `ApiRequirementTreeItem` (src/hooks/useRequirements.ts). */
export interface ApiRequirementForRebuild {
  id: string; groupId: string; parentId: string | null; key: string;
  type: string; category: string; priority: string; status: string;
  title: string; statement: string; rationale: string | null; source: string | null;
  standard: string | null; targetValue: number | null; targetTolerance: string | null;
  targetUnit: string | null; ownerId: string | null; version: string; updatedAt: string;
}

/** Minimal shape adapted from `ApiRequirementLink` (src/hooks/useRequirements.ts). */
export interface ApiRequirementLinkForRebuild {
  id: string; fromId: string; toId: string; linkType: string; status: string;
}

/** Minimal shape adapted from `ApiRequirementAllocation` (src/hooks/useBom.ts / bomData.ts). */
export interface ApiRequirementAllocationForRebuild {
  requirementId: string; nodeId: string; partId: string; partNumber: string; partName: string;
}

/** Minimal shape adapted from `ApiAffectedRequirementLink` (src/hooks/useECOs.ts). */
export interface ApiEcoSuspectForRebuild {
  requirementId: string; ecoId: string; ecoNum: string; ecoStatus: string;
}

/** Minimal shape adapted from `ApiVerificationSummaryItem` (src/hooks/useVerification.ts).
 * `vstatus` values match `ReqVStatus` exactly — same strings on both sides. */
export interface ApiVerificationSummaryForRebuild {
  requirementId: string; vstatus: ReqVStatus; testCaseCount: number;
}

/**
 * Rebuilds `REQS`/`BY_KEY`/`REQ_ROOTS` in place from a live API response.
 * `vmethod` stays a fixed placeholder — a requirement can have several test
 * cases with different methods now that Test & Verification exists, so
 * there's no longer one true value to put here; the real per-test-case
 * methods live in the Verification tab's own data, not on `Requirement`.
 * `links` (the second param) is the project-wide requirement_links list —
 * omit it to leave depends_on/conflicts_with/extra derives_from out of the
 * rebuilt links entirely, rather than silently treating "not fetched yet" as
 * "known to be empty".
 * `allocations` (the third param) is the project-wide BOM↔requirement
 * allocation list (bom_requirement_links) — same omit-vs-empty distinction.
 * `ecoSuspects` (the fourth param) is the project-wide "requirements with an
 * in-flight ECO" list (eco_affected_requirements, pre-filtered server-side to
 * non-closed/cancelled ECOs) — same omit-vs-empty distinction again.
 * `stockByPartId` (the fifth param) is the org's live Inventory stock,
 * pre-aggregated across locations and keyed by `bom_parts.id` — enriches each
 * `allocated_to` link with on-hand/allocated/available instead of just
 * "linked: yes/no". Omit while Inventory hasn't loaded yet; a part simply
 * absent from the map (vs. present with zeros) means it was never stocked.
 * `verificationSummary` (the sixth param) is the project-wide rolled-up
 * vstatus per requirement (test_cases/test_executions) — same omit-vs-empty
 * distinction; a requirement absent from it (vs. present as 'not-verified')
 * just has zero test cases yet.
 */
export function rebuildRequirementsFromApi(
  items: ApiRequirementForRebuild[],
  links?: ApiRequirementLinkForRebuild[],
  allocations?: ApiRequirementAllocationForRebuild[],
  ecoSuspects?: ApiEcoSuspectForRebuild[],
  stockByPartId?: Map<string, AllocatedPartStock>,
  verificationSummary?: ApiVerificationSummaryForRebuild[],
): void {
  const vstatusByReqId: Record<string, ReqVStatus> = {};
  (verificationSummary ?? []).forEach(v => { vstatusByReqId[v.requirementId] = v.vstatus; });
  const idToKey: Record<string, string> = {};
  items.forEach(item => { idToKey[item.id] = item.key; });

  REQS.length = 0;
  items.forEach(item => {
    REQS.push(mk({
      key: item.key,
      parent: item.parentId ? idToKey[item.parentId] ?? null : null,
      type: REQ_TYPE_FROM_API[item.type] ?? 'component-req',
      category: item.category as ReqCategory,
      priority: item.priority as ReqPriority,
      status: item.status as ReqStatus,
      vmethod: 'test',
      vstatus: vstatusByReqId[item.id] ?? 'not-verified',
      owner: item.ownerId ?? '',
      title: item.title,
      statement: item.statement,
      rationale: item.rationale ?? '',
      source: item.source ?? '',
      standard: item.standard,
      target: item.targetValue !== null
        ? { value: item.targetValue, tolerance: item.targetTolerance ?? '', unit: item.targetUnit ?? '' }
        : null,
      version: item.version,
      updated: formatUpdated(item.updatedAt),
      _id: item.id,
      _groupId: item.groupId,
    }));
  });

  Object.keys(BY_KEY).forEach(k => delete BY_KEY[k]);
  REQS.forEach(r => { BY_KEY[r.key] = r; r.group = groupOf(r.key); });

  const children: Record<string, string[]> = {};
  REQS.forEach(r => { if (r.parent) (children[r.parent] = children[r.parent] ?? []).push(r.key); });
  REQS.forEach(r => { r.childKeys = children[r.key] ?? []; });

  // requirement_links, keyed by the *from* requirement's key. depends/conflicts
  // stay plain string[] (matching the Requirement interface) for whatever else
  // might read them; the richer per-link status lives only in r.links below.
  REQS.forEach(r => { r.depends = []; r.conflicts = []; });
  const byId: Record<string, Requirement> = {};
  REQS.forEach(r => { if (r._id) byId[r._id] = r; });
  const extraLinksByKey: Record<string, ReqLink[]> = {};
  (links ?? []).forEach(link => {
    const from = byId[link.fromId];
    const to = byId[link.toId];
    if (!from || !to) return;
    const status: ReqLink['status'] = link.status === 'suspect' ? 'suspect' : 'valid';
    if (link.linkType === 'depends_on') from.depends.push(to.key);
    if (link.linkType === 'conflicts_with') from.conflicts.push(to.key);
    (extraLinksByKey[from.key] ??= []).push({ type: link.linkType, target: to.key, status, _linkId: link.id });
    // Same edge, visible from the other side too — otherwise a peer link
    // (depends_on/conflicts_with) only ever shows up on the requirement it
    // was created *from*, and the other end has no way to know it's linked
    // at all. derives_from's inverse isn't added here: it's already covered
    // by the childKeys-derived refined_by link whenever the two are actually
    // parent/child, and an extra derives_from link not on the primary tree
    // doesn't have a natural single inverse label the way depends/conflicts do.
    if (link.linkType === 'depends_on') {
      (extraLinksByKey[to.key] ??= []).push({ type: 'depended_on_by', target: from.key, status, _linkId: link.id });
    } else if (link.linkType === 'conflicts_with') {
      (extraLinksByKey[to.key] ??= []).push({ type: 'conflicts_with', target: from.key, status, _linkId: link.id });
    }
  });

  const allocByReqId: Record<string, ApiRequirementAllocationForRebuild[]> = {};
  (allocations ?? []).forEach(a => { (allocByReqId[a.requirementId] ??= []).push(a); });

  const ecoSuspectsByReqId: Record<string, ApiEcoSuspectForRebuild[]> = {};
  (ecoSuspects ?? []).forEach(s => { (ecoSuspectsByReqId[s.requirementId] ??= []).push(s); });

  REQS.forEach(r => {
    const links: ReqLink[] = [];
    if (r.parent && BY_KEY[r.parent]) links.push({ type:'derives_from', target:r.parent, status:'valid' });
    else if (r.type !== 'stakeholder-need' && r.source) links.push({ type:'traces_to_source', target:r.source, status:'valid', external:true });
    r.childKeys.forEach(c => links.push({ type:'refined_by', target:c, status:'valid' }));
    (extraLinksByKey[r.key] ?? []).forEach(l => links.push(l));
    const alloc = r._id ? allocByReqId[r._id] ?? [] : [];
    alloc.forEach(a => links.push({
      type:'allocated_to', target:a.partNumber, status:'valid', kind:'part',
      qty: stockByPartId?.get(a.partId),
    }));
    r.alloc = alloc.map(a => a.partNumber);
    const ecoLinks = r._id ? ecoSuspectsByReqId[r._id] ?? [] : [];
    ecoLinks.forEach(s => links.push({ type:'flagged_by_eco', target:s.ecoNum, status:'suspect', kind:'eco', external:true }));
    r.links = links;
    const hasSource = r.type === 'stakeholder-need' || links.some(l => l.type === 'derives_from' || l.type === 'traces_to_source');
    const needsImpl = r.type === 'subsystem-req' || r.type === 'component-req';
    // Before allocations have loaded (undefined), default unimplemented to true
    // for the tiers that need it rather than flashing "fully covered".
    const unimplemented = needsImpl && (allocations === undefined || alloc.length === 0);
    // 'not-verified' (never run) and 'failed' both count as a gap; 'in-progress',
    // 'passed' and 'waived' all mean something real has happened, even if not
    // everything's finished — matches the same "don't flash a false-positive
    // before data loads" caution as `unimplemented` below: before verificationSummary
    // has loaded at all, every requirement defaults to 'not-verified' anyway,
    // so this stays correctly conservative either way.
    const untested = r.vstatus === 'not-verified' || r.vstatus === 'failed';
    r.coverage = { orphan:!hasSource, untested, unimplemented, suspect: links.some(l => l.status === 'suspect') };
    r.hasGap = r.coverage.orphan || r.coverage.untested || r.coverage.unimplemented || r.coverage.suspect;
  });

  REQ_ROOTS.length = 0;
  REQS.filter(r => !r.parent).forEach(r => REQ_ROOTS.push(r.key));
}

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
    verifiedPct: total ? Math.round(verified/total*100) : 0,
    approvedPct: total ? Math.round(approved/total*100) : 0 };
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

// ── Multi-hop trace (plan §B: forward/backward/"final proof" queries) ──────────
// `descendants`/`ancestors` above only walk the derives_from/refined_by tree.
// `traceDown`/`traceUp` widen that to a real graph walk that also follows
// depends_on/depended_on_by peer edges (from real `requirement_links` rows),
// so "everything that implements this" and "why does this exist" answer with
// the full transitive closure, not just the tree. Cycle-safe via the `seen`
// set — depends_on isn't guaranteed acyclic the way the tree is (the backend
// only rejects self-links/duplicates/cross-project, not general graph cycles).
export interface TraceEdge { from: string; to: string; kind: 'tree' | 'depends' | 'alloc'; }

/** Forward closure from `key`: every requirement reachable via child tree
 * edges or depends_on edges, plus every BOM part allocated anywhere in that
 * closure (deduped). `reqs` excludes `key` itself. */
export function traceDown(key: string): { reqs: string[]; parts: string[]; edges: TraceEdge[] } {
  const seen = new Set<string>([key]);
  const parts = new Set<string>();
  const edges: TraceEdge[] = [];
  const queue = [key];
  while (queue.length) {
    const k = queue.shift()!;
    const r = BY_KEY[k]; if (!r) continue;
    r.childKeys.forEach(c => {
      edges.push({ from: k, to: c, kind: 'tree' });
      if (!seen.has(c)) { seen.add(c); queue.push(c); }
    });
    r.links.forEach(l => {
      if (l.type === 'depends_on' && BY_KEY[l.target]) {
        edges.push({ from: k, to: l.target, kind: 'depends' });
        if (!seen.has(l.target)) { seen.add(l.target); queue.push(l.target); }
      }
    });
    r.alloc.forEach(p => { edges.push({ from: k, to: p, kind: 'alloc' }); parts.add(p); });
  }
  seen.delete(key);
  return { reqs: Array.from(seen), parts: Array.from(parts), edges };
}

/** Backward closure from `key`: every requirement reachable via the parent
 * tree or depended_on_by edges. `roots` are the requirements in that closure
 * (`key` included, if it qualifies) with no parent of their own — the
 * stakeholder-need(s) that ultimately justify `key`'s existence. `reqs`
 * excludes `key` itself. */
export function traceUp(key: string): { reqs: string[]; roots: string[]; edges: TraceEdge[] } {
  const seen = new Set<string>([key]);
  const edges: TraceEdge[] = [];
  const queue = [key];
  while (queue.length) {
    const k = queue.shift()!;
    const r = BY_KEY[k]; if (!r) continue;
    if (r.parent && BY_KEY[r.parent]) {
      edges.push({ from: r.parent, to: k, kind: 'tree' });
      if (!seen.has(r.parent)) { seen.add(r.parent); queue.push(r.parent); }
    }
    r.links.forEach(l => {
      if (l.type === 'depended_on_by' && BY_KEY[l.target]) {
        edges.push({ from: k, to: l.target, kind: 'depends' });
        if (!seen.has(l.target)) { seen.add(l.target); queue.push(l.target); }
      }
    });
  }
  const roots = Array.from(seen).filter(k => !BY_KEY[k]?.parent);
  seen.delete(key);
  return { reqs: Array.from(seen), roots, edges };
}

/** Reverse allocation lookup — every requirement with `partNumber` in its
 * `alloc[]`. Backs the "start at a component, see why it exists" entry point
 * (plan §B/§10): pick a part, land on the requirement(s) that justify it. */
export function requirementsAllocatingPart(partNumber: string): string[] {
  return REQS.filter(r => r.alloc.includes(partNumber)).map(r => r.key);
}

/** Every part number allocated to at least one requirement in the project,
 * sorted — backs the part picker for the "start at a component" trace mode. */
export function allAllocatedParts(): string[] {
  const s = new Set<string>();
  REQS.forEach(r => r.alloc.forEach(p => s.add(p)));
  return Array.from(s).sort();
}

/** Live Inventory snapshot for a bare part number, reusing whatever
 * `allocated_to` link already carries it — same value regardless of which
 * requirement's link it's read from, since both come from the same
 * `stockByPartId` join. Returns undefined for a part never stocked. */
export function qtyForPart(partNumber: string): AllocatedPartStock | undefined {
  for (const r of REQS) {
    const l = r.links.find(l => l.kind === 'part' && l.target === partNumber && l.qty);
    if (l?.qty) return l.qty;
  }
  return undefined;
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
  const approvedPct = critical.length ? Math.round(approved/critical.length*100) : 0;
  const verifiedPct = sysSub.length ? Math.round(verified/sysSub.length*100) : 0;
  const score = Math.round(approvedPct*0.5 + verifiedPct*0.5);
  return { critical:critical.length, approved, approvedPct, sysSub:sysSub.length, verified, verifiedPct, blockers, score };
}

/**
 * `vstatusOverride`, when given, replaces each requirement's project-wide
 * `vstatus` with a build-scoped one (plan §F: "Coverage and Readiness
 * dashboards roll up from real build-level pass/fail" — is *this specific
 * physical unit* ready, not "has this requirement ever passed on any unit").
 * A requirement absent from the override (never tested against that build)
 * reads as 'not-verified', matching the backend's own omit-vs-empty
 * convention for the build-scoped verification-summary endpoint.
 */
export function manufacturingReadiness(vstatusOverride?: Map<string, ReqVStatus>) {
  const vstatusOf = (r: Requirement): ReqVStatus =>
    vstatusOverride ? (r._id ? (vstatusOverride.get(r._id) ?? 'not-verified') : 'not-verified') : r.vstatus;
  return (Object.keys(REQ_GROUP) as ReqGroup[]).map(g => {
    const reqs = REQS.filter(r => r.group === g && (r.type === 'subsystem-req' || r.type === 'component-req'));
    if (!reqs.length) return null;
    const parts = new Set<string>(); reqs.forEach(r => (r.alloc ?? []).forEach(p => parts.add(p)));
    const verif = reqs.filter(r => r.status === 'verified' || r.status === 'validated' || vstatusOf(r) === 'passed').length;
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
