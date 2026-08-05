import { Activity, Layers, ListChecks, ShieldAlert, type LucideIcon } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import type { AssistantCard, BomCardFlag, BomCardItem, CardItem, CardSeverity } from '../assistantData';

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
// fabricated data" requirement).
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

// ─── Per-kind chrome (icon/kicker/tint) ────────────────────────────────────
// Deliberately NOT model-supplied — it's chosen purely from card.type/tone,
// same "never fabricate display data" spirit as shortId/dueLabel above.

interface CardKindMeta {
  kicker: string;
  Icon: LucideIcon;
  chipClass: string;
  kickerClass: string;
  washClass: string;
}

const TYPE_META: Record<AssistantCard['type'], { kicker: string; Icon: LucideIcon; chipClass: string; kickerClass: string }> = {
  status: { kicker: 'STATUS', Icon: Activity, chipClass: 'bg-primary/10 text-primary', kickerClass: 'text-primary' },
  list: {
    kicker: 'SUMMARY',
    Icon: ListChecks,
    chipClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    kickerClass: 'text-slate-600 dark:text-slate-300',
  },
  bom: {
    kicker: 'BILL OF MATERIALS',
    Icon: Layers,
    chipClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    kickerClass: 'text-amber-600 dark:text-amber-400',
  },
};

function resolveCardKindMeta(card: AssistantCard): CardKindMeta {
  const base = TYPE_META[card.type];
  if (card.tone !== 'danger') return { ...base, washClass: '' };
  return {
    kicker: card.type === 'list' ? 'BLOCKERS & RISKS' : base.kicker,
    Icon: card.type === 'list' ? ShieldAlert : base.Icon,
    chipClass: 'bg-destructive/10 text-destructive',
    kickerClass: 'text-destructive',
    washClass: 'border-destructive/30 bg-destructive/[0.04]',
  };
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

export function AssistantCardMessage({ card, createdAt, onFollowUp }: AssistantCardMessageProps) {
  const { formatCurrency } = useCurrency();
  const kind = resolveCardKindMeta(card);
  const asOf = createdAt
    ? `as of ${format(new Date(createdAt), 'MMM d')} · ${formatDistanceToNow(new Date(createdAt), { addSuffix: true })}`
    : 'just now';
  const footerText = `${card.sources.length} source${card.sources.length === 1 ? '' : 's'} · ${asOf}`;

  return (
    <div>
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
            {card.badge && (
              <Badge variant="secondary" className="shrink-0">
                {card.badge}
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
                      <div className="text-sm font-semibold capitalize text-foreground">{card.stage}</div>
                      <p className="text-xs text-muted-foreground">stage</p>
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

          {card.items.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {card.itemsLabel ?? 'Items'}
              </p>
              <div className="divide-y divide-border">
                {card.type === 'bom'
                  ? card.items.map((item) => <BomCardItemRow key={item.id} item={item} />)
                  : card.items.map((item) => <CardItemRow key={item.id} item={item} />)}
              </div>
            </div>
          ) : (
            card.emptyText && <p className="text-sm text-muted-foreground">{card.emptyText}</p>
          )}
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
  );
}
