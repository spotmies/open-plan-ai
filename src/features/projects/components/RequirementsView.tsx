import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  ChevronRight, ChevronDown, SlidersHorizontal, Search,
  Plus, Download, GitBranch, X, Hash,
  AlertTriangle, Check, ArrowUpDown, Cpu, Zap, Package, Package2,
  Monitor, Shield, Lock, Flag, Activity, FlaskConical, BookOpen,
  GitPullRequest, TriangleAlert, ClipboardCheck, Layers,
  ListChecks, Boxes, Share2, Network, Gauge, Target,
  ListTree, ArrowDownAZ, ShieldCheck, Unlink, PackageX, UserPlus,
  ChevronsDownUp, ChevronsUpDown, CheckCircle, Table2, GitMerge,
  Maximize2, RefreshCw, Minus,
} from 'lucide-react';
import {
  REQS, BY_KEY, REQ_ROOTS, REQ_TYPE, REQ_CATEGORY, REQ_STATUS,
  REQ_VSTATUS, REQ_PRIORITY, REQ_GROUP, REQ_LINKTYPE, GAP_META, REQ_TEAM,
  flattenTree, matchWithAncestors, descendants, ancestors, coverageBy, worstOffenders,
  reqStats, vDistribution, standardsRollup, gateReadiness, manufacturingReadiness,
  GATES, STANDARDS,
  type Requirement, type ReqType, type ReqCategory, type ReqStatus,
  type ReqVStatus, type ReqPriority, type ReqGroup,
} from './requirementsData';
import {
  ReqKeyTag, TypePill, CatPill, StatusBadge, VStatusBadge, PriorityPill,
  CoverageCell, OwnerAvatar, Donut, StatTile, CoverageBar, ScoreRing, softTint,
} from './RequirementsShared';
import RequirementDetailScreen from './RequirementDetailScreen';
import RequirementEditor from './RequirementEditor';
import RequirementImpact from './RequirementImpact';

// ── Group icons ────────────────────────────────────────────────────────────────
const GROUP_ICONS: Record<ReqGroup, React.ElementType> = {
  SYS: Boxes, PWR: Zap, CTL: Cpu, CHD: Package, ENC: Package2,
  HMI: Monitor, SAF: Shield, SEC: Lock, STK: Flag,
};

// ── Sort options (module-level so SortDropdown can reference) ──────────────────
type SortField = 'tree' | 'key' | 'title' | 'priority' | 'status' | 'verification';

const SORT_OPTS: { id: SortField; icon: React.ElementType; label: string }[] = [
  { id: 'tree', icon: ListTree, label: 'Hierarchy' },
  { id: 'key', icon: Hash, label: 'Key (A→Z)' },
  { id: 'title', icon: ArrowDownAZ, label: 'Title (A→Z)' },
  { id: 'priority', icon: Flag, label: 'Priority' },
  { id: 'status', icon: GitBranch, label: 'Status' },
  { id: 'verification', icon: CheckCircle, label: 'Verification' },
];

// ── Filter state ───────────────────────────────────────────────────────────────
interface FilterState {
  search: string; type: ReqType[]; category: ReqCategory[]; status: ReqStatus[];
  vstatus: ReqVStatus[]; priority: ReqPriority[]; group: ReqGroup[];
  gap: keyof typeof GAP_META | null; owner: string[];
}
const emptyFilters = (): FilterState => ({
  search: '', type: [], category: [], status: [], vstatus: [],
  priority: [], group: [], gap: null, owner: [],
});

// Returns true boolean — prevents {0 && <div/>} rendering "0" in JSX
const hasActiveFilters = (f: FilterState): boolean =>
  f.search !== '' || f.type.length > 0 || f.category.length > 0 || f.status.length > 0 ||
  f.vstatus.length > 0 || f.priority.length > 0 || f.group.length > 0 ||
  f.gap !== null || f.owner.length > 0;

type ViewTab = 'table' | 'map' | 'trace' | 'coverage' | 'readiness';

