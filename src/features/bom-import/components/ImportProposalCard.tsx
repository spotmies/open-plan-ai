import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, XCircle, CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { ImportProposalPreview, CommitImportResult } from '../bomImportData';

interface Props {
  preview: ImportProposalPreview;
  status: string;
  result: CommitImportResult | null;
  onCommit: () => void;
  committing: boolean;
  compact?: boolean;
}

export function ImportProposalCard({ preview, status, result, onCommit, committing, compact = false }: Props) {
  const [expanded, setExpanded] = useState(!compact);
  // Sourced straight from the server-refetched proposal row — see
  // task-import/components/ImportProposalCard.tsx's comment for why.
  const isPending = status === 'pending';
  const isExecuting = status === 'executing';
  const isSuccess = status === 'executed' || status === 'partially_executed';
  const isFailed = status === 'failed';

  const blockedCount = preview.itemCount - preview.cleanCount;
  const advisoryCount = preview.rows.filter((r) => r.importable && r.issues.length > 0).length;
  const hasWarnings = advisoryCount > 0;
  const isMultiLevel = preview.rows.some((r) => r.level > 0);

  const showRows = !compact || expanded;

  return (
    <div className={cn('rounded-xl border bg-card space-y-4', compact ? 'p-4' : 'p-5')}>
      <div className="flex items-center justify-between gap-2">
        <div className={cn('font-semibold', compact ? 'text-[15px]' : 'text-sm')}>
          {preview.itemCount} part{preview.itemCount === 1 ? '' : 's'} found
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

      {showRows ? (
        <div className={cn('overflow-y-auto rounded-lg border divide-y', compact ? 'max-h-40' : 'max-h-72')}>
          {preview.rows.map((row, i) => (
            <div
              key={i}
              style={isMultiLevel ? { paddingLeft: `${12 + row.level * 16}px` } : undefined}
              className={cn(compact ? 'p-3 text-sm flex flex-col gap-1' : 'p-3.5 text-sm flex flex-col gap-1.5', !row.importable && 'bg-destructive/5')}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={cn('font-medium truncate', compact && 'text-[13px]')}>
                  {row.partNumber} — {row.name}
                </span>
                {row.existingPartId ? (
                  <Badge variant="secondary" className={cn('shrink-0', compact && 'text-[11px] px-2 py-0.5')}>
                    Existing part
                  </Badge>
                ) : (
                  <Badge variant="outline" className={cn('shrink-0 capitalize', compact && 'text-[11px] px-2 py-0.5')}>
                    {row.category}
                  </Badge>
                )}
              </div>
              <div className={cn('text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1', compact && 'gap-x-3 text-[11px]')}>
                <span>Qty: {row.quantity}</span>
                {row.unitPrice != null && <span>Unit Price: ${row.unitPrice.toFixed(2)}</span>}
                {row.leadTimeWeeks != null && <span>Lead: {row.leadTimeWeeks}wk</span>}
              </div>
              {row.issues.length > 0 && (
                <div
                  className={cn(
                    compact ? 'text-[11px] flex items-start gap-1.5 pt-0.5' : 'text-xs flex items-start gap-1.5 pt-0.5',
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
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-between text-muted-foreground"
          onClick={() => setExpanded(true)}
        >
          <span>Expand part preview</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}

      {compact && showRows && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-between px-0 text-muted-foreground"
          onClick={() => setExpanded(false)}
        >
          <span>Hide part preview</span>
          <ChevronUp className="h-4 w-4" />
        </Button>
      )}

      {isPending && (
        <div className="flex items-center justify-between gap-3 pt-1 animate-fade-in">
          <span className={cn('text-xs text-muted-foreground leading-relaxed', compact && 'text-[11px]')}>
            {blockedCount > 0
              ? `${preview.cleanCount} will be imported now, ${blockedCount} blocked until fixed`
              : hasWarnings
                ? `Resolve the noted rows before importing all ${preview.itemCount} part${preview.itemCount === 1 ? '' : 's'}`
                : `All ${preview.itemCount} will be imported`}
          </span>
          {!hasWarnings && (
            <Button size="sm" onClick={onCommit} disabled={committing || preview.cleanCount === 0} className="shrink-0">
              {committing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Import {preview.cleanCount} part{preview.cleanCount === 1 ? '' : 's'}
            </Button>
          )}
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
            {result ? `Import successful — ${result.created} part${result.created === 1 ? '' : 's'} created` : 'Import successful'}
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
