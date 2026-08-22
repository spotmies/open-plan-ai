/**
 * BOMGoogleSheetsPullDialog — Pull (Import) preview/confirm. Implements the
 * row classification + required-field/ambiguous-unit resolution flow from
 * GOOGLE_SHEETS_BOM_INTEGRATION.md §1/Step 5. Confirm & Import stays
 * disabled until every flagged row is either resolved or explicitly skipped
 * — nothing commits from this screen without that.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowDownToLine, CheckCircle2, AlertCircle, ChevronDown, X, Trash2 } from 'lucide-react';
import BOMGoogleSheetsChangeList from './BOMGoogleSheetsChangeList';
import { useGoogleSheetsImportPreview, useGoogleSheetsImportCommit } from '@/hooks/useGoogleSheets';
import type { ImportRowPreview, ImportRowResolution, ImportCommitResult } from '@/services/googleSheets.service';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

// Placeholders here stand in for values the user still has to supply, so they
// are dimmed and italicised well below the base muted-foreground: at full
// muted weight an example like "4" reads as a value that's already entered,
// which is the opposite of what an unresolved required field should look like.
const PLACEHOLDER_INPUT = 'placeholder:text-muted-foreground/50 placeholder:italic';
const PLACEHOLDER_SELECT = 'data-[placeholder]:text-muted-foreground/50 data-[placeholder]:italic';

type LeadTimeUnit = 'days' | 'weeks' | 'months';
const UNIT_MULTIPLIER: Record<LeadTimeUnit, number> = { days: 1, weeks: 7, months: 30 };

const REQUIRED_FIELD_ORDER = [
  'Part Number',
  'Part Name',
  'Description',
  'Category',
  'Manufacturer',
  'MPN',
  'Supplier',
  'Unit Price',
  'Quantity',
] as const;

export default function BOMGoogleSheetsPullDialog({ open, onClose, projectId }: Props) {
  const preview = useGoogleSheetsImportPreview(projectId);
  const commit = useGoogleSheetsImportCommit(projectId);

  const [fieldEdits, setFieldEdits] = useState<Record<number, Record<string, string>>>({});
  const [unitEdits, setUnitEdits] = useState<Record<number, LeadTimeUnit>>({});
  const [leadTimeValueEdits, setLeadTimeValueEdits] = useState<Record<number, string>>({});
  const [bulkUnit, setBulkUnit] = useState<LeadTimeUnit | ''>('');
  const [skippedRows, setSkippedRows] = useState<Set<number>>(new Set());
  const [deleteChecked, setDeleteChecked] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  // Collapsed by default: nothing in here blocks the import, so it must not
  // push the sections that do block it below the fold.
  const [verifyOpen, setVerifyOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setFieldEdits({});
      setUnitEdits({});
      setLeadTimeValueEdits({});
      setBulkUnit('');
      setSkippedRows(new Set());
      setDeleteChecked(new Set());
      setResult(null);
      setVerifyOpen(false);
      preview.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const data = preview.data;

  const rowsByStatus = useMemo(() => {
    const grouped: Record<ImportRowPreview['status'], ImportRowPreview[]> = {
      'needs-input': [],
      'ambiguous-unit': [],
      'new-part': [],
      'matched-changed': [],
      'matched-unchanged': [],
    };
    for (const row of data?.rows ?? []) grouped[row.status].push(row);
    return grouped;
  }, [data]);

  const resolvedFieldValue = (row: ImportRowPreview, field: string): string =>
    fieldEdits[row.rowIndex]?.[field] ?? row.aiSuggestions[field as keyof ImportRowPreview['aiSuggestions']] ?? '';

  const isRowFullyResolved = (row: ImportRowPreview): boolean => {
    if (skippedRows.has(row.rowIndex)) return true;
    if (row.status === 'needs-input') {
      const fieldsOk = row.missingRequiredFields.every((f) => resolvedFieldValue(row, f).trim() !== '');
      const leadTimeOk =
        !row.leadTimeRequired ||
        (!!unitEdits[row.rowIndex] && (leadTimeValueEdits[row.rowIndex] ?? '').trim() !== '');
      return fieldsOk && leadTimeOk;
    }
    if (row.status === 'ambiguous-unit') {
      return !!unitEdits[row.rowIndex];
    }
    return true;
  };

  const allResolved = (data?.rows ?? []).every(isRowFullyResolved);

  // A needs-input row whose every flagged field already carries an AI
  // suggestion needs no typing — it only needs a look. Splitting on the
  // server payload (never on the live edits) keeps a row in one section for
  // the life of the dialog: typing into it, or skipping it, must not make it
  // hop between the red and the verify list under the user's cursor.
  const isAiCovered = (row: ImportRowPreview): boolean =>
    row.missingRequiredFields.length > 0 &&
    !row.leadTimeRequired &&
    row.missingRequiredFields.every(
      (f) => (row.aiSuggestions[f as keyof ImportRowPreview['aiSuggestions']] ?? '').trim() !== '',
    );

  const partNameOf = (row: ImportRowPreview): string =>
    (row.values['Part Name'] ?? '').trim() || (row.aiSuggestions['Part Name'] ?? '').trim();

  const hasAiSuggestion = (row: ImportRowPreview, field: string): boolean =>
    (row.aiSuggestions[field as keyof ImportRowPreview['aiSuggestions']] ?? '').trim() !== '';

  // Both lists key off the server payload rather than the live edits, so an
  // input never unmounts from under the caret the moment its first character
  // lands.
  const fieldsToType = (row: ImportRowPreview): string[] =>
    row.missingRequiredFields.filter((f) => !hasAiSuggestion(row, f));
  const fieldsToVerify = (row: ImportRowPreview): string[] =>
    row.missingRequiredFields.filter((f) => hasAiSuggestion(row, f));

  const needsInputRows = rowsByStatus['needs-input'];
  const blockingInputRows = needsInputRows.filter((r) => !isAiCovered(r));
  const aiFilledRows = needsInputRows.filter(isAiCovered);

  const handleFieldChange = (rowIndex: number, field: string, value: string) => {
    setFieldEdits((prev) => ({ ...prev, [rowIndex]: { ...prev[rowIndex], [field]: value } }));
  };

  const applyBulkUnit = (unit: LeadTimeUnit) => {
    setBulkUnit(unit);
    const next: Record<number, LeadTimeUnit> = { ...unitEdits };
    for (const row of rowsByStatus['ambiguous-unit']) next[row.rowIndex] = unit;
    setUnitEdits(next);
  };

  const toggleSkipRow = (rowIndex: number) => {
    setSkippedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleDeleteChecked = (nodeId: string) => {
    setDeleteChecked((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleConfirm = async () => {
    const resolutions: ImportRowResolution[] = rowsToImport
      .map((row) => {
        const resolution: ImportRowResolution = { rowIndex: row.rowIndex };
        if (row.status === 'needs-input') {
          const resolved: Record<string, string> = {};
          for (const field of row.missingRequiredFields) resolved[field] = resolvedFieldValue(row, field);
          resolution.resolvedRequiredFields = resolved as ImportRowResolution['resolvedRequiredFields'];
        }
        const unit = unitEdits[row.rowIndex];
        if (row.leadTimeRequired) {
          const value = leadTimeValueEdits[row.rowIndex];
          if (unit && value) {
            resolution.resolvedLeadTimeDays = Number(value) * UNIT_MULTIPLIER[unit];
          }
        } else if (unit && row.leadTimeRaw) {
          resolution.resolvedLeadTimeDays = Number(row.leadTimeRaw) * UNIT_MULTIPLIER[unit];
        }
        return resolution;
      });

    try {
      const res = await commit.mutateAsync({ rows: resolutions, deleteNodeIds: [...deleteChecked] });
      setResult(res);
    } catch {
      // useGoogleSheetsImportCommit's onError already surfaces the toast.
      // Swallowing here keeps the dialog open (so the user can retry) instead
      // of leaving an unhandled rejection from this onClick handler.
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  // The exact set of rows Confirm sends — reused by handleConfirm, the
  // "anything to do?" check, and the in-progress label, so the number the user
  // is told is importing can't drift from the number actually sent.
  const rowsToImport = (data?.rows ?? []).filter(
    (r) => r.status !== 'matched-unchanged' && !skippedRows.has(r.rowIndex),
  );
  const rowsToImportCount = rowsToImport.length;

  const hasAnyWork = data ? rowsToImportCount > 0 || deleteChecked.size > 0 : false;

  const needsInputCount = blockingInputRows.length;
  const aiFilledCount = aiFilledRows.length;
  const ambiguousUnitCount = rowsByStatus['ambiguous-unit'].length;
  const unmatchedColsCount = (data?.unmatchedColumns.length ?? 0) + (data?.ambiguousColumns.length ?? 0);
  const newPartsCount = rowsByStatus['new-part'].length;
  // Sub-component rows the sheet gave their parent's Part Number, which are
  // therefore keyed by MPN instead — worth calling out, since the number the
  // user typed into the sheet is not the number the part lands under.
  const mpnKeyedCount = (data?.rows ?? []).filter((r) => r.partNumberSource === 'mpn').length;
  const changedPartsCount = rowsByStatus['matched-changed'].length;
  const unchangedPartsCount = rowsByStatus['matched-unchanged'].length;

  // Shared by the blocking section and the verify section — the two differ
  // only in which of the row's flagged fields they surface, so the card
  // itself stays one implementation.
  const renderNeedsInputCard = (row: ImportRowPreview, verifyOnly: boolean) => {
    const skipped = skippedRows.has(row.rowIndex);
    const order = (fields: string[]) =>
      REQUIRED_FIELD_ORDER.filter((f) => fields.includes(f)) as string[];
    const shown = verifyOnly
      ? order(fieldsToVerify(row))
      : [...order(fieldsToType(row)), ...order(fieldsToVerify(row))];

    return (
      <div
        key={row.rowIndex}
        className={`rounded-xl border p-4 space-y-3 transition-colors ${
          skipped ? 'border-border/60 bg-muted/30 opacity-70' : 'border-border/80 bg-background/50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium">
            <span className="text-primary font-mono font-semibold">
              {row.partNumber || `Row ${row.rowIndex + 1}`}
            </span>
            {partNameOf(row) && (
              <span className="text-muted-foreground"> — {partNameOf(row)}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggleSkipRow(row.rowIndex)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            {skipped ? 'Undo skip' : 'Skip this part'}
          </button>
        </div>

        {skipped ? (
          <p className="text-xs text-muted-foreground italic">Won't be imported.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {shown.map((field) => {
              const aiFilled = hasAiSuggestion(row, field);
              return (
                <div key={field} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Label className="text-xs font-medium text-foreground">{field}</Label>
                  </div>
                  <Input
                    className={`h-9 text-xs sm:text-sm rounded-lg ${PLACEHOLDER_INPUT}`}
                    value={resolvedFieldValue(row, field)}
                    placeholder={aiFilled ? undefined : 'Required'}
                    onChange={(e) => handleFieldChange(row.rowIndex, field, e.target.value)}
                  />
                </div>
              );
            })}

            {!verifyOnly && row.leadTimeRequired && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label className="text-xs font-medium text-foreground">Lead Time</Label>
                </div>
                <div className="flex gap-2">
                  <Input
                    className={`h-9 text-xs sm:text-sm flex-1 rounded-lg ${PLACEHOLDER_INPUT}`}
                    type="text"
                    inputMode="numeric"
                    value={leadTimeValueEdits[row.rowIndex] ?? ''}
                    placeholder="e.g. 4"
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, '');
                      setLeadTimeValueEdits((prev) => ({ ...prev, [row.rowIndex]: v }));
                    }}
                  />
                  <Select
                    value={unitEdits[row.rowIndex] ?? ''}
                    onValueChange={(v) =>
                      setUnitEdits((prev) => ({ ...prev, [row.rowIndex]: v as LeadTimeUnit }))
                    }
                  >
                    <SelectTrigger className={`h-9 w-28 text-xs rounded-lg ${PLACEHOLDER_SELECT}`}>
                      <SelectValue placeholder="Unit?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">days</SelectItem>
                      <SelectItem value="weeks">weeks</SelectItem>
                      <SelectItem value="months">months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !commit.isPending && handleClose()}>
      <DialogContent
        hideClose
        className="!flex flex-col w-[98vw] max-w-[98vw] sm:max-w-[98vw] md:max-w-[98vw] lg:max-w-[98vw] xl:max-w-[98vw] h-[96vh] max-h-[96vh] p-5 sm:p-7 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl gap-0"
      >
        {/* Top Header Bar with Actions */}
        <DialogHeader className="flex flex-row items-center justify-between gap-4 pb-4 border-b border-border/60 text-left space-y-0 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-600">
              <ArrowDownToLine className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                Pull from Google Sheets
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Review what would change before anything writes to your BOM.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {commit.isPending ? (
              <span className="text-xs text-muted-foreground hidden md:inline-block font-medium">
                Importing {rowsToImportCount} part(s) — this can take a minute. Don&apos;t close or refresh.
              </span>
            ) : (
              !allResolved && !result && (
                <span className="text-xs text-muted-foreground hidden md:inline-block font-medium">
                  Resolve flagged items to continue
                </span>
              )
            )}
            {result ? (
              <Button onClick={handleClose} className="h-9 px-5 rounded-xl font-medium">
                Done
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  disabled={commit.isPending}
                  className="h-9 px-4 rounded-xl text-xs sm:text-sm font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={!data || !allResolved || !hasAnyWork || commit.isPending}
                  className="h-9 px-4 rounded-xl text-xs sm:text-sm font-medium"
                >
                  {commit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Confirm & Import
                </Button>
              </>
            )}
          </div>
        </DialogHeader>

        {preview.isPending && (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Reading the sheet and matching against your BOM...
          </div>
        )}

        {preview.isError && (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 py-16 text-sm text-destructive">
            <AlertCircle className="h-6 w-6" />
            <span>Couldn't load the Pull preview.</span>
            <Button variant="outline" size="sm" onClick={() => preview.mutate()} className="rounded-xl">
              Retry
            </Button>
          </div>
        )}

        {result && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-6">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-base font-semibold">Import completed successfully</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>• {result.createdCount} part(s) created</li>
              <li>• {result.updatedCount} part(s) updated</li>
              {result.movedCount > 0 && <li>• {result.movedCount} part(s) moved into their sub-assembly</li>}
              {result.deletedCount > 0 && <li>• {result.deletedCount} part(s) removed</li>}
              {result.failedCount > 0 && <li className="text-destructive">• {result.failedCount} row(s) failed</li>}
              {result.deleteResults.some((d) => d.outcome === 'failed') && (
                <li className="text-destructive">
                  • {result.deleteResults.filter((d) => d.outcome === 'failed').length} removal(s) failed
                </li>
              )}
            </ul>
            {(result.failedCount > 0 || result.deleteResults.some((d) => d.outcome === 'failed')) && (
              <ScrollArea className="max-h-48 rounded-xl border border-border p-3">
                <div className="space-y-1.5">
                  {result.results
                    .filter((r) => r.outcome === 'failed')
                    .map((r) => (
                      <div key={`row-${r.rowIndex}`} className="text-xs">
                        <span className="font-medium text-foreground">{r.partNumber || `Row ${r.rowIndex + 1}`}</span>{' '}
                        <span className="text-destructive">— {r.reason}</span>
                      </div>
                    ))}
                  {result.deleteResults
                    .filter((d) => d.outcome === 'failed')
                    .map((d) => (
                      <div key={`del-${d.nodeId}`} className="text-xs">
                        <span className="font-medium text-foreground">{d.partNumber || d.nodeId}</span>{' '}
                        <span className="text-destructive">— {d.reason}</span>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {data && !result && (
          <>
            {/* Static Summary Filter Pills Header */}
            <div className="flex flex-wrap items-center gap-2 py-3 border-b border-border/40 shrink-0">
              {needsInputCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('section-needs-input');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-red-700 dark:text-red-300 hover:bg-red-100/70 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Missing required fields
                  <span className="px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-[10.5px] font-bold">
                    {needsInputCount}
                  </span>
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 ml-0.5" />
                </button>
              )}

              {aiFilledCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setVerifyOpen(true);
                    document.getElementById('section-ai-filled')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  AI filled these in
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-[10.5px] font-bold">
                    {aiFilledCount}
                  </span>
                </button>
              )}

              {ambiguousUnitCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('section-ambiguous-unit');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-red-700 dark:text-red-300 hover:bg-red-100/70 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Lead time needs a unit
                  <span className="px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-[10.5px] font-bold">
                    {ambiguousUnitCount}
                  </span>
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 ml-0.5" />
                </button>
              )}

              {unmatchedColsCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('section-unmatched-columns');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Columns we couldn't match
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-[10.5px] font-bold">
                    {unmatchedColsCount}
                  </span>
                </button>
              )}

              {newPartsCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('section-new-parts');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  New parts that will be added
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[10.5px] font-bold">
                    {newPartsCount}
                  </span>
                </button>
              )}

              {changedPartsCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('section-changed-parts');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Existing parts that will be updated
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-[10.5px] font-bold">
                    {changedPartsCount}
                  </span>
                </button>
              )}

              {unchangedPartsCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('section-unchanged-parts');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-muted/40 text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                  Already up to date
                  <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10.5px] font-semibold">
                    {unchangedPartsCount}
                  </span>
                </button>
              )}
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-5 py-4">
              {!hasAnyWork && data.deletedParts.length === 0 && (
                <div className="rounded-2xl border border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Nothing to import — the sheet already matches your BOM.
                </div>
              )}

              {/* ── Sub-assembly structure read from the sheet ── */}
              {data.hierarchySignal !== 'none' && (
                <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-1.5">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                    Sub-assembly structure detected
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {data.hierarchySignal === 'outline-path' && (
                      <>Read from the <span className="font-medium text-foreground">{data.hierarchyColumn}</span> column&apos;s
                      item numbers (9, 9.1, 9.2…).</>
                    )}
                    {data.hierarchySignal === 'depth-number' && (
                      <>Read from the <span className="font-medium text-foreground">{data.hierarchyColumn}</span> column&apos;s
                      indent levels.</>
                    )}
                    {data.hierarchySignal === 'indent-prefix' && (
                      <>Read from the indentation in the <span className="font-medium text-foreground">{data.hierarchyColumn}</span> column.</>
                    )}{' '}
                    Parts will be nested {data.maxDepth + 1} level(s) deep instead of imported as one flat list.
                    That column is read as structure, so it isn&apos;t stored as an Additional Field.
                  </p>
                  {mpnKeyedCount > 0 && (
                    <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                      <span className="font-medium text-foreground">{mpnKeyedCount} sub-component(s)</span> repeat their
                      parent&apos;s Part Number in the sheet, so they&apos;ll be identified by their MPN instead — a part
                      number can only belong to one part.
                    </p>
                  )}
                </div>
              )}

              {/* ── Section 1: Missing required fields ── */}
              {blockingInputRows.length > 0 && (
                <div id="section-needs-input" className="rounded-2xl border border-red-200/90 dark:border-red-900/60 bg-card p-5 space-y-4 shadow-2xs">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-sm font-semibold text-foreground">Missing required fields</span>
                      <span className="px-2 py-0.5 rounded-full bg-muted text-foreground text-xs font-bold">
                        {blockingInputRows.length}
                      </span>
                      <span className="text-xs font-medium text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        needs your input before you can continue
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      These parts are missing a field the BOM requires and AI couldn't fill it in. Type a value for every
                      field below, or skip the part — you can't import until each one is settled.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {blockingInputRows.map((row) => renderNeedsInputCard(row, false))}
                  </div>
                </div>
              )}

              {/* ── Section 1b: AI-filled values, verify only (never blocks import) ── */}
              {aiFilledRows.length > 0 && (
                <Collapsible open={verifyOpen} onOpenChange={setVerifyOpen}>
                  <div id="section-ai-filled" className="rounded-2xl border border-amber-200/90 dark:border-amber-900/60 bg-card p-5 space-y-4 shadow-2xs">
                    <CollapsibleTrigger className="w-full text-left cursor-pointer">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-sm font-semibold text-foreground">AI filled these in — worth a look</span>
                          <span className="px-2 py-0.5 rounded-full bg-muted text-foreground text-xs font-bold">
                            {aiFilledRows.length}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">optional — won't block import</span>
                          <ChevronDown
                            className={`w-4 h-4 text-muted-foreground ml-auto transition-transform ${verifyOpen ? 'rotate-180' : ''}`}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Your sheet had no column for these fields, so AI supplied a value from the rest of the row. They're
                          ready to import as-is — open this if you'd rather check or edit them first.
                        </p>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="space-y-3 pt-1">
                        {aiFilledRows.map((row) => renderNeedsInputCard(row, true))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

              {/* ── Section 2: Lead time needs a unit ── */}
              {rowsByStatus['ambiguous-unit'].length > 0 && (
                <div id="section-ambiguous-unit" className="rounded-2xl border border-red-200/90 dark:border-red-900/60 bg-card p-5 space-y-4 shadow-2xs">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-sm font-semibold text-foreground">Lead time needs a unit</span>
                      <span className="px-2 py-0.5 rounded-full bg-muted text-foreground text-xs font-bold">
                        {rowsByStatus['ambiguous-unit'].length}
                      </span>
                      <span className="text-xs font-medium text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        needs your input before you can continue
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The sheet has a number for lead time but no day/week/month unit, so it can't be imported as-is. Pick a
                      unit for each.
                    </p>
                  </div>

                  {rowsByStatus['ambiguous-unit'].length > 1 && (
                    <div className="flex items-center gap-2 pt-1 pb-1">
                      <span className="text-xs text-muted-foreground">Set the same unit for all of these:</span>
                      <Select value={bulkUnit} onValueChange={(v) => applyBulkUnit(v as LeadTimeUnit)}>
                        <SelectTrigger className={`h-8 w-36 text-xs rounded-lg ${PLACEHOLDER_SELECT}`}>
                          <SelectValue placeholder="Pick a unit..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="days">days</SelectItem>
                          <SelectItem value="weeks">weeks</SelectItem>
                          <SelectItem value="months">months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="rounded-xl border border-border/80 overflow-hidden">
                    <div className="grid grid-cols-[1fr_120px_120px_130px] items-center px-4 py-2.5 bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
                      <div>PART</div>
                      <div>FIELD</div>
                      <div>VALUE IN SHEET</div>
                      <div className="text-right">UNIT</div>
                    </div>
                    <div className="divide-y divide-border/50">
                      {rowsByStatus['ambiguous-unit'].map((row) => {
                        return (
                          <div
                            key={row.rowIndex}
                            className="grid grid-cols-[1fr_120px_120px_130px] items-center px-4 py-2.5 text-xs bg-card hover:bg-muted/20 transition-colors"
                          >
                            <div className="font-mono text-primary font-medium truncate pr-2">
                              {row.partNumber || `Row ${row.rowIndex + 1}`}
                            </div>
                            <div className="text-muted-foreground">Lead Time</div>
                            <div className="font-mono text-muted-foreground">"{row.leadTimeRaw}"</div>
                            <div className="flex items-center justify-end gap-2">
                              <Select
                                value={unitEdits[row.rowIndex] ?? ''}
                                onValueChange={(v) =>
                                  setUnitEdits((prev) => ({
                                    ...prev,
                                    [row.rowIndex]: v as LeadTimeUnit,
                                  }))
                                }
                              >
                                <SelectTrigger className={`h-8 w-28 text-xs rounded-lg ${PLACEHOLDER_SELECT}`}>
                                  <SelectValue placeholder="Unit?" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="days">days</SelectItem>
                                  <SelectItem value="weeks">weeks</SelectItem>
                                  <SelectItem value="months">months</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Section 3: Columns we couldn't match ── */}
              {(data.unmatchedColumns.length > 0 || data.ambiguousColumns.length > 0) && (
                <div id="section-unmatched-columns" className="rounded-2xl border border-purple-200/90 dark:border-purple-900/60 bg-card p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-sm font-semibold text-foreground">Columns we couldn't match</span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-foreground text-xs font-bold">
                      {unmatchedColsCount}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {data.unmatchedColumns.length > 0 && (
                      <p>
                        • {data.unmatchedColumns.length} column(s) didn't match a standard BOM field and will be
                        imported into each part's <strong className="text-foreground">Additional Fields</strong>:{' '}
                        <strong className="text-foreground">{data.unmatchedColumns.join(', ')}</strong>
                      </p>
                    )}
                    {data.ambiguousColumns.length > 0 && (
                      <p>
                        • {data.ambiguousColumns.length} column(s) could match more than one BOM field, so none was
                        picked — they go to <strong className="text-foreground">Additional Fields</strong> instead:{' '}
                        <strong className="text-foreground">{data.ambiguousColumns.join(', ')}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Section 4: New parts that will be added ── */}
              {rowsByStatus['new-part'].length > 0 && (
                <div id="section-new-parts" className="rounded-2xl border border-blue-200/90 dark:border-blue-900/60 bg-card p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm font-semibold text-foreground">New parts that will be added</span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-foreground text-xs font-bold">
                      {rowsByStatus['new-part'].length}
                    </span>
                  </div>
                  {/* Indented by depth so the sub-assembly structure is visible
                      before committing, rather than after. */}
                  <div className="space-y-1">
                    {rowsByStatus['new-part'].map((row) => (
                      <div
                        key={row.rowIndex}
                        className="flex items-center gap-2 text-xs"
                        style={{ paddingLeft: `${row.depth * 18}px` }}
                      >
                        {row.depth > 0 && <span className="text-muted-foreground/60 font-mono">└</span>}
                        <span className="text-muted-foreground font-mono w-12 shrink-0">{row.levelPath}</span>
                        <Badge variant="secondary" className="text-xs px-2.5 py-1 font-mono rounded-lg">
                          {row.partNumber || `Row ${row.rowIndex + 1}`}
                        </Badge>
                        {row.partNumberSource === 'mpn' && (
                          <span className="text-[11px] text-muted-foreground">
                            keyed by MPN — the sheet repeats {row.sheetPartNumber}
                          </span>
                        )}
                        <span className="text-muted-foreground truncate">{partNameOf(row)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Section 5: Existing parts that will be updated ── */}
              {rowsByStatus['matched-changed'].length > 0 && (
                <div id="section-changed-parts" className="rounded-2xl border border-amber-200/90 dark:border-amber-900/60 bg-card p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-sm font-semibold text-foreground">Existing parts that will be updated</span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-foreground text-xs font-bold">
                      {rowsByStatus['matched-changed'].length}
                    </span>
                  </div>
                  <BOMGoogleSheetsChangeList
                    rows={rowsByStatus['matched-changed'].map((row) => ({
                      key: row.rowIndex,
                      partNumber: row.partNumber,
                      changes: row.changes,
                    }))}
                    fromLabel="Currently in BOM"
                    toLabel="Will be updated from sheet"
                  />
                </div>
              )}

              {/* ── Section 6: Already up to date ── */}
              {rowsByStatus['matched-unchanged'].length > 0 && (
                <div id="section-unchanged-parts" className="rounded-2xl border border-border/80 bg-card p-4">
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/60" />
                        Already up to date ({rowsByStatus['matched-unchanged'].length} parts)
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="flex flex-wrap gap-1.5 pt-3">
                        {rowsByStatus['matched-unchanged'].map((row) => (
                          <Badge key={row.rowIndex} variant="outline" className="text-[11px] font-mono rounded-md">
                            {row.partNumber}
                          </Badge>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              {/* ── Section 7: Removed from sheet ── */}
              {data.deletedParts.length > 0 && (
                <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Removed from sheet — {data.deletedParts.length} part(s)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      These BOM parts no longer have a matching row in the sheet. Check any you'd like
                      to remove from the BOM too — nothing is deleted unless you check it.
                    </p>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1.5">
                    {data.deletedParts.map((part) => {
                      const checked = deleteChecked.has(part.nodeId);
                      return (
                        <label
                          key={part.nodeId}
                          className={`flex items-center gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-colors ${
                            checked
                              ? 'border-destructive/40 bg-destructive/5'
                              : 'border-border hover:bg-muted/40'
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleDeleteChecked(part.nodeId)}
                          />
                          <Trash2
                            className={`h-3.5 w-3.5 shrink-0 ${
                              checked ? 'text-destructive' : 'text-muted-foreground'
                            }`}
                          />
                          <span className="text-xs min-w-0 flex-1">
                            <span className="font-mono font-medium text-foreground">{part.partNumber}</span>
                            {part.name && <span className="text-muted-foreground"> — {part.name}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