// ── Main component ────────────────────────────────────────────────────────────
export default function RequirementsView() {
  const [view, setView] = useState<ViewTab>('table');
  const [filters, setFilters] = useState<FilterState>(emptyFilters());
  const [sortField, setSortField] = useState<SortField>('tree');
  // Default: all parent nodes collapsed
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    REQS.forEach(r => { if (r.childKeys.length) m[r.key] = false; });
    return m;
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [impactKey, setImpactKey] = useState<string | null>(null);

  const stats = useMemo(() => reqStats(), []);

  const filterSet = useMemo((): Set<string> | null => {
    if (!hasActiveFilters(filters)) return null;
    const txt = filters.search.toLowerCase();
    return matchWithAncestors(r => {
      if (filters.type.length && !filters.type.includes(r.type)) return false;
      if (filters.category.length && !filters.category.includes(r.category)) return false;
      if (filters.status.length && !filters.status.includes(r.status)) return false;
      if (filters.vstatus.length && !filters.vstatus.includes(r.vstatus)) return false;
      if (filters.priority.length && !filters.priority.includes(r.priority)) return false;
      if (filters.group.length && !filters.group.includes(r.group)) return false;
      if (filters.owner.length && !filters.owner.includes(r.owner)) return false;
      if (filters.gap !== null && !r.coverage[filters.gap]) return false;
      if (txt && !r.key.toLowerCase().includes(txt) &&
        !r.title.toLowerCase().includes(txt) &&
        !r.statement.toLowerCase().includes(txt)) return false;
      return true;
    });
  }, [filters]);

  const rows = useMemo(() => {
    const filtersActive = hasActiveFilters(filters);
    const sortMode = sortField !== 'tree';
    if (filtersActive || sortMode) {
      // Flat list: use all matching rows at depth 0
      const flatRows = filtersActive
        ? flattenTree({}, filterSet ?? undefined).map(r => ({ ...r, depth: 0 }))
        : flattenTree({});
      if (!sortMode) return flatRows;
      return [...flatRows].sort((a, b) => {
        if (sortField === 'key') return a.key.localeCompare(b.key);
        if (sortField === 'title') return a.title.localeCompare(b.title);
        if (sortField === 'priority') return REQ_PRIORITY[a.priority].rank - REQ_PRIORITY[b.priority].rank;
        if (sortField === 'status') return REQ_STATUS[b.status].step - REQ_STATUS[a.status].step;
        if (sortField === 'verification') return a.vstatus.localeCompare(b.vstatus);
        return 0;
      });
    }
    return flattenTree(expanded, filterSet ?? undefined);
  }, [expanded, filterSet, sortField, filters]);

  // Expand / collapse all
  const expandAll = useCallback(() => setExpanded({}), []);
  const collapseAll = useCallback(() => {
    const m: Record<string, boolean> = {};
    REQS.forEach(r => { if (r.childKeys.length) m[r.key] = false; });
    setExpanded(m);
  }, []);
  const anyExpanded = useMemo(
    () => REQS.some(r => r.childKeys.length > 0 && expanded[r.key] !== false),
    [expanded],
  );

  const toggleExpand = useCallback((key: string) =>
    setExpanded(p => ({ ...p, [key]: p[key] === false ? true : false })), []);

  const toggleSelect = useCallback((key: string) =>
    setSelected(p => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; }), []);

  const allVisible = rows.map(r => r.key);
  const allSelected = allVisible.length > 0 && allVisible.every(k => selected.has(k));
  const toggleAll = () => allSelected ? setSelected(new Set()) : setSelected(new Set(allVisible));

  const drillToTable = useCallback((gapKey: keyof typeof GAP_META | null, extra?: Partial<FilterState>) => {
    setFilters({ ...emptyFilters(), ...(gapKey ? { gap: gapKey } : {}), ...(extra ?? {}) });
    setView('table');
  }, []);

  const openDetail = useCallback((key: string) => setDetailKey(key), []);
  const openEditor = useCallback((key?: string) => { setEditKey(key ?? null); setEditorOpen(true); }, []);

  if (detailKey) return (
    <RequirementDetailScreen reqKey={detailKey} onClose={() => setDetailKey(null)}
      onEdit={key => { setDetailKey(null); openEditor(key); }}
      onImpact={key => setImpactKey(key)} onNavigate={openDetail} />
  );
  if (editorOpen) return (
    <RequirementEditor reqKey={editKey}
      onClose={() => { setEditorOpen(false); setEditKey(null); }}
      onSaved={() => { setEditorOpen(false); setEditKey(null); }} />
  );

  const showExpandToggle = view === 'table' && !hasActiveFilters(filters) && sortField === 'tree';
  const activeFilterCount = filterSet?.size ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'hsl(var(--background))' }}>

      {/* ── Toolbar ── */}
      <div style={{ borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

        {/* Page header — title + project selector + rev badge + action buttons */}
        <div style={{ padding: '12px 20px 10px', display: 'flex', alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 10 }}>

            {/* Left: title, project, rev */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <ListChecks size={20} color="#3B82F6" />
              <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: 'hsl(var(--foreground))' }}>Requirements</span>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 9px',
                borderRadius: 7, border: '1px solid hsl(var(--border))', background: 'hsl(var(--muted))',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <Monitor size={12} color="hsl(var(--muted-foreground))" />
                <span style={{ fontSize: 12.5, fontWeight: 500, color: 'hsl(var(--foreground))' }}>EV Charging Station</span>
                <ChevronDown size={10} color="hsl(var(--muted-foreground))" />
              </button>
              <span style={{
                height: 22, padding: '0 8px', borderRadius: 5,
                border: '1px solid #3B82F6', color: '#3B82F6',
                fontSize: 11.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center',
              }}>Rev C</span>
            </div>

            {/* Right: action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
                borderRadius: 7, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
                color: 'hsl(var(--foreground))',
              }}>
                <Lock size={13} />
                Live set
                <ChevronDown size={10} color="hsl(var(--muted-foreground))" />
              </button>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
                borderRadius: 7, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
                color: 'hsl(var(--foreground))',
              }}>
                <Download size={13} />
                Import
              </button>
              <button onClick={() => openEditor()} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px',
                borderRadius: 7, border: 'none', background: '#3B82F6', color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
              }}>
                <Plus size={13} />
                New Requirement
              </button>
            </div>
          </div>

          {/* Subtitle */}
          <span style={{ fontSize: 12.5, color: 'hsl(var(--muted-foreground))' }}>
            Capture, decompose, and trace requirements from stakeholder need to verification.
          </span>
        </div>

        {/* Separator */}
        <div style={{ height: 1, background: 'hsl(var(--border))' }} />

        {/* Stats tiles row */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, padding: '10px 20px' }}>
          <SummaryTile icon={ShieldCheck} label="Verified or validated" value={`${stats.verifiedPct}%`}
            tint="#16A34A" accent />
          <SummaryTile icon={Unlink} label="Orphans" value={stats.orphan} tint="#DC2626"
            gapKey="orphan" active={filters.gap === 'orphan'} onFilter={g => setFilters({ ...emptyFilters(), gap: g })} />
          <SummaryTile icon={FlaskConical} label="Untested" value={stats.untested} tint="#D97706"
            gapKey="untested" active={filters.gap === 'untested'} onFilter={g => setFilters({ ...emptyFilters(), gap: g })} />
          <SummaryTile icon={PackageX} label="Unimplemented" value={stats.unimplemented} tint="#D97706"
            gapKey="unimplemented" active={filters.gap === 'unimplemented'} onFilter={g => setFilters({ ...emptyFilters(), gap: g })} />
          <SummaryTile icon={AlertTriangle} label="Suspect links" value={stats.suspect} tint="#DC2626"
            gapKey="suspect" active={filters.gap === 'suspect'} onFilter={g => setFilters({ ...emptyFilters(), gap: g })} />
        </div>

        {/* Separator */}
        <div style={{ height: 1, background: 'hsl(var(--border))' }} />

        {/* Tab bar + controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 20px' }}>

          <ViewTabs view={view} setView={setView} />

          {/* Expand / collapse all — table tree mode only */}
          {showExpandToggle && (
            <button onClick={() => anyExpanded ? collapseAll() : expandAll()}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 10px', borderRadius: 7,
                border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))',
                color: 'hsl(var(--muted-foreground))', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
              }}>
              {anyExpanded
                ? <><ChevronsDownUp size={13} /> Collapse all</>
                : <><ChevronsUpDown size={13} /> Expand all</>}
            </button>
          )}

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, color: 'hsl(var(--muted-foreground))', pointerEvents: 'none' }} />
            <input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search key, title, or statement..."
              style={{
                paddingLeft: 30, paddingRight: filters.search ? 28 : 10, height: 32, borderRadius: 7,
                border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))', fontSize: 13, width: 260, fontFamily: 'inherit', outline: 'none',
              }} />
            {filters.search && (
              <button onClick={() => setFilters({ ...filters, search: '' })}
                style={{ position: 'absolute', right: 7, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={12} color="hsl(var(--muted-foreground))" />
              </button>
            )}
          </div>

          {/* Sort — table view only */}
          {view === 'table' && <SortDropdown sortField={sortField} setSortField={setSortField} />}

          {/* Filters — table + map views */}
          {(view === 'table' || view === 'map') && (
            <button onClick={() => setFilterDrawerOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', borderRadius: 7,
                border: `1px solid ${activeFilterCount ? 'hsl(var(--foreground))' : 'hsl(var(--border))'}`,
                background: activeFilterCount ? 'hsl(var(--muted))' : 'hsl(var(--card))',
                color: activeFilterCount ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
              }}>
              <SlidersHorizontal size={13} />
              Filters {activeFilterCount ? `(${activeFilterCount})` : ''}
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters(filters) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '0 20px 10px' }}>
            <span style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>Active:</span>
            {filters.type.map(t => <FilterChip key={t} label={REQ_TYPE[t].short} onRemove={() => setFilters({ ...filters, type: filters.type.filter(x => x !== t) })} />)}
            {filters.category.map(c => <FilterChip key={c} label={REQ_CATEGORY[c].label} onRemove={() => setFilters({ ...filters, category: filters.category.filter(x => x !== c) })} />)}
            {filters.status.map(s => <FilterChip key={s} label={REQ_STATUS[s].label} onRemove={() => setFilters({ ...filters, status: filters.status.filter(x => x !== s) })} />)}
            {filters.priority.map(p => <FilterChip key={p} label={REQ_PRIORITY[p].label} onRemove={() => setFilters({ ...filters, priority: filters.priority.filter(x => x !== p) })} />)}
            {filters.gap && (
              <FilterChip label={GAP_META[filters.gap].label.split(' ')[0]}
                tint={GAP_META[filters.gap].tint}
                onRemove={() => setFilters({ ...filters, gap: null })} />
            )}
            <button onClick={() => setFilters(emptyFilters())}
              style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', border: 'none', background: 'transparent', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {view === 'table' && (
          <ReqTable rows={rows} expanded={expanded} selected={selected}
            filtersActive={hasActiveFilters(filters)}
            toggleExpand={toggleExpand} toggleSelect={toggleSelect}
            allSelected={allSelected} toggleAll={toggleAll}
            onOpen={openDetail} onEdit={k => openEditor(k)} onImpact={k => setImpactKey(k)}
            onClearFilters={() => setFilters(emptyFilters())} />
        )}
        {view === 'map' && <RequirementsMapView onOpen={openDetail} />}
        {view === 'trace' && <TraceabilityView onOpen={openDetail} onDrill={drillToTable} />}
        {view === 'coverage' && <CoverageDashboard stats={stats} onDrill={drillToTable} onOpen={openDetail} />}
        {view === 'readiness' && <ReadinessView />}
      </div>

      {/* ── Bulk bar ── */}
      {selected.size > 0 && (
        <BulkBar count={selected.size} onClear={() => setSelected(new Set())} />
      )}

      {/* ── Filter drawer ── */}
      {filterDrawerOpen && (
        <FilterDrawer filters={filters} setFilters={setFilters} onClose={() => setFilterDrawerOpen(false)} />
      )}

      {/* ── Impact drawer ── */}
      {impactKey && (
        <RequirementImpact reqKey={impactKey} onClose={() => setImpactKey(null)} onOpen={openDetail} />
      )}
    </div>
  );
}

