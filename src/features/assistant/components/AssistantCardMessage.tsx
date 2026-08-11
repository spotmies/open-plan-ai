import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  Folder,
  GitPullRequest,
  LayoutGrid,
  Layers,
  Link2,
  ListChecks,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { Children, type ReactNode } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import type {
  AssistantCard,
  AssistantListCard,
  BomCardFlag,
  BomCardItem,
  CardItem,
  CardSeverity,
  ModuleCardItem,
  MilestoneCardItem,
  ProjectStage,
} from '../assistantData';

interface AssistantCardMessageProps {
  card: AssistantCard;
  /** Real persisted timestamp, or null for the fleeting live render before the REST refetch lands. */
  createdAt: string | null;
  onFollowUp: (text: string) => void;
}

// Feature-local — deliberately reimplemented rather than imported from
// features/projects (ISSUE_SEVERITY_DISPLAY) or features/dashboard
// (RAG_DOT_CLASS/ECOAvatar), matching this codebase's convention of small
// per-feature dot/avatar helpers over cross-feature component imports.

const SEVERITY_DOT_CLASS: Record<CardSeverity, string> = {
  critical: 'bg-destructive',
  major: 'bg-orange-500',
  minor: 'bg-yellow-500',
  trivial: 'bg-muted-foreground',
};

