/**
 * BOMGoogleSheetsChangeList — shared before/after renderer for the Google
 * Sheets Pull and Push previews. Both directions already ship the same
 * { field, oldValue, newValue } shape from the backend, and in both of them
 * `oldValue` is the destination's current value while `newValue` is the
 * incoming one — Pull writes into the BOM, Push writes into the sheet. Only
 * the wording for those two sides differs, so it comes in as a prop and the
 * diff rendering itself stays shared.
 */
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SheetsFieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface SheetsChangedRow {
  key: string | number;
  partNumber: string;
  changes: SheetsFieldChange[];
}

// Parts start collapsed once there are more than this many of them — a long
// list of parts each carrying several field diffs is unreadable fully
// expanded. Below the limit everything is open, since the common case is a
// handful of edits the user wants to eyeball without extra clicks.
const AUTO_EXPAND_LIMIT = 5;

// A blank cell is a real, meaningful diff state (a value being cleared, or
// filled in for the first time), so it gets rendered explicitly rather than
// collapsing into an empty gap the user can't interpret.
const EMPTY_PLACEHOLDER = '(empty)';

function ValueCell({ value, tone }: { value: string; tone: 'old' | 'new' }) {
  const isEmpty = value.trim() === '';
  return (
    <span
      className={cn(
        'font-mono text-[11px] px-1.5 py-0.5 rounded break-all',
        isEmpty && 'italic font-sans text-muted-foreground/70',
        tone === 'old'
          ? 'bg-muted text-muted-foreground'
          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold',
        // Struck through only when there's actually text to strike — a
        // struck-through "(empty)" reads as a value being removed.
        tone === 'old' && !isEmpty && 'line-through decoration-muted-foreground/40',
      )}
    >
      {isEmpty ? EMPTY_PLACEHOLDER : value}
    </span>
  );
}

function ChangeRow({ change }: { change: SheetsFieldChange }) {
  return (
    <div className="grid grid-cols-[minmax(5rem,8rem)_1fr] gap-x-3 items-baseline py-1.5">
      <span className="text-[11px] font-medium text-muted-foreground truncate" title={change.field}>
        {change.field}
      </span>
      <span className="flex items-center gap-1.5 flex-wrap min-w-0">
        <ValueCell value={change.oldValue} tone="old" />
        <ArrowRight className="w-3 h-3 text-muted-foreground/70 shrink-0" />
        <ValueCell value={change.newValue} tone="new" />
      </span>
    </div>
  );
}

function PartChanges({ row, defaultOpen }: { row: SheetsChangedRow; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border/70 bg-muted/20">
      <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-muted/40 rounded-lg transition-colors">
        <ChevronDown
          className={cn('w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform', !open && '-rotate-90')}
        />
        <span className="font-mono text-xs font-semibold text-foreground truncate">{row.partNumber || '—'}</span>
        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
          {row.changes.length} field{row.changes.length === 1 ? '' : 's'}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-2 border-t border-border/60 divide-y divide-border/40">
        {row.changes.map((change) => (
          <ChangeRow key={change.field} change={change} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function BOMGoogleSheetsChangeList({
  rows,
  fromLabel,
  toLabel,
  className,
}: {
  rows: SheetsChangedRow[];
  /** What the struck-through left side is, e.g. "Currently in sheet". */
  fromLabel: string;
  /** What the highlighted right side is, e.g. "Will be written from BOM". */
  toLabel: string;
  className?: string;
}) {
  if (rows.length === 0) return null;

  const defaultOpen = rows.length <= AUTO_EXPAND_LIMIT;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="px-1.5 py-0.5 rounded bg-muted">{fromLabel}</span>
        <ArrowRight className="w-3 h-3 shrink-0" />
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
          {toLabel}
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        {rows.map((row) => (
          <PartChanges key={row.key} row={row} defaultOpen={defaultOpen} />
        ))}
      </div>
    </div>
  );
}