// ── Summary tile (large card, reference style) ─────────────────────────────────
function SummaryTile({ icon: Ic, label, value, tint, gapKey, active, accent, onFilter }:
  {
    icon: React.ElementType; label: string; value: string | number; tint: string;
    gapKey?: string; active?: boolean; accent?: boolean; onFilter?: (k: string | null) => void
  }) {
  const [hov, setHov] = useState(false);
  const clickable = !!gapKey && !!onFilter;
  return (
    <button
      onClick={() => clickable && onFilter!(active ? null : gapKey!)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '8px 13px', borderRadius: 9,
        background: active ? softTint(tint, 0.10) : hov && clickable ? 'hsl(var(--muted))' : 'hsl(var(--card))',
        border: `1px solid ${active ? softTint(tint, 0.35) : 'hsl(var(--border))'}`,
        cursor: clickable ? 'pointer' : 'default', fontFamily: 'inherit',
        transition: 'border-color .12s, background .12s'
      }}>
      <span style={{
        width: 30, height: 30, borderRadius: 8, background: softTint(tint, 0.12),
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Ic size={15} color={tint} />
      </span>
      <span style={{ textAlign: 'left', minWidth: 0 }}>
        <span style={{
          display: 'block', fontSize: 19, fontWeight: 700,
          color: accent ? tint : 'hsl(var(--foreground))', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums'
        }}>
          {value}
        </span>
        <span style={{ display: 'block', fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
      </span>
    </button>
  );
}

// ── View tabs (gray container, reference style) ────────────────────────────────
const VIEW_TABS: { key: ViewTab; icon: React.ElementType; label: string }[] = [
  { key: 'table', icon: Table2, label: 'Table' },
  { key: 'map', icon: Share2, label: 'Map' },
  { key: 'trace', icon: Network, label: 'Traceability' },
  { key: 'coverage', icon: Gauge, label: 'Coverage' },
  { key: 'readiness', icon: Target, label: 'Readiness' },
];
function ViewTabs({ view, setView }: { view: ViewTab; setView: (v: ViewTab) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', background: 'hsl(var(--muted))',
      border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 3, gap: 2
    }}>
      {VIEW_TABS.map(v => {
        const Ic = v.icon;
        const active = view === v.key;
        return (
          <button key={v.key} onClick={() => setView(v.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: 'none',
              fontFamily: 'inherit', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: active ? 600 : 400,
              background: active ? 'hsl(var(--card))' : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(20,24,31,0.10)' : 'none',
              color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              transition: 'background .12s, color .12s'
            }}>
            <Ic size={13} />{v.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Sort dropdown (reference style, not <select>) ─────────────────────────────
function SortDropdown({ sortField, setSortField }: { sortField: SortField; setSortField: (s: SortField) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SORT_OPTS.find(o => o.id === sortField) ?? SORT_OPTS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 10px', borderRadius: 7,
          border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500
        }}>
        <current.icon size={13} />
        {current.label}
        <ChevronDown size={11} style={{ marginLeft: 2, color: 'hsl(var(--muted-foreground))' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: 186,
          background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 9,
          boxShadow: '0 8px 28px rgba(0,0,0,0.14)', zIndex: 30, overflow: 'hidden', padding: 4
        }}>
          {SORT_OPTS.map(o => {
            const OIc = o.icon;
            const active = sortField === o.id;
            return (
              <button key={o.id} onClick={() => { setSortField(o.id); setOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px',
                  border: 'none', fontFamily: 'inherit', cursor: 'pointer', fontSize: 12.5, borderRadius: 6,
                  background: active ? 'hsl(var(--muted))' : 'transparent',
                  color: 'hsl(var(--foreground))',
                  fontWeight: active ? 600 : 400, textAlign: 'left'
                }}>
                <OIc size={13} color={active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'} />
                {o.label}
                {active && <Check size={12} color="hsl(var(--foreground))" style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Filter chip ────────────────────────────────────────────────────────────────
function FilterChip({ label, onRemove, tint }: { label: string; onRemove: () => void; tint?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px 2px 9px', borderRadius: 9999,
      background: tint ? softTint(tint, 0.10) : 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
      fontSize: 11.5, color: tint ?? 'hsl(var(--foreground))'
    }}>
      {label}
      <button onClick={onRemove} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex' }}>
        <X size={10} />
      </button>
    </span>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
// 12 columns matching reference: sel(36) key(188) title(1fr) type(108) cat(118) pri(96) status(112) vstat(128) owner(62) cov(106) ver(54) act(34)
const COL_TEMPLATE = '36px 188px 1fr 108px 118px 96px 112px 128px 62px 106px 54px 34px';
const TABLE_MIN_W = 1240;

const COL_HEADERS = ['', 'Key', 'Requirement', 'Type', 'Category', 'Priority', 'Status', 'Verification', '', 'Coverage', 'Ver.', ''];

function ReqTable({ rows, expanded, selected, filtersActive, toggleExpand, toggleSelect,
  allSelected, toggleAll, onOpen, onEdit, onImpact, onClearFilters }:
  {
    rows: (Requirement & { depth: number })[]; expanded: Record<string, boolean>; selected: Set<string>;
    filtersActive: boolean; toggleExpand: (k: string) => void; toggleSelect: (k: string) => void;
    allSelected: boolean; toggleAll: () => void; onOpen: (k: string) => void; onEdit: (k: string) => void;
    onImpact: (k: string) => void; onClearFilters: () => void
  }) {

  if (!rows.length) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48 }}>
      <ListChecks size={40} color="hsl(var(--muted-foreground))" />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'hsl(var(--foreground))' }}>No requirements match</div>
      <button onClick={onClearFilters} style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', border: 'none', background: 'transparent', cursor: 'pointer', textDecoration: 'underline' }}>
        Clear filters
      </button>
    </div>
  );

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: COL_TEMPLATE,
    minWidth: TABLE_MIN_W,
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: TABLE_MIN_W }}>
        <div style={{ ...gridStyle, background: 'hsl(var(--card))', borderBottom: '1px solid hsl(var(--border))', padding: '0 6px', alignItems: 'center', height: 36 }}>
          {/* checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll}
              style={{ cursor: 'pointer', accentColor: 'hsl(var(--foreground))' }} />
          </div>
          {COL_HEADERS.slice(1).map((h, i) => (
            <div key={i} style={{
              fontSize: 10.5, fontWeight: 700, color: 'hsl(var(--muted-foreground))',
              textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center',
              padding: i === 0 ? '0 0 0 4px' : '0 4px', overflow: 'hidden', whiteSpace: 'nowrap'
            }}>
              {h}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div style={{ minWidth: TABLE_MIN_W }}>
        {rows.map(r => (
          <TableRow key={r.key} r={r}
            isExpanded={expanded[r.key] !== false && r.childKeys.length > 0}
            isSelected={selected.has(r.key)}
            filtersActive={filtersActive}
            gridStyle={gridStyle}
            onToggle={() => toggleExpand(r.key)}
            onSelect={() => toggleSelect(r.key)}
            onOpen={() => onOpen(r.key)}
            onEdit={() => onEdit(r.key)}
            onImpact={() => onImpact(r.key)} />
        ))}
        {/* footer */}
        <div style={{
          minWidth: TABLE_MIN_W, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
          borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--card))'
        }}>
          <span style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
            Showing {rows.length} requirement{rows.length !== 1 ? 's' : ''}
            {filtersActive ? ' (filtered)' : ''}
          </span>
          <span style={{ width: 4, height: 4, borderRadius: 9999, background: 'hsl(var(--border))', flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>Baseline BL-2.0 · 5-tier decomposition</span>
        </div>
      </div>
    </div>
  );
}

function TableRow({ r, isExpanded, isSelected, filtersActive, gridStyle, onToggle, onSelect, onOpen, onEdit, onImpact }:
  {
    r: Requirement & { depth: number }; isExpanded: boolean; isSelected: boolean; filtersActive: boolean;
    gridStyle: React.CSSProperties; onToggle: () => void; onSelect: () => void;
    onOpen: () => void; onEdit: () => void; onImpact: () => void
  }) {

  const [hov, setHov] = useState(false);
  const [actHov, setActHov] = useState(false);
  const hasChildren = r.childKeys.length > 0;
  const depth = filtersActive ? 0 : r.depth;
  const ver = (r as Record<string, unknown>).ver as string | undefined;

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        ...gridStyle, alignItems: 'center', height: 38, padding: '0 6px',
        borderBottom: '1px solid hsl(var(--border))',
        background: isSelected ? 'hsl(var(--muted))' : hov ? 'hsl(var(--muted))' : 'hsl(var(--background))',
        borderLeft: `3px solid ${isSelected ? 'hsl(var(--foreground))' : 'transparent'}`,
        transition: 'background .1s'
      }}>

      {/* checkbox */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <input type="checkbox" checked={isSelected} onChange={onSelect}
          onClick={e => e.stopPropagation()} style={{ cursor: 'pointer', accentColor: 'hsl(var(--foreground))' }} />
      </div>

      {/* key + tree control (188px) */}
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 4, overflow: 'hidden' }}>
        {/* depth spacer */}
        <span style={{ width: depth * 14, flexShrink: 0 }} />
        {/* expand/collapse or dot */}
        {hasChildren && !filtersActive ? (
          <button onClick={e => { e.stopPropagation(); onToggle(); }}
            style={{
              width: 16, height: 16, borderRadius: 4, border: 'none', background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0
            }}>
            {isExpanded
              ? <ChevronDown size={12} color="hsl(var(--muted-foreground))" />
              : <ChevronRight size={12} color="hsl(var(--muted-foreground))" />}
          </button>
        ) : (
          <span style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!hasChildren && <span style={{ width: 4, height: 4, borderRadius: 9999, background: 'hsl(var(--border))' }} />}
          </span>
        )}
        {/* key tag */}
        <span onClick={onOpen} style={{ marginLeft: 4, overflow: 'hidden' }}>
          <ReqKeyTag reqKey={r.key} onClick={onOpen} />
        </span>
        {r.coverage.suspect && (
          <AlertTriangle size={11} color="#DC2626" style={{ marginLeft: 4, flexShrink: 0 }} title="Suspect link" />
        )}
      </div>

      {/* title (1fr) */}
      <div onClick={onOpen} style={{
        fontSize: 12.5, color: 'hsl(var(--foreground))', overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', paddingRight: 8
      }} title={r.title}>
        {r.hasGap && (
          <AlertTriangle size={11} color="#D97706" style={{ marginRight: 4, verticalAlign: 'middle', flexShrink: 0 }} />
        )}
        {r.title}
      </div>

      {/* type */}
      <div style={{ overflow: 'hidden' }}><TypePill type={r.type} /></div>

      {/* category */}
      <div style={{ overflow: 'hidden' }}><CatPill category={r.category} /></div>

      {/* priority */}
      <div style={{ overflow: 'hidden' }}><PriorityPill priority={r.priority} /></div>

      {/* status */}
      <div style={{ overflow: 'hidden' }}><StatusBadge status={r.status} /></div>

      {/* vstatus */}
      <div style={{ overflow: 'hidden' }}><VStatusBadge vstatus={r.vstatus} /></div>

      {/* owner avatar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <OwnerAvatar ownerId={r.owner} />
      </div>

      {/* coverage */}
      <div style={{ display: 'flex', alignItems: 'center' }}><CoverageCell coverage={r.coverage} /></div>

      {/* ver */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5,
          color: 'hsl(var(--muted-foreground))', fontVariantNumeric: 'tabular-nums'
        }}>
          {ver ?? '—'}
        </span>
      </div>

      {/* actions */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
        opacity: hov ? 1 : 0, transition: 'opacity .1s'
      }}>
        <RowBtn icon={GitPullRequest} title="Change impact" onClick={e => { e.stopPropagation(); onImpact(); }} />
      </div>
    </div>
  );
}