// Matches ISSUE_SEVERITY_OPTIONS's color language (features/projects/issueSeverity.ts)
// so a task's priority / an issue's severity reads consistently with the rest
// of the app, not just with this one card.
const SEVERITY_BADGE_META: Record<CardSeverity, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
  major: { label: 'Major', className: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  minor: { label: 'Minor', className: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-500' },
  trivial: { label: 'Trivial', className: 'border-muted-foreground/30 bg-muted text-muted-foreground' },
};

const AVATAR_PALETTE = ['#2563EB', '#9333EA', '#16A34A', '#D97706', '#DC2626', '#0891B2', '#DB2777', '#0D9488'];

function hashIndex(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % AVATAR_PALETTE.length;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Never model-supplied — derived purely from the item's real UUID/dueDate so
// nothing shown on a card can be an invented ID or age (see the plan's "no
// fabricated data" requirement). Tasks/issues/modules have no human-facing
// sequential code (only a UUID), so this hashed short form is the honest
// stand-in; ECOs are the one exception — they get a real one (see
// headerBadge below), so this is never applied to them.
function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

function dueLabel(dueDate: string | undefined): string | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const days = Math.round((due.getTime() - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'due today';
  return `due in ${days}d`;
}

/** "in_review" / "in-progress" -> "In Review" — the same plain-language translation the prompt asks the model to do in prose, applied here to raw enum values the card renders directly (status, category, priority strings). */
function titleCase(value: string): string {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function dateRangeLabel(startDate: string | undefined, dueDate: string | undefined): string | null {
  const start = startDate ? new Date(startDate) : null;
  const due = dueDate ? new Date(dueDate) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
  const validDue = due && !Number.isNaN(due.getTime()) ? due : null;
  if (validStart && validDue) return `${format(validStart, 'd MMM')} – ${format(validDue, 'd MMM')}`;
  if (validDue) return `Due ${format(validDue, 'MMM d')}`;
  if (validStart) return `Started ${format(validStart, 'MMM d')}`;
  return null;
}

// ─── Status pill (task_detail/issue_detail/eco_detail/module_detail) ──────
// Tone is derived purely from the record's own real status word — a small,
// generic keyword map shared across every entity's status vocabulary,
// independent of the card's `tone` field (which stays a separate, explicit
// model-set signal for the card's overall wash — see resolveCardKindMeta).

const STATUS_DONE_WORDS = new Set(['done', 'completed', 'approved', 'verified', 'released', 'closed', 'resolved']);
const STATUS_BLOCKED_WORDS = new Set(['blocked', 'rejected', 'cancelled', 'canceled']);
const STATUS_PENDING_WORDS = new Set(['in_review', 'in-progress', 'in_progress', 'review', 'pending', 'rework', 'on_hold']);

function statusPillClass(status: string): string {
  const s = status.toLowerCase();
  if (STATUS_DONE_WORDS.has(s)) return 'bg-green-500/10 text-green-600 dark:text-green-400';
  if (STATUS_BLOCKED_WORDS.has(s)) return 'bg-destructive/10 text-destructive';
  if (STATUS_PENDING_WORDS.has(s)) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'bg-muted text-muted-foreground';
}

function statusPillIcon(status: string): LucideIcon {
  const s = status.toLowerCase();
  if (STATUS_DONE_WORDS.has(s)) return CheckCircle2;
  if (STATUS_BLOCKED_WORDS.has(s)) return ShieldAlert;
  return Clock;
}

function StatusPill({ status }: { status: string }) {
  const Icon = statusPillIcon(status);
  return (
    <span className={cn('inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-semibold', statusPillClass(status))}>
      <Icon className="h-3.5 w-3.5" />
      {titleCase(status)}
    </span>
  );
}

// ─── Shared "fact" row (task/issue/eco/module detail cards) ───────────────

function PersonAvatar({ name }: { name: string }) {
  return (
    <span
      title={name}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
      style={{ background: AVATAR_PALETTE[hashIndex(name)] }}
    >
      {initials(name)}
    </span>
  );
}

function Fact({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {text}
    </span>
  );
}

function PersonFact({ name, prefix }: { name: string; prefix?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <PersonAvatar name={name} />
      {prefix ? `${prefix} ${name}` : name}
    </span>
  );
}

function DetailFacts({ children }: { children: ReactNode }) {
  const visible = Children.toArray(children).filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
      {visible}
    </div>
  );
}

// ─── Status card gate stepper ──────────────────────────────────────────────
// The real 5-stage projects.stage enum — never the design mock's EVT/DVT/
// PVT/MP gate names (see ProjectStage's own comment in assistantData.ts).

const STAGES: ProjectStage[] = ['concept', 'design', 'development', 'testing', 'production'];
const STAGE_LABEL: Record<ProjectStage, string> = {
  concept: 'Concept',
  design: 'Design',
  development: 'Dev',
  testing: 'Test',
  production: 'Prod',
};

function GateStepper({ stage }: { stage: ProjectStage }) {
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s) => (
        <span
          key={s}
          className={cn(
            'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
            s === stage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {STAGE_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

// ─── Per-kind chrome (icon/kicker/tint) ────────────────────────────────────
// Deliberately NOT model-supplied — it's chosen purely from card.type/tone
// (and, for "list" cards, the closed `subject` enum), same "never fabricate
// display data" spirit as shortId/dueLabel above.

interface CardKindMeta {
  kicker: string;
  Icon: LucideIcon;
  chipClass: string;
  kickerClass: string;
  washClass: string;
}

type StaticCardKindMeta = Omit<CardKindMeta, 'washClass'>;

const TYPE_META: Record<Exclude<AssistantCard['type'], 'list'>, StaticCardKindMeta> = {
  status: { kicker: 'STATUS', Icon: Activity, chipClass: 'bg-primary/10 text-primary', kickerClass: 'text-primary' },
  bom: {
    kicker: 'BILL OF MATERIALS',
    Icon: Layers,
    chipClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    kickerClass: 'text-amber-600 dark:text-amber-400',
  },
  module_list: {
    kicker: 'MODULES',
    Icon: LayoutGrid,
    chipClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    kickerClass: 'text-indigo-600 dark:text-indigo-400',
  },
  milestone_list: {
    kicker: 'MILESTONES',
    Icon: Flag,
    chipClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    kickerClass: 'text-teal-600 dark:text-teal-400',
  },
  task_detail: {
    kicker: 'TASK',
    Icon: ListChecks,
    chipClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    kickerClass: 'text-blue-600 dark:text-blue-400',
  },
  issue_detail: {
    kicker: 'ISSUE',
    Icon: AlertTriangle,
    chipClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    kickerClass: 'text-orange-600 dark:text-orange-400',
  },
  eco_detail: {
    kicker: 'DESIGN CHANGE',
    Icon: GitPullRequest,
    chipClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    kickerClass: 'text-violet-600 dark:text-violet-400',
  },
  module_detail: {
    kicker: 'MODULE',
    Icon: LayoutGrid,
    chipClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    kickerClass: 'text-indigo-600 dark:text-indigo-400',
  },
};

function baseMetaForList(card: AssistantListCard): StaticCardKindMeta {
  if (card.subject === 'tasks') {
    return {
      kicker: 'TASKS',
      Icon: ListChecks,
      chipClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      kickerClass: 'text-blue-600 dark:text-blue-400',
    };
  }
  if (card.subject === 'issues') {
    return {
      kicker: 'ISSUES',
      Icon: AlertTriangle,
      chipClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      kickerClass: 'text-orange-600 dark:text-orange-400',
    };
  }
  return {
    kicker: 'SUMMARY',
    Icon: ListChecks,
    chipClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    kickerClass: 'text-slate-600 dark:text-slate-300',
  };
}

function resolveCardKindMeta(card: AssistantCard): CardKindMeta {
  const base = card.type === 'list' ? baseMetaForList(card) : TYPE_META[card.type];
  if (card.tone !== 'danger') return { ...base, washClass: '' };
  return {
    kicker: card.type === 'list' ? 'BLOCKERS & RISKS' : base.kicker,
    Icon: card.type === 'list' ? ShieldAlert : base.Icon,
    chipClass: 'bg-destructive/10 text-destructive',
    kickerClass: 'text-destructive',
    washClass: 'border-destructive/30 bg-destructive/[0.04]',
  };
}

// A "_detail" card has no `badge` field of its own (never a model-supplied
// reference code) — its badge is derived here from the real id (hashed —
// see shortId) or, for an ECO, shown verbatim from the real human-facing
// `num`. Every other card type's badge is whatever the model set, if any.
function headerBadge(card: AssistantCard): string | undefined {
  switch (card.type) {
    case 'eco_detail':
      return card.num;
    case 'task_detail':
    case 'issue_detail':
    case 'module_detail':
      return shortId(card.id);
    default:
      return card.badge;
  }
}

function cardHasItems(
  card: AssistantCard,
): card is Extract<AssistantCard, { type: 'status' | 'list' | 'bom' | 'module_list' | 'milestone_list' }> {
  return card.type === 'status' || card.type === 'list' || card.type === 'bom' || card.type === 'module_list' || card.type === 'milestone_list';
}

function CardItemRow({ item }: { item: CardItem }) {
  const due = dueLabel(item.dueDate);
  const metaLine = [item.contextLabel, due].filter(Boolean).join(' · ');
  const primaryAssignee = item.assignees?.[0];

  return (
    <div className="flex items-center gap-2.5 py-2">
      {item.severity && <span className={cn('h-2 w-2 shrink-0 rounded-full', SEVERITY_DOT_CLASS[item.severity])} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        {metaLine && <p className="truncate text-xs text-muted-foreground">{metaLine}</p>}
      </div>
      {primaryAssignee && (
        <span
          title={item.assignees?.join(', ')}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ background: AVATAR_PALETTE[hashIndex(primaryAssignee)] }}
        >
          {initials(primaryAssignee)}
        </span>
      )}
      <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
        {shortId(item.id)}
      </Badge>
    </div>
  );
}

const BOM_FLAG_META: Record<BomCardFlag, { label: string; badgeClass: string }> = {
  single_sourced: { label: 'Single-sourced', badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive' },
  long_lead: {
    label: 'Long-lead',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  missing_mfr_pn: {
    label: 'Missing mfr PN',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  missing_approval: { label: 'Missing approval', badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive' },
};

function BomFlagCountBadge({ flag, count }: { flag: BomCardFlag; count: number }) {
  const meta = BOM_FLAG_META[flag];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium', meta.badgeClass)}>
      <span className="font-semibold">{count}</span>
      {meta.label}
    </span>
  );
}

function BomCardItemRow({ item }: { item: BomCardItem }) {
  const meta = BOM_FLAG_META[item.flag];
  return (
    <div className="flex items-center gap-2.5 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="shrink-0 font-mono text-xs text-blue-600 dark:text-blue-400">{item.partNumber}</span>
          <span className="truncate text-sm text-muted-foreground">{item.name}</span>
        </div>
      </div>
      {item.manufacturer && <span className="shrink-0 text-xs text-muted-foreground">{item.manufacturer}</span>}
      <Badge variant="outline" className={cn('shrink-0 whitespace-nowrap text-[10px]', meta.badgeClass)}>
        {meta.label}
        {item.flagDetail ? ` · ${item.flagDetail}` : ''}
      </Badge>
    </div>
  );
}

function ModuleListItemRow({ item }: { item: ModuleCardItem }) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.name}</p>
      <span className="shrink-0 text-xs text-muted-foreground">
        {item.taskCount} task{item.taskCount === 1 ? '' : 's'}
      </span>
      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }} />
      </div>
    </div>
  );
}

function milestoneDotClass(item: MilestoneCardItem, isDone: boolean): string {
  if (isDone) return 'bg-green-500';
  const due = item.dueDate ? new Date(item.dueDate) : null;
  if (due && !Number.isNaN(due.getTime()) && due.getTime() < Date.now()) return 'bg-destructive';
  return 'bg-muted-foreground';
}

function MilestoneListItemRow({ item }: { item: MilestoneCardItem }) {
  const isDone = STATUS_DONE_WORDS.has(item.status.toLowerCase());
  const due = item.dueDate ? new Date(item.dueDate) : null;
  const validDue = due && !Number.isNaN(due.getTime()) ? due : null;
  const metaParts = [
    validDue ? format(validDue, 'MMM d, yyyy') : null,
    isDone ? null : dueLabel(item.dueDate),
    `${item.completedTaskCount}/${item.linkedTaskCount} tasks`,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-2.5 py-2">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', milestoneDotClass(item, isDone))} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{metaParts.join(' · ')}</p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-foreground">{Math.round(item.progress)}%</span>
    </div>
  );
}

export function AssistantCardMessage({ card, createdAt, onFollowUp }: AssistantCardMessageProps) {
  const { formatCurrency } = useCurrency();
  const kind = resolveCardKindMeta(card);
  const badge = headerBadge(card);
  const asOf = createdAt
    ? `as of ${format(new Date(createdAt), 'MMM d')} · ${formatDistanceToNow(new Date(createdAt), { addSuffix: true })}`
    : 'just now';
  const footerText = `${card.sources.length} source${card.sources.length === 1 ? '' : 's'} · ${asOf}`;

  return (
    // The leading spacer matches AssistantMessageBubble's h-7 w-7 avatar +
    // gap-2.5, so the card lines up under the assistant's text bubble
    // instead of under the avatar icon above it.
    <div className="flex items-start gap-2.5">
      <div className="h-7 w-7 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <Card className={cn('overflow-hidden', kind.washClass)}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', kind.chipClass)}>
                  <kind.Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className={cn('text-[10px] font-semibold uppercase tracking-wide', kind.kickerClass)}>{kind.kicker}</p>
                  <h4 className="truncate text-base font-semibold text-foreground">{card.title}</h4>
                </div>
              </div>
              {badge && (
                <Badge variant="secondary" className="shrink-0">
                  {badge}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            {card.type === 'status' && (
              <>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-3xl font-bold text-foreground">{Math.round(card.metricValue)}%</div>
                    <p className="text-xs text-muted-foreground">{card.metricLabel ?? 'Complete'}</p>
                  </div>
                  <div className="flex items-end gap-4">
                    {card.taskCount && (
                      <div className="text-right">
                        <div className="text-lg font-semibold text-foreground">
                          {card.taskCount.completed} / {card.taskCount.total}
                        </div>
                        <p className="text-xs text-muted-foreground">tasks done</p>
                      </div>
                    )}
                    {card.stage && (
                      <div className="text-right">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current stage</p>
                        <GateStepper stage={card.stage} />
                      </div>
                    )}
                  </div>
                </div>
                <Progress value={card.metricValue} />
              </>
            )}

            {card.type === 'bom' && (
              <>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {card.rolledUpCost != null ? formatCurrency(card.rolledUpCost) : '—'}
                    </div>
                    <p className="text-xs text-muted-foreground">rolled-up cost / unit</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">{card.totalLines} lines</div>
                    <p className="text-xs text-muted-foreground">{card.clearToBuildPct}% clear-to-build</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {card.singleSourcedCount > 0 && <BomFlagCountBadge flag="single_sourced" count={card.singleSourcedCount} />}
                  {card.longLeadCount > 0 && <BomFlagCountBadge flag="long_lead" count={card.longLeadCount} />}
                  {card.missingMfrPnCount > 0 && <BomFlagCountBadge flag="missing_mfr_pn" count={card.missingMfrPnCount} />}
                  {card.missingApprovalCount > 0 && (
                    <BomFlagCountBadge flag="missing_approval" count={card.missingApprovalCount} />
                  )}
                </div>
              </>
            )}

            {card.type === 'task_detail' && (
              <>
                <StatusPill status={card.status} />
                {card.description && <p className="text-sm text-muted-foreground">{card.description}</p>}
                {(card.priority || card.hasDependency) && (
                  <div className="flex flex-wrap gap-1.5">
                    {card.priority && (
                      <Badge variant="outline" className={cn('text-[10px]', SEVERITY_BADGE_META[card.priority].className)}>
                        {SEVERITY_BADGE_META[card.priority].label}
                      </Badge>
                    )}
                    {card.hasDependency && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Link2 className="h-3 w-3" /> Has dependency
                      </Badge>
                    )}
                  </div>
                )}
                <DetailFacts>
                  {(() => {
                    const range = dateRangeLabel(card.startDate, card.dueDate);
                    return range ? <Fact key="dates" icon={Calendar} text={range} /> : null;
                  })()}
                  {card.assignees?.[0] ? <PersonFact key="assignee" name={card.assignees[0]} /> : null}
                </DetailFacts>
              </>
            )}

            {card.type === 'issue_detail' && (
              <>
                <StatusPill status={card.status} />
                {card.description && <p className="text-sm text-muted-foreground">{card.description}</p>}
                {(card.severity || card.category || card.module) && (
                  <div className="flex flex-wrap gap-1.5">
                    {card.severity && (
                      <Badge variant="outline" className={cn('text-[10px]', SEVERITY_BADGE_META[card.severity].className)}>
                        {SEVERITY_BADGE_META[card.severity].label}
                      </Badge>
                    )}
                    {card.category && (
                      <Badge variant="outline" className="text-[10px]">
                        {titleCase(card.category)}
                      </Badge>
                    )}
                    {card.module && (
                      <Badge variant="outline" className="text-[10px]">
                        {card.module}
                      </Badge>
                    )}
                  </div>
                )}
                <DetailFacts>
                  {card.reportedBy ? <PersonFact key="reporter" name={card.reportedBy} prefix="Reported by" /> : null}
                  {(() => {
                    const reported = card.reportedAt ? new Date(card.reportedAt) : null;
                    return reported && !Number.isNaN(reported.getTime()) ? (
                      <Fact key="reportedAt" icon={Calendar} text={format(reported, 'MMM d')} />
                    ) : null;
                  })()}
                </DetailFacts>
              </>
            )}

            {card.type === 'eco_detail' && (
              <>
                <StatusPill status={card.status} />
                {card.description && <p className="text-sm text-muted-foreground">{card.description}</p>}
                {(card.priority || card.changeClass) && (
                  <div className="flex flex-wrap gap-1.5">
                    {card.priority && (
                      <Badge variant="outline" className="text-[10px]">
                        {titleCase(card.priority)}
                      </Badge>
                    )}
                    {card.changeClass && (
                      <Badge variant="outline" className="text-[10px]">
                        Class {card.changeClass}
                      </Badge>
                    )}
                  </div>
                )}
                <DetailFacts>
                  {(() => {
                    const target = card.targetDate ? new Date(card.targetDate) : null;
                    return target && !Number.isNaN(target.getTime()) ? (
                      <Fact key="target" icon={Calendar} text={`Target ${format(target, 'MMM d')}`} />
                    ) : null;
                  })()}
                  {card.owner ? <PersonFact key="owner" name={card.owner} /> : null}
                  {card.originatingEcr ? <Fact key="ecr" icon={Link2} text={card.originatingEcr} /> : null}
                </DetailFacts>
              </>
            )}

            {card.type === 'module_detail' && (
              <>
                {card.status && <StatusPill status={card.status} />}
                {card.description && <p className="text-sm text-muted-foreground">{card.description}</p>}
                {card.moduleType && (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {titleCase(card.moduleType)}
                    </Badge>
                  </div>
                )}
                {card.progress != null && (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{Math.round(card.progress)}% complete</span>
                      {card.taskCount != null && (
                        <span>
                          {card.taskCount} task{card.taskCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <Progress value={card.progress} />
                  </div>
                )}
                <DetailFacts>{card.owner ? <PersonFact key="owner" name={card.owner} /> : null}</DetailFacts>
              </>
            )}

            {cardHasItems(card) &&
              (card.items.length > 0 ? (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {card.itemsLabel ?? 'Items'}
                  </p>
                  <div className="divide-y divide-border">
                    {card.type === 'bom' && card.items.map((item) => <BomCardItemRow key={item.id} item={item} />)}
                    {card.type === 'module_list' && card.items.map((item) => <ModuleListItemRow key={item.id} item={item} />)}
                    {card.type === 'milestone_list' && card.items.map((item) => <MilestoneListItemRow key={item.id} item={item} />)}
                    {(card.type === 'status' || card.type === 'list') &&
                      card.items.map((item) => <CardItemRow key={item.id} item={item} />)}
                  </div>
                </div>
              ) : (
                card.emptyText && <p className="text-sm text-muted-foreground">{card.emptyText}</p>
              ))}
          </CardContent>

          <CardFooter className="border-t border-border py-3 text-xs text-muted-foreground">{footerText}</CardFooter>
        </Card>

        {card.followUps && card.followUps.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {card.followUps.map((text) => (
              <Button
                key={text}
                variant="outline"
                size="sm"
                className="h-7 rounded-full text-xs"
                onClick={() => onFollowUp(text)}
              >
                {text}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
