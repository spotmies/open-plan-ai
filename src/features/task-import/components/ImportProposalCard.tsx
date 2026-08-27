import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, XCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImportProposalPreview, CommitImportResult } from '../taskImportData';

interface Props {
  preview: ImportProposalPreview;
  status: string;
  result: CommitImportResult | null;
  onCommit: () => void;
  committing: boolean;
}

export function ImportProposalCard({ preview, status, result, onCommit, committing }: Props) {
  // Sourced straight from the server-refetched proposal row, not local
  // component state — so the outcome shown here can never go stale just
  // because a commit's own HTTP response was slow, dropped, or the dialog
  // was reopened after the fact. The proposal's status is the one thing
  // that's always authoritative.
  const isPending = status === 'pending';
  const isExecuting = status === 'executing';
  const isSuccess = status === 'executed' || status === 'partially_executed';
  const isFailed = status === 'failed';

  // A row is only ever blocked by a missing title (or an explicit skip) —
  // everything else (unmatched assignee/milestone, unrecognized priority) is
  // a note: the row still imports, just without that optional field set.
  const blockedCount = preview.itemCount - preview.cleanCount;
  const advisoryCount = preview.rows.filter((r) => r.importable && r.issues.length > 0).length;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">
          {preview.itemCount} task{preview.itemCount === 1 ? '' : 's'} found
        </div>
        {isSuccess ? (
          <Badge variant="outline" className="gap-1.5 text-emerald-600 border-emerald-300 py-1">
            <CheckCircle2 className="h-3 w-3" />
            Imported
          </Badge>
        ) : isFailed ? (
          <Badge variant="outline" className="gap-1.5 text-destructive border-destructive/40 py-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        ) : blockedCount > 0 ? (
          <Badge variant="outline" className="gap-1.5 text-destructive border-destructive/40 py-1">
            <XCircle className="h-3 w-3" />
            {blockedCount} blocked
          </Badge>
        ) : advisoryCount > 0 ? (
          <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-300 py-1">
            <AlertCircle className="h-3 w-3" />
            {advisoryCount} with notes
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 text-emerald-600 border-emerald-300 py-1">
            <CheckCircle2 className="h-3 w-3" />
            All ready
          </Badge>
        )}
      </div>

      {/* The row list stays visible even after a successful import — it's
          a record of what was found, and still shows which rows were
          skipped if the batch was only partially imported. */}
      <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
        {preview.rows.map((row, i) => (
          <div key={i} className={cn('p-3.5 text-sm flex flex-col gap-1.5', !row.importable && 'bg-destructive/5')}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium truncate">{row.title}</span>
              {row.priority && (
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {row.priority}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              {row.assigneeName && <span>Assignee: {row.assigneeName}</span>}
              {row.dueDate && <span>Due: {row.dueDate}</span>}
              {row.milestoneName && <span>Milestone: {row.milestoneName}</span>}
            </div>
            {row.issues.length > 0 && (
              <div
                className={cn(
                  'text-xs flex items-start gap-1.5 pt-0.5',
                  row.importable ? 'text-amber-600' : 'text-destructive',
                )}
              >
                {row.importable ? (
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                )}
                <span>{row.issues.filter((i) => i !== '__skipped__').join('; ') || 'Skipped'}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {isPending && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-muted-foreground leading-relaxed">
            {blockedCount > 0
              ? `${preview.cleanCount} will be imported now, ${blockedCount} blocked until fixed`
              : `All ${preview.itemCount} will be imported${advisoryCount > 0 ? ` (${advisoryCount} with a note)` : ''}`}
          </span>
          <Button size="sm" onClick={onCommit} disabled={committing || preview.cleanCount === 0} className="shrink-0">
            {committing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Import {preview.cleanCount} task{preview.cleanCount === 1 ? '' : 's'}
          </Button>
        </div>
      )}

      {isExecuting && (
        <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Importing…
        </div>
      )}

      {isSuccess && (
        <div className="flex items-center gap-2 pt-1 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            {result ? `Import successful — ${result.created} task${result.created === 1 ? '' : 's'} created` : 'Import successful'}
            {result && result.skipped > 0 ? `, ${result.skipped} skipped` : ''}
          </span>
        </div>
      )}

      {isFailed && (
        <div className="flex items-center gap-2 pt-1 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>Import failed{result && 'reasons' in result && result.reasons?.[0] ? `: ${result.reasons[0]}` : ''}</span>
        </div>
      )}
    </div>
  );
}