function RowBtn({ icon: Ic, title, onClick }: { icon: React.ElementType; title: string; onClick: (e: React.MouseEvent) => void }) {
  const [h, setH] = useState(false);
  return (
    <button title={title} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: 22, height: 22, borderRadius: 5, border: 'none',
        background: h ? 'hsl(var(--muted))' : 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
      }}>
      <Ic size={12} color="hsl(var(--muted-foreground))" />
    </button>
  );
}

// ── Bulk bar ───────────────────────────────────────────────────────────────────
function BulkBar({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <div style={{
      position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
      background: 'hsl(var(--foreground))', color: 'hsl(var(--background))', borderTop: '1px solid rgba(255,255,255,0.15)', zIndex: 10
    }}>
      <Check size={15} /> <span style={{ fontSize: 13, fontWeight: 600 }}>{count} selected</span>
      <div style={{ flex: 1 }} />
      <BulkBtn label="Bulk approve" icon={Check} />
      <BulkBtn label="Assign owner" icon={UserPlus} />
      <BulkBtn label="Baseline" icon={GitMerge} />
      <BulkBtn label="Export CSV" icon={Download} />
      <button onClick={onClear} style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7,
        border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'hsl(var(--background))', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5
      }}>
        <X size={12} /> Clear
      </button>
    </div>
  );
}
function BulkBtn({ label, icon: Ic }: { label: string; icon: React.ElementType }) {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 7,
      border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500
    }}>
      <Ic size={12} />{label}
    </button>
  );
}

// ── Filter drawer ──────────────────────────────────────────────────────────────
function FilterDrawer({ filters, setFilters, onClose }: { filters: FilterState; setFilters: (f: FilterState) => void; onClose: () => void }) {
  const upd = <K extends keyof FilterState>(key: K, val: FilterState[K]) => setFilters({ ...filters, [key]: val });
  const toggleArr = <T,>(arr: T[], val: T): T[] => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 80 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, maxWidth: '94vw', zIndex: 81,
        background: 'hsl(var(--card))', borderLeft: '1px solid hsl(var(--border))',
        display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(0,0,0,0.15)'
      }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid hsl(var(--border))' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Filters</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setFilters(emptyFilters())} style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', border: 'none', background: 'transparent', cursor: 'pointer', textDecoration: 'underline' }}>Reset</button>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <DrawerSection label="Gap type">
            {(Object.keys(GAP_META) as (keyof typeof GAP_META)[]).map(g => {
              const m = GAP_META[g]; const active = filters.gap === g;
              return <DrawerChip key={g} label={m.label.split(' ')[0]} tint={m.tint} active={active}
                onClick={() => upd('gap', active ? null : g)} />;
            })}
          </DrawerSection>
          <DrawerSection label="Priority">
            {(Object.keys(REQ_PRIORITY) as ReqPriority[]).map(p => {
              const m = REQ_PRIORITY[p];
              return <DrawerChip key={p} label={m.label} tint={m.tint} active={filters.priority.includes(p)}
                onClick={() => upd('priority', toggleArr(filters.priority, p))} />;
            })}
          </DrawerSection>
          <DrawerSection label="Status">
            {(Object.keys(REQ_STATUS) as ReqStatus[]).map(s => {
              const m = REQ_STATUS[s];
              return <DrawerChip key={s} label={m.label} tint={m.tint} active={filters.status.includes(s)}
                onClick={() => upd('status', toggleArr(filters.status, s))} />;
            })}
          </DrawerSection>
          <DrawerSection label="Type">
            {(Object.keys(REQ_TYPE) as ReqType[]).map(t => {
              const m = REQ_TYPE[t];
              return <DrawerChip key={t} label={m.short} tint={m.tint} active={filters.type.includes(t)}
                onClick={() => upd('type', toggleArr(filters.type, t))} />;
            })}
          </DrawerSection>
          <DrawerSection label="Category">
            {(Object.keys(REQ_CATEGORY) as ReqCategory[]).map(c => {
              const m = REQ_CATEGORY[c];
              return <DrawerChip key={c} label={m.label} tint={m.tint} active={filters.category.includes(c)}
                onClick={() => upd('category', toggleArr(filters.category, c))} />;
            })}
          </DrawerSection>
          <DrawerSection label="Subsystem">
            {(Object.keys(REQ_GROUP) as ReqGroup[]).map(g => {
              const m = REQ_GROUP[g];
              return <DrawerChip key={g} label={m.label} tint={m.tint} active={filters.group.includes(g)}
                onClick={() => upd('group', toggleArr(filters.group, g))} />;
            })}
          </DrawerSection>
          <DrawerSection label="Owner">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {REQ_TEAM.map(m => {
                const active = filters.owner.includes(m.id);
                return (
                  <button key={m.id} onClick={() => upd('owner', toggleArr(filters.owner, m.id))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 9999,
                      border: `1px solid ${active ? m.color : 'hsl(var(--border))'}`,
                      background: active ? softTint(m.color, 0.12) : 'hsl(var(--card))', cursor: 'pointer', fontFamily: 'inherit'
                    }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 9999, background: softTint(m.color, 0.18), color: m.color,
                      fontSize: 9.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {m.initials}
                    </span>
                    <span style={{ fontSize: 12, color: 'hsl(var(--foreground))', fontWeight: 500 }}>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </DrawerSection>
        </div>
      </div>
    </>
  );
}

function DrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
    </div>
  );
}

function DrawerChip({ label, tint, active, onClick }: { label: string; tint: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 9999,
        border: `1px solid ${active ? tint : 'hsl(var(--border))'}`,
        background: active ? softTint(tint, 0.12) : 'hsl(var(--card))',
        color: active ? tint : 'hsl(var(--foreground))',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: active ? 600 : 400, transition: 'all .1s'
      }}>
      {label}
    </button>
  );
}

