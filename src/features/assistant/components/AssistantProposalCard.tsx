import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  X,
  XCircle,
  Clock,
  Ban,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AssistantProposal, ProposalItem } from '../assistantData';
import { AssistantProposalForm } from './AssistantProposalForm';

// Same deep-link route table AssistantCardMessage.tsx uses — small enough,
// and feature-local enough, to duplicate rather than import (matches this
// codebase's existing per-feature-helper convention).
const ENTITY_DEEP_LINK: Record<string, (projectId: string, entityId: string) => string> = {
  task: (projectId, entityId) => `/projects/${projectId}/tasks/${entityId}`,
  issue: (projectId, entityId) => `/projects/${projectId}/issues/${entityId}`,
  milestone: (projectId, entityId) => `/projects/${projectId}/milestones/${entityId}`,
  hardware_module: (projectId, entityId) => `/projects/${projectId}/modules/${entityId}`,
  bom_node: (projectId, entityId) => `/projects/${projectId}/bom/${entityId}`,
  eco: (projectId, entityId) => `/projects/${projectId}/eng-changes/${entityId}`,
};

const VISIBLE_ITEMS_COLLAPSED = 3;

interface AssistantProposalCardProps {
  proposal: AssistantProposal;
  readOnly?: boolean;
  onConfirm?: (proposalId: string) => void;
  onReject?: (proposalId: string, reason?: string) => void;
  onRevise?: (proposalId: string, edits: Record<string, unknown>) => Promise<AssistantProposal>;
  isConfirming?: boolean;
  isRejecting?: boolean;
  isRevising?: boolean;
}

function actionVerb(actionKind: AssistantProposal['actionKind'], itemCount: number): string {
  if (actionKind === 'create') return itemCount === 1 ? 'Create' : `Create ${itemCount}`;
  if (actionKind === 'update') return itemCount === 1 ? 'Update' : `Update ${itemCount}`;
  return `Change ${itemCount}`;
}

function entityNoun(entityType: string, count: number): string {
  const map: Record<string, [string, string]> = {
    task: ['task', 'tasks'],
    issue: ['issue', 'issues'],
    milestone: ['milestone', 'milestones'],
    hardware_module: ['module', 'modules'],
    bom_node: ['BOM line', 'BOM lines'],
    eco: ['ECO', 'ECOs'],
  };
  const [one, many] = map[entityType] ?? [entityType, entityType];
  return count === 1 ? one : many;
}

function ItemRow({ item, entityType, readOnly }: { item: ProposalItem; entityType: string; readOnly?: boolean }) {
  const navigate = useNavigate();
  const target = !readOnly && item.kind === 'update' ? ENTITY_DEEP_LINK[item.deepLink.entityType]?.(item.deepLink.projectId, item.deepLink.id) : undefined;

  return (
    <div
      className={cn('rounded-lg border border-border/60 px-3 py-2', target && 'cursor-pointer hover:bg-muted/40')}
      onClick={target ? () => navigate(target) : undefined}
      role={target ? 'link' : undefined}
    >
      <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
      {item.kind === 'update' ? (
        <div className="mt-1 space-y-0.5">
          {item.changes.map((change) => (
            <p key={change.label} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">{change.label}:</span> {change.from} <span aria-hidden="true">→</span> {change.to}
            </p>
          ))}
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {item.fields.map((field) => (
            <p key={field.label} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">{field.label}:</span> {field.value}
            </p>
          ))}
        </div>
      )}
      <span className="sr-only">{entityType}</span>
    </div>
  );
}

const TERMINAL_META: Record<
  string,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  executed: { label: 'Done', className: 'text-emerald-600 dark:text-emerald-400', Icon: CheckCircle2 },
  partially_executed: { label: 'Partly done', className: 'text-amber-600 dark:text-amber-400', Icon: AlertTriangle },
  failed: { label: 'Failed', className: 'text-red-600 dark:text-red-400', Icon: XCircle },
  rejected: { label: 'Dismissed', className: 'text-muted-foreground', Icon: X },
  expired: { label: 'Expired', className: 'text-muted-foreground', Icon: Clock },
  superseded: { label: 'Superseded', className: 'text-muted-foreground', Icon: Ban },
};