// ── Coverage dashboard ─────────────────────────────────────────────────────────
function CoverageDashboard({ stats, onDrill, onOpen }:
  { stats: ReturnType<typeof reqStats>; onDrill: (g: keyof typeof GAP_META | null, extra?: Partial<FilterState>) => void; onOpen: (k: string) => void }) {
  const vd = useMemo(() => vDistribution(), []);
  const TYPE_ORDER: ReqType[] = ['stakeholder-need', 'stakeholder-req', 'system-req', 'subsystem-req', 'component-req'];
  const byTier = useMemo(() => coverageBy(r => r.type, TYPE_ORDER), []);
  const byGroup = useMemo(() => coverageBy(r => r.group).sort((a, b) => b.total - a.total), []);
  const worst = useMemo(() => worstOffenders(7), []);

  const vSegments = [
    { value: vd.passed, tint: REQ_VSTATUS.passed.tint, label: 'Passed' },
    { value: vd['in-progress'], tint: REQ_VSTATUS['in-progress'].tint, label: 'In progress' },
    { value: vd.failed, tint: REQ_VSTATUS.failed.tint, label: 'Failed' },
    { value: vd.waived, tint: REQ_VSTATUS.waived.tint, label: 'Waived' },
    { value: vd['not-verified'], tint: REQ_VSTATUS['not-verified'].tint, label: 'Not verified' },
  ];
  const passPct = Math.round(vd.passed / stats.total * 100);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'hsl(var(--background))', padding: '20px 24px 48px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>

        {/* Top row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '20px 24px', borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', flex: '1 1 460px' }}>
            <Donut segments={vSegments} total={stats.total} centerLabel={`${passPct}%`} centerSub="passed" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: 3 }}>Verification status</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}>{stats.total} requirements</div>
              {vSegments.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: s.tint, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'hsl(var(--foreground))', flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--foreground))', fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                  <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', width: 38, textAlign: 'right' }}>{Math.round(s.value / stats.total * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: '1 1 280px' }}>
            <div style={{ display: 'flex', gap: 12, flex: 1 }}>
              <StatTile label="Total requirements" value={stats.total} icon={ListChecks} tint="hsl(var(--foreground))" />
              <StatTile label="Approved & above" value={`${stats.approvedPct}%`} icon={Check} tint="#16A34A" />
            </div>
            <div style={{ display: 'flex', gap: 12, flex: 1 }}>
              <StatTile label="Open gaps" value={stats.orphan + stats.untested + stats.unimplemented + stats.suspect} icon={TriangleAlert} tint="#D97706" />
              <StatTile label="5-tier depth" value="5" icon={GitBranch} tint="#9333EA" sub="Need → Component" />
            </div>
          </div>
        </div>

        {/* Gap cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['orphan', 'untested', 'unimplemented', 'suspect'] as const).map(g => {
            const m = GAP_META[g];
            const GapIcons = { orphan: Unlink, untested: FlaskConical, unimplemented: PackageX, suspect: AlertTriangle };
            const GIc = GapIcons[g];
            return (
              <button key={g} onClick={() => onDrill(g)}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9, padding: '15px 16px',
                  borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color .12s'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: softTint(m.tint, 0.12), display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GIc size={17} color={m.tint} />
                  </span>
                  <ChevronRight size={15} color="hsl(var(--muted-foreground))" />
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: stats[g] > 0 ? m.tint : 'hsl(var(--muted-foreground))', lineHeight: 1 }}>{stats[g]}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--foreground))', marginTop: 5, textTransform: 'capitalize' }}>
                    {g === 'orphan' ? 'Orphans' : g === 'suspect' ? 'Suspect links' : g === 'untested' ? 'Untested' : 'Unimplemented'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{m.label.split('—')[1]?.trim()}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: '1px solid hsl(var(--border))' }}>
              <Layers size={15} color="hsl(var(--muted-foreground))" /><span style={{ fontSize: 13.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Coverage by tier</span>
            </div>
            <div style={{ padding: 16 }}>
              {byTier.map(t => (
                <CoverageBar key={t.key} label={REQ_TYPE[t.key as ReqType]?.label ?? t.key} total={t.total} verified={t.verified} gaps={t.gaps}
                  tint={REQ_TYPE[t.key as ReqType]?.tint} sub={`${t.verified}/${t.total}`} onClick={() => onDrill(null, { type: [t.key as ReqType] })} />
              ))}
            </div>
          </div>
          <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: '1px solid hsl(var(--border))' }}>
              <Boxes size={15} color="hsl(var(--muted-foreground))" /><span style={{ fontSize: 13.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Coverage by subsystem</span>
            </div>
            <div style={{ padding: 16 }}>
              {byGroup.map(g => (
                <CoverageBar key={g.key} label={REQ_GROUP[g.key as ReqGroup]?.label ?? g.key} total={g.total} verified={g.verified} gaps={g.gaps}
                  tint={REQ_GROUP[g.key as ReqGroup]?.tint} sub={`${g.verified}/${g.total}`} onClick={() => onDrill(null, { search: g.key })} />
              ))}
            </div>
          </div>
        </div>

        {/* Worst offenders */}
        <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: '1px solid hsl(var(--border))' }}>
            <TriangleAlert size={15} color="hsl(var(--muted-foreground))" />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'hsl(var(--foreground))', flex: 1 }}>Highest-risk gaps</span>
            <span style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>ranked by gap count × priority</span>
          </div>
          <div style={{ padding: '8px 16px' }}>
            {worst.map(({ r, n }) => {
              const gaps = (['orphan', 'untested', 'unimplemented', 'suspect'] as const).filter(g => r.coverage[g]);
              const GapIcons = { orphan: Unlink, untested: FlaskConical, unimplemented: PackageX, suspect: AlertTriangle };
              return (
                <div key={r.key} onClick={() => onOpen(r.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid hsl(var(--border))', cursor: 'pointer', borderRadius: 7, transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted))')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ width: 26, height: 26, borderRadius: 9999, flexShrink: 0, background: softTint('#DC2626', 0.1), color: '#DC2626', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
                  <ReqKeyTag reqKey={r.key} />
                  <span style={{ fontSize: 13, color: 'hsl(var(--foreground))', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                  <PriorityPill priority={r.priority} />
                  <div style={{ display: 'flex', gap: 5 }}>
                    {gaps.map(g => { const m = GAP_META[g]; const GIc = GapIcons[g]; return <span key={g} title={m.label} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 5, background: softTint(m.tint, 0.12) }}><GIc size={12} color={m.tint} /></span>; })}
                  </div>
                  <ChevronRight size={15} color="hsl(var(--muted-foreground))" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Readiness view ─────────────────────────────────────────────────────────────
function ReadinessView() {
  const gate = useMemo(() => gateReadiness(), []);
  const mfr = useMemo(() => manufacturingReadiness(), []);
  const stds = useMemo(() => standardsRollup(), []);

  const statusColor = (s: string) => s === 'compliant' || s === 'ready' ? '#16A34A' : s === 'in-progress' || s === 'at-risk' ? '#D97706' : '#DC2626';
  const statusLabel = (s: string) => s === 'compliant' ? 'Compliant' : s === 'in-progress' ? 'In Progress' : s === 'ready' ? 'Ready' : s === 'at-risk' ? 'At Risk' : 'Blocked';

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'hsl(var(--background))', padding: '20px 24px 48px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>

        {/* Gate timeline */}
        <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, padding: '20px 28px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 28 }}>Phase gate timeline</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
            {GATES.map((g, i) => {
              const isPassed  = g.state === 'passed';
              const isCurrent = g.state === 'current';
              const isFuture  = !isPassed && !isCurrent;
              const circleCol = isPassed ? '#16A34A' : isCurrent ? '#3B82F6' : 'hsl(var(--border))';
              const labelCol  = isPassed ? '#16A34A' : isCurrent ? '#3B82F6' : 'hsl(var(--muted-foreground))';
              const lineCol   = GATES[i - 1]?.state === 'passed' ? '#16A34A' : 'hsl(var(--border))';
              const initial   = (g.short ?? g.name ?? g.id).slice(0, 1).toUpperCase();
              return (
                <React.Fragment key={g.id}>
                  {i > 0 && (
                    <div style={{ flex: 1, height: 2, background: lineCol, marginTop: 21, flexShrink: 1 }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {/* Circle */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 9999, flexShrink: 0,
                      background: isPassed ? '#16A34A' : isCurrent ? '#3B82F6' : 'transparent',
                      border: `2px solid ${circleCol}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isCurrent ? `0 0 0 4px ${softTint('#3B82F6', 0.12)}` : 'none',
                    }}>
                      {isPassed
                        ? <Check size={18} color="#fff" />
                        : <span style={{ fontSize: 13, fontWeight: 700, color: isCurrent ? '#fff' : 'hsl(var(--muted-foreground))' }}>{initial}</span>}
                    </div>
                    {/* Labels */}
                    <div style={{ textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: labelCol, marginBottom: 2 }}>{g.id}</div>
                      <div style={{ fontSize: 11.5, fontWeight: isCurrent ? 600 : 400, color: isFuture ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))', lineHeight: 1.3, marginBottom: 2 }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{g.date}</div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Gate readiness */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, padding: '18px 20px', borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>G2 gate readiness</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ScoreRing pct={gate.score} tint={gate.score >= 80 ? '#16A34A' : gate.score >= 60 ? '#D97706' : '#DC2626'} grade={`${gate.score}%`} size={80} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <GateCrit label="Critical & high reqs approved" value={`${gate.approved}/${gate.critical}`} pct={gate.approvedPct} pass={gate.approvedPct >= 80} />
                <GateCrit label="System/subsystem verified" value={`${gate.verified}/${gate.sysSub}`} pct={gate.verifiedPct} pass={gate.verifiedPct >= 60} />
                <GateCrit label="Blocker gaps" value={`${gate.blockers.length}`} pct={100 - Math.round(gate.blockers.length / gate.critical * 100)} pass={gate.blockers.length < 3} />
              </div>
            </div>
          </div>
          <div style={{ flex: 1, padding: '18px 20px', borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>Blockers ({gate.blockers.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 160, overflowY: 'auto' }}>
              {gate.blockers.slice(0, 8).map(b => (
                <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 7, background: 'hsl(var(--muted))', fontSize: 12 }}>
                  <ReqKeyTag reqKey={b.key} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'hsl(var(--foreground))' }}>{b.title}</span>
                  <PriorityPill priority={b.priority} />
                </div>
              ))}
              {gate.blockers.length > 8 && <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>+{gate.blockers.length - 8} more</div>}
            </div>
          </div>
        </div>

        {/* Manufacturing readiness */}
        <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', alignItems: 'center', gap: 9 }}>
            <Activity size={15} color="hsl(var(--muted-foreground))" />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Manufacturing readiness by subsystem</span>
          </div>
          <div style={{ padding: 16 }}>
            {mfr.map(m => (
              <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid hsl(var(--border))' }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'hsl(var(--muted-foreground))', width: 32, flexShrink: 0 }}>{m.key}</span>
                <span style={{ fontSize: 12.5, color: 'hsl(var(--foreground))', width: 160, flexShrink: 0 }}>{REQ_GROUP[m.key as ReqGroup]?.label ?? m.key}</span>
                <div style={{ flex: 1 }}><CoverageBar label="" total={m.reqs} verified={m.verified} gaps={m.open} /></div>
                <span style={{ width: 52, textAlign: 'right', fontSize: 12, fontWeight: 600, color: statusColor(m.status) }}>{statusLabel(m.status)}</span>
                <span style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', width: 60, textAlign: 'right' }}>{m.parts} parts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Standards compliance */}
        <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', alignItems: 'center', gap: 9 }}>
            <BookOpen size={15} color="hsl(var(--muted-foreground))" />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Standards compliance overlay</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'hsl(var(--muted))' }}>
                  {['Standard', 'Domain', 'Reqs', 'Verified', 'Passed', 'Gaps', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stds.map((s, i) => (
                  <tr key={s.code} style={{ borderBottom: '1px solid hsl(var(--border))', background: i % 2 === 0 ? 'transparent' : 'hsl(var(--muted))' }}>
                    <td style={{ padding: '9px 12px', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: 'hsl(var(--foreground))', whiteSpace: 'nowrap' }}>{s.code}</td>
                    <td style={{ padding: '9px 12px', color: 'hsl(var(--foreground))' }}>{s.domain}</td>
                    <td style={{ padding: '9px 12px', color: 'hsl(var(--foreground))', textAlign: 'center' }}>{s.count}</td>
                    <td style={{ padding: '9px 12px', color: 'hsl(var(--foreground))', textAlign: 'center' }}>{s.verified}</td>
                    <td style={{ padding: '9px 12px', color: 'hsl(var(--foreground))', textAlign: 'center' }}>{s.passed}</td>
                    <td style={{ padding: '9px 12px', color: s.gaps > 0 ? '#DC2626' : '#16A34A', fontWeight: 600, textAlign: 'center' }}>{s.gaps}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ padding: '2px 9px', borderRadius: 9999, fontSize: 10.5, fontWeight: 700, background: softTint(statusColor(s.status), 0.12), color: statusColor(s.status), border: `1px solid ${softTint(statusColor(s.status), 0.28)}` }}>
                        {statusLabel(s.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function GateCrit({ label, value, pct, pass }: { label: string; value: string; pct: number; pass: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 16, height: 16, borderRadius: 9999, background: pass ? softTint('#16A34A', 0.15) : softTint('#DC2626', 0.15), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {pass ? <Check size={10} color="#16A34A" /> : <X size={10} color="#DC2626" />}
      </span>
      <span style={{ flex: 1, fontSize: 12, color: 'hsl(var(--foreground))' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: pass ? '#16A34A' : '#DC2626' }}>{value}</span>
    </div>
  );
}

// ── Traceability helpers ────────────────────────────────────────────────────────
const MATRIX_COLS = [
  { key: 'source',   label: 'Source',    hint: 'Has an upstream link' },
  { key: 'refined',  label: 'Decomp.',   hint: 'Refined into children' },
  { key: 'alloc',    label: 'Allocated', hint: 'Allocated to a BOM part' },
  { key: 'verified', label: 'Verified',  hint: 'Verification result' },
  { key: 'approved', label: 'Approved',  hint: 'Lifecycle ≥ approved' },
  { key: 'suspect',  label: 'Clean',     hint: 'No suspect links' },
] as const;
type MatrixColKey = typeof MATRIX_COLS[number]['key'];

function cellState(r: Requirement, col: MatrixColKey): 'ok' | 'warn' | 'bad' | 'na' {
  switch (col) {
    case 'source':   return r.type === 'stakeholder-need' ? 'na' : (r.coverage.orphan ? 'bad' : 'ok');
    case 'refined':  return r.type === 'component-req' ? 'na' : (r.childKeys.length ? 'ok' : 'warn');
    case 'alloc':    return (r.type === 'subsystem-req' || r.type === 'component-req') ? (r.alloc.length ? 'ok' : 'bad') : 'na';
    case 'verified': return r.vstatus === 'passed' ? 'ok' : r.vstatus === 'failed' ? 'bad' : r.vstatus === 'not-verified' ? 'warn' : 'ok';
    case 'approved': return REQ_STATUS[r.status].step >= 2 ? 'ok' : 'warn';
    case 'suspect':  return r.coverage.suspect ? 'bad' : 'ok';
  }
}

function MatrixCell({ state, title }: { state: 'ok' | 'warn' | 'bad' | 'na'; title: string }) {
  const ok = state === 'ok', warn = state === 'warn', bad = state === 'bad', na = state === 'na';
  const tint = ok ? '#16A34A' : warn ? '#D97706' : bad ? '#DC2626' : '#9CA3AF';
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 24, height: 24, borderRadius: 6,
      background: na ? 'transparent' : softTint(tint, 0.12),
      border: na ? '1px dashed hsl(var(--border))' : 'none',
    }}>
      {ok   && <Check  size={13} color={tint} />}
      {warn && <Minus  size={13} color={tint} />}
      {bad  && <X      size={13} color={tint} />}
      {na   && <span style={{ width: 4, height: 4, borderRadius: 9999, background: 'hsl(var(--muted-foreground))' }} />}
    </span>
  );
}

// ── Traceability view ──────────────────────────────────────────────────────────
function TraceabilityView({ onOpen }: { onOpen: (k: string) => void; onDrill?: (g: keyof typeof GAP_META | null, extra?: Partial<FilterState>) => void }) {
  const [mode, setMode] = useState<'matrix' | 'graph'>('matrix');
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 24px', borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 3, gap: 2 }}>
          {([
            { id: 'matrix', Icon: Table2,  label: 'Coverage matrix' },
            { id: 'graph',  Icon: Network, label: 'Dependency graph' },
          ] as const).map(({ id, Icon, label }) => {
            const on = mode === id;
            return (
              <button key={id} onClick={() => setMode(id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px',
                borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'inherit', border: 'none',
                background: on ? 'hsl(var(--card))' : 'transparent',
                color: on ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                boxShadow: on ? '0 1px 2px rgba(20,24,31,0.10)' : 'none',
              }}>
                <Icon size={14} color={on ? '#3B82F6' : 'hsl(var(--muted-foreground))'} />
                {label}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
          {mode === 'matrix'
            ? 'Requirement × coverage-dimension grid — green = covered, amber = partial, red = gap.'
            : 'Decomposition graph bridging requirements to allocated BOM parts. Hover to trace a path.'}
        </span>
      </div>
      {mode === 'matrix' ? <TraceMatrix onOpen={onOpen} /> : <DependencyGraph onOpen={onOpen} />}
    </div>
  );
}

function TraceMatrix({ onOpen }: { onOpen: (k: string) => void }) {
  const groups = useMemo(() =>
    (Object.keys(REQ_GROUP) as ReqGroup[])
      .map(g => ({ g, rows: REQS.filter(r => r.group === g) }))
      .filter(x => x.rows.length > 0),
  []);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const colPcts = useMemo(() => MATRIX_COLS.map(col => {
    const rel = REQS.filter(r => cellState(r, col.key) !== 'na');
    const ok  = rel.filter(r => cellState(r, col.key) === 'ok').length;
    return rel.length ? Math.round((ok / rel.length) * 100) : 0;
  }), []);

  const NAME_W = 320, COL_W = 92;

  return (
    <div style={{ flex: 1, overflow: 'auto', borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}>
      <div style={{ minWidth: NAME_W + MATRIX_COLS.length * COL_W + 40, paddingBottom: 40 }}>

        {/* Sticky header */}
        <div style={{ display: 'flex', alignItems: 'stretch', position: 'sticky', top: 0, zIndex: 20, background: 'hsl(var(--card))', borderBottom: '1px solid hsl(var(--border))' }}>
          <div style={{
            width: NAME_W, flexShrink: 0, display: 'flex', alignItems: 'center',
            padding: '0 24px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))',
            position: 'sticky', left: 0, background: 'hsl(var(--card))', zIndex: 2,
            borderRight: '1px solid hsl(var(--border))',
          }}>Requirement</div>
          {MATRIX_COLS.map((col, i) => (
            <div key={col.key} title={col.hint} style={{
              width: COL_W, flexShrink: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: '9px 0',
              borderRight: '1px solid hsl(var(--border))',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{col.label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, marginTop: 2, color: colPcts[i] >= 70 ? '#16A34A' : colPcts[i] >= 40 ? '#CA8A04' : '#DC2626' }}>
                {colPcts[i]}%
              </span>
            </div>
          ))}
        </div>

        {/* Groups */}
        {groups.map(({ g, rows }) => {
          const meta = REQ_GROUP[g];
          const Ic = GROUP_ICONS[g];
          const isCol = !!collapsed[g];
          const cleanCount = rows.filter(r => !r.hasGap).length;
          return (
            <div key={g}>
              {/* Collapsible group header */}
              <div
                onClick={() => setCollapsed(p => ({ ...p, [g]: !p[g] }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '8px 24px',
                  background: 'hsl(var(--card))', borderBottom: '1px solid hsl(var(--border))',
                  cursor: 'pointer', position: 'sticky', left: 0, zIndex: 1,
                }}>
                <span style={{ display: 'inline-flex', transition: 'transform .15s', transform: isCol ? 'rotate(-90deg)' : 'none' }}>
                  <ChevronDown size={14} color="hsl(var(--muted-foreground))" />
                </span>
                <Ic size={14} color={meta.tint} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{meta.label}</span>
                <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{rows.length} reqs · {cleanCount} clean</span>
              </div>

              {/* Requirement rows */}
              {!isCol && rows.map(r => (
                <div key={r.key}
                  onClick={() => onOpen(r.key)}
                  style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid hsl(var(--border))', cursor: 'pointer', background: r.hasGap ? softTint('#DC2626', 0.02) : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted))')}
                  onMouseLeave={e => (e.currentTarget.style.background = r.hasGap ? softTint('#DC2626', 0.02) : 'transparent')}>

                  {/* Sticky name cell */}
                  <div style={{
                    width: NAME_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9,
                    padding: '8px 24px', position: 'sticky', left: 0,
                    background: 'inherit', borderRight: '1px solid hsl(var(--border))', zIndex: 1,
                  }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 600, color: '#3B82F6', width: 78, flexShrink: 0 }}>{r.key}</span>
                    <TypePill type={r.type} />
                    <span style={{ fontSize: 12.5, color: 'hsl(var(--foreground))', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                  </div>

                  {/* Matrix cells */}
                  {MATRIX_COLS.map(col => (
                    <div key={col.key} style={{ width: COL_W, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid hsl(var(--border))' }}>
                      <MatrixCell state={cellState(r, col.key)} title={`${col.label}: ${cellState(r, col.key)}`} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DependencyGraph({ onOpen }: { onOpen: (k: string) => void }) {
  const FOCUS_OPTS = useMemo(() => REQS.filter(r => r.type === 'system-req' || r.type === 'stakeholder-req'), []);
  const [focus, setFocus] = useState('SYS-001');
  const [hover, setHover] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const fr = BY_KEY[focus];

  const nodeW = 168, nodeH = 46, COL_W = 188, V_GAP = 18, PAD = 30;

  type GraphNode = { key: string; x: number; y: number; kind: string; r: Requirement | null };
  type GraphEdge = { from: string; to: string; kind: 'derive' | 'alloc'; suspect: boolean };

  const { nodes, edges, svgW, svgH } = useMemo(() => {
    if (!fr) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[], svgW: 600, svgH: 300 };

    const anc = ancestors(focus).reverse();
    const kids = fr.childKeys.map(k => BY_KEY[k]).filter(Boolean) as Requirement[];

    const colMap: Record<number, { key: string; kind: string; r: Requirement | null }[]> = {};
    const addNode = (key: string, kind: string) => {
      const r = BY_KEY[key] ?? null;
      const tier = r ? REQ_TYPE[r.type].tier : 5;
      (colMap[tier] = colMap[tier] ?? []).push({ key, kind, r });
    };
    anc.forEach(k => addNode(k, 'anc'));
    addNode(focus, 'focus');
    kids.forEach(k => addNode(k.key, 'child'));
    const parts = new Set<string>();
    [fr, ...kids].forEach(r => r.alloc.forEach(p => parts.add(p)));
    Array.from(parts).slice(0, 8).forEach(p => (colMap[5] = colMap[5] ?? []).push({ key: p, kind: 'part', r: null }));

    const cols = Object.keys(colMap).map(Number).sort((a, b) => a - b);
    const maxRows = Math.max(...cols.map(c => colMap[c].length), 1);
    const svgH = PAD * 2 + maxRows * nodeH + (maxRows - 1) * V_GAP;
    const svgW = PAD * 2 + cols.length * COL_W;

    const pos: Record<string, { x: number; y: number; kind: string; r: Requirement | null }> = {};
    cols.forEach((c, ci) => {
      const list = colMap[c];
      const colH = list.length * nodeH + (list.length - 1) * V_GAP;
      const startY = (svgH - colH) / 2;
      list.forEach((n, ri) => {
        pos[n.key] = { x: PAD + ci * COL_W, y: startY + ri * (nodeH + V_GAP), kind: n.kind, r: n.r };
      });
    });

    const edgeList: GraphEdge[] = [];
    Object.keys(pos).forEach(k => {
      const r = BY_KEY[k]; if (!r) return;
      r.childKeys.forEach(c => { if (pos[c]) edgeList.push({ from: k, to: c, kind: 'derive', suspect: BY_KEY[c]?.coverage.suspect ?? false }); });
      r.alloc.forEach(p => { if (pos[p]) edgeList.push({ from: k, to: p, kind: 'alloc', suspect: false }); });
    });

    return { nodes: Object.keys(pos).map(k => ({ key: k, ...pos[k] })), edges: edgeList, svgW, svgH };
  }, [focus, fr]);

  const edgePath = (e: GraphEdge) => {
    const a = nodes.find(n => n.key === e.from), b = nodes.find(n => n.key === e.to);
    if (!a || !b) return '';
    const x1 = a.x + nodeW, y1 = a.y + nodeH / 2, x2 = b.x, y2 = b.y + nodeH / 2;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  const connected = (key: string) =>
    hover !== null && (hover === key || edges.some(e => (e.from === hover && e.to === key) || (e.to === hover && e.from === key)));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}>

      {/* Controls bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 24px', borderBottom: '1px solid hsl(var(--border))' }}>
        <span style={{ fontSize: 12.5, color: 'hsl(var(--muted-foreground))' }}>Focus requirement</span>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setPickOpen(o => !o)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 12px',
            borderRadius: 7, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: '#3B82F6' }}>{focus}</span>
            <span style={{ fontSize: 12.5, color: 'hsl(var(--foreground))', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fr?.title}</span>
            <ChevronsUpDown size={13} color="hsl(var(--muted-foreground))" />
          </button>
          {pickOpen && (
            <>
              <div onClick={() => setPickOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{
                position: 'absolute', left: 0, top: 36, width: 320, maxHeight: 340, overflowY: 'auto',
                zIndex: 50, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
                borderRadius: 9, boxShadow: '0 12px 32px rgba(20,24,31,0.16)', padding: 5,
              }}>
                {FOCUS_OPTS.map(r => (
                  <button key={r.key} onClick={() => { setFocus(r.key); setPickOpen(false); }} style={{
                    display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px',
                    borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    background: r.key === focus ? softTint('#3B82F6', 0.08) : 'transparent',
                  }}
                  onMouseEnter={e => { if (r.key !== focus) (e.currentTarget as HTMLElement).style.background = 'hsl(var(--muted))'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = r.key === focus ? softTint('#3B82F6', 0.08) : 'transparent'; }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 600, color: '#3B82F6', width: 72, flexShrink: 0 }}>{r.key}</span>
                    <span style={{ fontSize: 12.5, color: 'hsl(var(--foreground))', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 18, height: 2, background: 'hsl(var(--border))', display: 'inline-block' }} />derives
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 18, height: 0, borderTop: '2px solid #D97706', display: 'inline-block' }} />allocated
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 18, height: 0, borderTop: '2px dashed #DC2626', display: 'inline-block' }} />suspect
          </span>
        </div>
      </div>

      {/* Graph canvas */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ position: 'relative', width: svgW, height: svgH, margin: '0 auto' }}>
          <svg width={svgW} height={svgH} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {edges.map((e, i) => {
              const act = connected(e.from) || connected(e.to);
              const baseCol = e.kind === 'alloc' ? '#D97706' : e.suspect ? '#DC2626' : 'hsl(var(--border))';
              const actCol  = e.kind === 'alloc' ? '#D97706' : e.suspect ? '#DC2626' : '#3B82F6';
              return (
                <path key={i} d={edgePath(e)} fill="none"
                  stroke={act ? actCol : baseCol}
                  strokeWidth={act ? 2.2 : 1.5}
                  strokeDasharray={e.suspect ? '5 4' : undefined}
                  opacity={hover !== null && !act ? 0.25 : 1}
                  style={{ transition: 'opacity .15s, stroke .15s' }} />
              );
            })}
          </svg>
          {nodes.map(n => {
            const isPart = n.kind === 'part', isFocus = n.kind === 'focus';
            const tint = isPart ? '#D97706' : (n.r ? REQ_STATUS[n.r.status].tint : 'hsl(var(--muted-foreground))');
            const dim = hover !== null && !connected(n.key);
            const isConn = connected(n.key);
            return (
              <div key={n.key}
                onMouseEnter={() => setHover(n.key)}
                onMouseLeave={() => setHover(null)}
                onClick={() => { if (!isPart) onOpen(n.key); }}
                style={{
                  position: 'absolute', left: n.x, top: n.y, width: nodeW, height: nodeH,
                  boxSizing: 'border-box', borderRadius: 9, padding: '7px 10px',
                  cursor: isPart ? 'default' : 'pointer', overflow: 'hidden',
                  background: isFocus ? softTint('#3B82F6', 0.10) : 'hsl(var(--card))',
                  border: `${isFocus ? 2 : 1}px solid ${isFocus ? '#3B82F6' : (isConn ? tint : 'hsl(var(--border))')}`,
                  boxShadow: isFocus ? `0 4px 14px ${softTint('#3B82F6', 0.20)}` : '0 1px 2px rgba(20,24,31,0.06)',
                  opacity: dim ? 0.4 : 1, transition: 'opacity .15s, border-color .15s', zIndex: isConn ? 5 : 2,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isPart
                    ? <Package size={11} color="#D97706" />
                    : <span style={{ width: 7, height: 7, borderRadius: 9999, background: tint, flexShrink: 0 }} />}
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: isPart ? '#D97706' : '#3B82F6' }}>{n.key}</span>
                </div>
                <div style={{ fontSize: 11, color: 'hsl(var(--foreground))', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.r ? n.r.title : 'BOM part / assembly'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Mind-map view ──────────────────────────────────────────────────────────────
function RequirementsMapView({ onOpen }: { onOpen: (k: string) => void }) {
  const NW = 244, NH = 108, HGAP = 110, VGAP = 20;

  type TreeNode = Requirement & { _x: number; _y: number; children: TreeNode[] };

  const nodes = useMemo<TreeNode[]>(() => {
    const build = (key: string): TreeNode => {
      const r = BY_KEY[key];
      const node: TreeNode = { ...r, _x: 0, _y: 0, children: [] };
      if (r.childKeys.length) node.children = r.childKeys.map(build);
      return node;
    };
    return REQ_ROOTS.map(build);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  type DragState = { type: 'node'; id: string; startX: number; startY: number; ox: number; oy: number; zoom: number; moved: boolean }
                 | { type: 'pan'; startX: number; startY: number; ox: number; oy: number; moved: boolean };
  const dragRef = useRef<DragState | null>(null);

  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 56, y: 40 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try { return JSON.parse(localStorage.getItem('req_map_pos') || '{}'); } catch { return {}; }
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('req_map_collapsed');
      if (saved) return JSON.parse(saved);
    } catch { /**/ }
    const init: Record<string, boolean> = {};
    const walk = (list: TreeNode[], depth: number) => list.forEach(n => {
      if (n.children.length) { if (depth >= 2) init[n.key] = true; walk(n.children, depth + 1); }
    });
    walk(nodes, 0);
    return init;
  });
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem('req_map_collapsed', JSON.stringify(collapsed)); }, [collapsed]);

  // Tidy left-to-right layout — mutates _x/_y on nodes in place
  const layoutVersion = useMemo(() => {
    let leafY = 0;
    const place = (node: TreeNode, depth: number): number => {
      node._x = depth * (NW + HGAP);
      const kids = node.children.length && !collapsed[node.key] ? node.children : null;
      if (!kids) { node._y = leafY; leafY += NH + VGAP; return node._y + NH / 2; }
      const centers = kids.map(k => place(k, depth + 1));
      const center = (centers[0] + centers[centers.length - 1]) / 2;
      node._y = center - NH / 2;
      return center;
    };
    nodes.forEach(r => place(r, 0));
    return Date.now();
  }, [collapsed, nodes]);

  // Flat visible nodes + edges derived from tree walk
  const { visible, edges } = useMemo(() => {
    const visible: TreeNode[] = [], edges: [TreeNode, TreeNode][] = [];
    const walk = (node: TreeNode) => {
      visible.push(node);
      if (!collapsed[node.key]) node.children.forEach(c => { edges.push([node, c]); walk(c); });
    };
    nodes.forEach(walk);
    return { visible, edges };
  }, [collapsed, nodes, layoutVersion]);

  const eff = (n: TreeNode) => positions[n.key] ?? { x: n._x, y: n._y };
  const bounds = visible.reduce((b, n) => {
    const p = eff(n);
    return { w: Math.max(b.w, p.x + NW), h: Math.max(b.h, p.y + NH) };
  }, { w: 600, h: 400 });

  // Global mouse handlers for node drag + canvas pan
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      if (d.type === 'node') {
        const dx = (e.clientX - d.startX) / d.zoom, dy = (e.clientY - d.startY) / d.zoom;
        if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 4) d.moved = true;
        setPositions(p => ({ ...p, [d.id]: { x: d.ox + dx, y: d.oy + dy } }));
      } else {
        d.moved = true;
        setPan({ x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY) });
      }
    };
    const onUp = () => {
      const d = dragRef.current; if (!d) return;
      if (d.type === 'node') {
        setDragId(null);
        if (!d.moved) onOpen(d.id);
        else setPositions(p => { localStorage.setItem('req_map_pos', JSON.stringify(p)); return p; });
      }
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [onOpen]);

  // Wheel zoom toward cursor
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      setZoom(z => {
        const nz = Math.min(2, Math.max(0.3, z * (e.deltaY < 0 ? 1.12 : 0.89)));
        setPan(p => ({ x: cx - ((cx - p.x) / z) * nz, y: cy - ((cy - p.y) / z) * nz }));
        return nz;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const startNodeDrag = (e: React.MouseEvent, n: TreeNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = eff(n);
    dragRef.current = { type: 'node', id: n.key, startX: e.clientX, startY: e.clientY, ox: p.x, oy: p.y, zoom, moved: false };
    setDragId(n.key);
  };
  const startPan = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, ox: pan.x, oy: pan.y, moved: false };
  };

  const zoomBy = (f: number) => setZoom(z => {
    const nz = Math.min(2, Math.max(0.3, z * f));
    const el = containerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const cx = r.width / 2, cy = r.height / 2;
      setPan(p => ({ x: cx - ((cx - p.x) / z) * nz, y: cy - ((cy - p.y) / z) * nz }));
    }
    return nz;
  });

  const fit = useCallback(() => {
    const el = containerRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const nz = Math.min(2, Math.max(0.3, Math.min((r.width - 100) / bounds.w, (r.height - 100) / bounds.h)));
    setZoom(nz);
    setPan({ x: (r.width - bounds.w * nz) / 2, y: (r.height - bounds.h * nz) / 2 });
  }, [bounds]);

  const resetLayout = () => { setPositions({}); localStorage.removeItem('req_map_pos'); };

  // Auto-fit on first open when no custom positions exist
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || Object.keys(positions).length) { didFit.current = true; return; }
    const t = setTimeout(() => { fit(); didFit.current = true; }, 60);
    return () => clearTimeout(t);
  }, [fit]);

  const ctrlBtn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 7,
    background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'hsl(var(--muted-foreground))', padding: 0,
  };

  const LEGEND: { s: ReqStatus; label: string }[] = [
    { s: 'draft', label: 'Draft' },
    { s: 'approved', label: 'Approved' },
    { s: 'verified', label: 'Verified' },
    { s: 'validated', label: 'Validated' },
  ];

  return (
    <div
      ref={containerRef}
      onMouseDown={startPan}
      style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        background: 'hsl(var(--background))', cursor: 'grab',
        backgroundImage: `radial-gradient(hsl(var(--border)) 1px, transparent 1px)`,
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* Transformed canvas */}
      <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>

        {/* Edges */}
        <svg width={bounds.w + 40} height={bounds.h + 40}
          style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
          {edges.map(([a, b]) => {
            const pa = eff(a), pb = eff(b);
            const x1 = pa.x + NW, y1 = pa.y + NH / 2, x2 = pb.x, y2 = pb.y + NH / 2;
            const dx = Math.max(40, (x2 - x1) / 2);
            const suspect = b.coverage.suspect;
            const col = suspect ? '#DC2626' : REQ_STATUS[b.status].tint;
            return (
              <path key={a.key + '>' + b.key}
                d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                fill="none" stroke={col} strokeWidth={1.6} strokeOpacity={0.4}
                strokeDasharray={suspect ? '4 3' : undefined} />
            );
          })}
        </svg>

        {/* Nodes */}
        {visible.map(n => {
          const p = eff(n);
          const st = REQ_STATUS[n.status];
          const isH = hovered === n.key, isDrag = dragId === n.key;
          const hasKids = n.children.length > 0;
          const isCol = !!collapsed[n.key];
          const borderSoft = softTint(st.tint, 0.45);

          return (
            <div key={n.key}
              onMouseDown={e => startNodeDrag(e, n)}
              onMouseEnter={() => setHovered(n.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: 'absolute', left: p.x, top: p.y, width: NW, minHeight: NH,
                background: 'hsl(var(--card))',
                border: `1px solid ${isH || isDrag ? borderSoft : 'hsl(var(--border))'}`,
                borderLeft: `3px solid ${st.tint}`,
                borderRadius: 11,
                boxShadow: isDrag
                  ? '0 12px 28px rgba(20,24,31,0.18)'
                  : isH ? '0 6px 16px rgba(20,24,31,0.12)' : '0 1px 3px rgba(20,24,31,0.07)',
                cursor: isDrag ? 'grabbing' : 'grab',
                zIndex: isDrag ? 100 : isH ? 50 : 10,
                transition: isDrag ? 'none' : 'box-shadow .12s, border-color .12s',
                userSelect: 'none', display: 'flex', flexDirection: 'column',
              }}>

              {/* Header: type pill + key */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px 0' }}>
                <TypePill type={n.type} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                  {n.key}
                </span>
              </div>

              {/* Title */}
              <div style={{ padding: '6px 12px 0', flex: 1 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1.28,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{n.title}</div>
              </div>

              {/* Footer: status + coverage warning + vstatus */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '8px 12px 10px' }}>
                <StatusBadge status={n.status} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  {(n.coverage.orphan || n.coverage.untested || n.coverage.unimplemented) && (
                    <AlertTriangle size={13} color="#D97706" />
                  )}
                  <VStatusBadge vstatus={n.vstatus} />
                </span>
              </div>

              {/* Collapse/expand handle on right edge */}
              {hasKids && (
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); setCollapsed(c => ({ ...c, [n.key]: !c[n.key] })); }}
                  title={isCol ? 'Expand branch' : 'Collapse branch'}
                  style={{
                    position: 'absolute', right: -12, top: NH / 2 - 12, width: 24, height: 24,
                    borderRadius: '50%', background: 'hsl(var(--card))', border: `1px solid ${borderSoft}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: st.tint, zIndex: 20, padding: 0,
                  }}>
                  {isCol
                    ? <span style={{ fontSize: 10, fontWeight: 700, color: st.tint }}>{n.children.length}</span>
                    : <Minus size={13} color={st.tint} />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating controls — top right */}
      <div style={{ position: 'absolute', top: 14, right: 16, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 200 }}>
        <button onClick={() => zoomBy(1.15)} title="Zoom in" style={ctrlBtn}><Plus size={15} /></button>
        <div style={{ textAlign: 'center', fontSize: 10.5, color: 'hsl(var(--muted-foreground))', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(zoom * 100)}%
        </div>
        <button onClick={() => zoomBy(0.87)} title="Zoom out" style={ctrlBtn}><Minus size={15} /></button>
        <button onClick={fit} title="Fit to screen" style={ctrlBtn}><Maximize2 size={14} /></button>
        <button onClick={resetLayout} title="Reset node positions" style={ctrlBtn}><RefreshCw size={13} /></button>
      </div>

      {/* Legend overlay — bottom left */}
      <div style={{
        position: 'absolute', bottom: 14, left: 16,
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '7px 12px', background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))', borderRadius: 8, zIndex: 200,
      }}>
        {LEGEND.map(({ s, label }) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: REQ_STATUS[s].tint, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{label}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 14, background: 'hsl(var(--border))' }} />
        <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Drag nodes · scroll to zoom · click to open</span>
      </div>
    </div>
  );
}