export function AssistantProposalCard({ proposal, readOnly, onConfirm, onReject, onRevise, isConfirming, isRejecting, isRevising }: AssistantProposalCardProps) {
  const [showAll, setShowAll] = useState(false);
  const [editingOverride, setEditingOverride] = useState<boolean | null>(null);
  const preview = proposal.preview ?? {
    destination: { projectId: proposal.projectId, projectName: 'Unknown project', inferredFrom: 'explicit' as const },
    entityType: proposal.entityType,
    actionKind: proposal.actionKind,
    itemCount: 0,
    noopCount: 0,
    items: [],
    warnings: [],
  };
  const destination = preview.destination ?? {
    projectId: proposal.projectId,
    projectName: 'Unknown project',
    inferredFrom: 'explicit' as const,
  };
  const isPending = proposal.status === 'pending';
  const isExecuting = proposal.status === 'executing';
  const isBusy = isConfirming || isRejecting || isRevising || isExecuting;
  const items = Array.isArray(preview.items) ? preview.items : [];
  const warnings = Array.isArray(preview.warnings) ? preview.warnings : [];
  const resultItems = Array.isArray(proposal.result?.items) ? proposal.result.items : [];
  const visibleItems = showAll ? items : items.slice(0, VISIBLE_ITEMS_COLLAPSED);
  const hiddenCount = items.length - visibleItems.length;
  const headline = `${actionVerb(preview.actionKind, preview.itemCount)} ${entityNoun(preview.entityType, preview.itemCount)}`;
  const expired = isPending && new Date(proposal.expiresAt).getTime() <= Date.now();
  const terminal = TERMINAL_META[proposal.status];

  // Not yet reviewed (fresh proposal) or the user clicked Edit — show the
  // fill-in/editable form instead of the read-only card. Only ever true for
  // a still-pending proposal with a form to prefill from; readOnly (share
  // view) and terminal/formState-less proposals never enter this branch.
  const isEditing = isPending && !readOnly && !!proposal.formState && (editingOverride ?? !proposal.reviewedAt);

  const handleFormSubmit = async (edits: Record<string, unknown>) => {
    await onRevise?.(proposal.id, edits);
    setEditingOverride(false);
  };

  const handleFormCancel = () => {
    if (proposal.reviewedAt) {
      setEditingOverride(false);
    } else {
      onReject?.(proposal.id);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-start gap-2.5">
        <div className="h-7 w-7 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <Card className="overflow-hidden border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {proposal.reviewedAt ? 'Editing' : 'Review before confirming'}
                  </p>
                  <h4 className="truncate text-base font-semibold text-foreground">{headline}</h4>
                </div>
                <Badge variant="outline" className="shrink-0 gap-1 text-xs font-normal">
                  {destination.projectName}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <AssistantProposalForm
                entityType={preview.entityType}
                projectId={proposal.projectId}
                formState={proposal.formState!}
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="h-7 w-7 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <Card className={cn('overflow-hidden', isPending && !expired && 'border-primary/30')}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {terminal ? 'Proposed change' : expired ? 'Expired proposal' : 'Awaiting your confirmation'}
                </p>
                <h4 className="truncate text-base font-semibold text-foreground">{headline}</h4>
              </div>
              <Badge variant="outline" className="shrink-0 gap-1 text-xs font-normal">
                {destination.projectName}
                {destination.inferredFrom === 'pinned' && <span className="text-muted-foreground">(inferred)</span>}
              </Badge>
            </div>
            {preview.rationale && <p className="mt-1 text-xs italic text-muted-foreground">{preview.rationale}</p>}
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            {warnings.length > 0 && (
              <div className="space-y-1 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
                {warnings.map((warning) => (
                  <div key={warning.code} className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{warning.message}</span>
                  </div>
                ))}
              </div>
            )}

            {preview.entityType === 'milestone' && preview.actionKind === 'update' && (
              <p className="text-xs text-muted-foreground">Dependent items are not moved.</p>
            )}

            <div className="space-y-1.5">
              {visibleItems.map((item) => (
                <ItemRow key={item.index} item={item} entityType={preview.entityType} readOnly={readOnly} />
              ))}
            </div>

            {hiddenCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setShowAll(true)}>
                <ChevronDown className="h-3 w-3" />
                Show all {items.length}
              </Button>
            )}

            {terminal && proposal.result && (
              <div className="flex items-center gap-1.5 text-xs font-medium" aria-live="polite">
                <terminal.Icon className={cn('h-3.5 w-3.5', terminal.className)} />
                <span className={terminal.className}>
                  {terminal.label} · {proposal.result.succeeded} succeeded
                  {proposal.result.failed > 0 ? `, ${proposal.result.failed} failed` : ''}
                </span>
              </div>
            )}
            {proposal.status === 'rejected' && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <X className="h-3.5 w-3.5" />
                Dismissed{proposal.rejectedReason ? `: ${proposal.rejectedReason}` : ''}
              </div>
            )}
            {(proposal.status === 'expired' || proposal.status === 'superseded' || (proposal.status === 'failed' && !proposal.result)) && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {proposal.status === 'expired' ? <Clock className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                {proposal.status === 'expired' ? 'This confirmation expired unconfirmed.' : proposal.status === 'superseded' ? 'Replaced by a newer request.' : 'Could not be executed.'}
              </div>
            )}

            {proposal.result && proposal.result.failed > 0 && (
              <div className="space-y-1 border-t border-border/60 pt-2">
                {resultItems
                  .filter((i) => i.status === 'failed')
                  .map((i) => (
                    <p key={i.index} className="text-xs text-red-600 dark:text-red-400">
                      <span className="font-medium">{i.label}:</span> {i.error?.message ?? 'failed'}
                    </p>
                  ))}
              </div>
            )}
          </CardContent>

          {isPending && !readOnly && (
            <CardFooter className="flex items-center gap-2 pt-0">
              <Button
                size="sm"
                className="gap-1.5"
                disabled={isBusy || expired}
                aria-label={`Confirm: ${headline.toLowerCase()}`}
                onClick={() => onConfirm?.(proposal.id)}
              >
                {isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isBusy || expired}
                onClick={() => onReject?.(proposal.id)}
              >
                Dismiss
              </Button>
              {proposal.formState && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  disabled={isBusy || expired}
                  onClick={() => setEditingOverride(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {expired ? 'Expired' : `Expires ${formatDistanceToNow(new Date(proposal.expiresAt), { addSuffix: true })}`}
              </span>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
