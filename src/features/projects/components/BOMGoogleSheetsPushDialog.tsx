/**
 * BOMGoogleSheetsPushDialog — Push (Export) preview/confirm. Implements the
 * three explicit questions from GOOGLE_SHEETS_BOM_INTEGRATION.md §1/Step 4,
 * each an independent toggle that defaults OFF (nothing is written unless
 * the user explicitly opts in) — "none default" per the plan. New rows
 * always write regardless of the toggles; only overwriting sheet data
 * already present is gated.
 */
import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowUpFromLine, CheckCircle2, AlertCircle } from 'lucide-react';
import BOMGoogleSheetsChangeList from './BOMGoogleSheetsChangeList';
import { useGoogleSheetsExportPreview, useGoogleSheetsExportCommit } from '@/hooks/useGoogleSheets';
import type { ExportCommitResult } from '@/services/googleSheets.service';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export default function BOMGoogleSheetsPushDialog({ open, onClose, projectId }: Props) {
  const preview = useGoogleSheetsExportPreview(projectId);
  const commit = useGoogleSheetsExportCommit(projectId);

  const [addNewFields, setAddNewFields] = useState(false);
  const [updateChangedColumns, setUpdateChangedColumns] = useState(false);
  const [renameHeaders, setRenameHeaders] = useState(false);
  const [result, setResult] = useState<ExportCommitResult | null>(null);

  useEffect(() => {
    if (open) {
      setAddNewFields(false);
      setUpdateChangedColumns(false);
      setRenameHeaders(false);
      setResult(null);
      preview.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const data = preview.data;
  const isFirstExport = !!data?.isFirstExport;
  const nothingToDo =
    data && !isFirstExport &&
    data.newFields.length === 0 &&
    data.renamedHeaders.length === 0 &&
    data.newPartRows.length === 0 &&
    data.changedRows.length === 0 &&
    (data.changedAttachments?.length ?? 0) === 0;

  const handleConfirm = async () => {
    const res = await commit.mutateAsync({ addNewFields, updateChangedColumns, renameHeaders });
    setResult(res);
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        hideClose
        className="!flex flex-col w-[98vw] max-w-[98vw] sm:max-w-[98vw] md:max-w-[98vw] lg:max-w-[98vw] xl:max-w-[98vw] h-[96vh] max-h-[96vh] p-5 sm:p-7 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl gap-0"
      >
        {/* Top Header Bar with Actions */}
        <DialogHeader className="flex flex-row items-center justify-between gap-4 pb-4 border-b border-border/60 text-left space-y-0 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-600">
              <ArrowUpFromLine className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                Push to Google Sheets
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Latest revision only — nothing writes until you confirm.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
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
                  className="h-9 px-4 rounded-xl text-xs sm:text-sm font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={!data || commit.isPending || (nothingToDo && !isFirstExport)}
                  className="h-9 px-4 rounded-xl text-xs sm:text-sm font-medium"
                >
                  {commit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Confirm & Write
                </Button>
              </>
            )}
          </div>
        </DialogHeader>

        {preview.isPending && (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Comparing your BOM against the sheet...
          </div>
        )}

        {preview.isError && (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 py-16 text-sm text-destructive">
            <AlertCircle className="h-6 w-6" />
            <span>Couldn't load the Push preview.</span>
            <Button variant="outline" size="sm" onClick={() => preview.mutate()} className="rounded-xl">
              Retry
            </Button>
          </div>
        )}

        {result && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-6">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-base font-semibold">Push complete</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>• {result.newRowsWritten} new row(s) written</li>
              {result.newFieldsAdded > 0 && <li>• {result.newFieldsAdded} new field(s) added</li>}
              {result.columnsUpdated > 0 && <li>• {result.columnsUpdated} row(s) updated</li>}
              {result.headersRenamed > 0 && <li>• {result.headersRenamed} header(s) renamed</li>}
              <li>• {result.totalRowsWritten} total row(s) in the sheet</li>
            </ul>
          </div>
        )}

        {data && !result && (
          <>
            {/* Static Summary badges Header */}
            <div className="flex flex-wrap items-center gap-2 py-3 border-b border-border/40 shrink-0">
              {data.newPartRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('push-section-new-parts');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  New parts to add
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[10.5px] font-bold">
                    {data.newPartRows.length}
                  </span>
                </button>
              )}
              {data.newFields.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('push-section-new-fields');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  New fields detected
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-[10.5px] font-bold">
                    {data.newFields.length}
                  </span>
                </button>
              )}
              {data.changedRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('push-section-changed-rows');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Parts with updated values
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-[10.5px] font-bold">
                    {data.changedRows.length}
                  </span>
                </button>
              )}
              {(data.changedAttachments?.length ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('push-section-attachments');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-sky-200 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300 hover:bg-sky-100/70 dark:hover:bg-sky-900/40 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  Documents &amp; images
                  <span className="px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-[10.5px] font-bold">
                    {data.changedAttachments.length}
                  </span>
                </button>
              )}
              {data.unchangedCount > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-muted/40 text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                  Already up to date
                  <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10.5px] font-semibold">
                    {data.unchangedCount}
                  </span>
                </div>
              )}
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-5 py-4">
              {isFirstExport ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-sm text-foreground space-y-1">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">First-time sheet export</p>
                  <p className="text-xs text-muted-foreground">
                    This sheet has no BOM data yet — Push will write all {data.totalRows} part(s) as a fresh export.
                  </p>
                </div>
              ) : nothingToDo ? (
                <div className="rounded-2xl border border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Nothing to push — your sheet already matches the latest revision of every part.
                </div>
              ) : (
              <div className="space-y-4">
                {data.newPartRows.length > 0 && (
                  <div id="push-section-new-parts" className="rounded-2xl border border-blue-200/90 dark:border-blue-900/60 bg-card p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-sm font-semibold text-foreground">New parts that will be added</span>
                      <span className="px-2 py-0.5 rounded-full bg-muted text-foreground text-xs font-bold">
                        {data.newPartRows.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* Each entry is a node's full path ("assy-1 > cmp-shared"); the
                          leaf is the part itself, the rest is where it sits. */}
                      {data.newPartRows.map((path) => (
                        <Badge key={path} variant="secondary" className="text-xs px-2.5 py-1 font-mono rounded-lg">
                          {path.split(' > ').pop()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {data.newFields.length > 0 && (
                  <div id="push-section-new-fields" className="rounded-2xl border border-border/80 bg-card p-5 space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Some new fields have been added to our BOM.</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Would you like to add these columns to Google Sheets too?
                        </p>
                      </div>
                      <Switch checked={addNewFields} onCheckedChange={setAddNewFields} />
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {data.newFields.map((f) => (
                        <Badge key={f} variant="secondary" className="text-xs font-mono rounded-md">{f}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {data.changedRows.length > 0 && (
                  <div id="push-section-changed-rows" className="rounded-2xl border border-border/80 bg-card p-5 space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {data.changedRows.length} part(s) have values that differ from the sheet.
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Would you like to update these columns in Google Sheets, or leave them as-is?
                        </p>
                      </div>
                      <Switch checked={updateChangedColumns} onCheckedChange={setUpdateChangedColumns} />
                    </div>
                    <BOMGoogleSheetsChangeList
                      className="pt-1"
                      rows={data.changedRows.map((row) => ({
                        key: row.path,
                        partNumber: row.partNumber,
                        changes: row.changes,
                      }))}
                      fromLabel="Currently in sheet"
                      toLabel="Will be written from BOM"
                    />
                  </div>
                )}

                {(data.changedAttachments?.length ?? 0) > 0 && (
                  <div id="push-section-attachments" className="rounded-2xl border border-border/80 bg-card p-5 space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {data.changedAttachments.length} part(s) have documents or images to sync.
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Public file links, written to the sheet automatically — files are attached in the app,
                          so there's nothing on the sheet side to preserve.
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[11px] rounded-md shrink-0">Always synced</Badge>
                    </div>
                    <BOMGoogleSheetsChangeList
                      className="pt-1"
                      rows={data.changedAttachments.map((row) => ({
                        key: `att-${row.path}`,
                        partNumber: row.partNumber,
                        changes: row.changes,
                      }))}
                      fromLabel="Currently in sheet"
                      toLabel="Will be written from BOM"
                    />
                  </div>
                )}

                {data.renamedHeaders.length > 0 && (
                  <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Column names in Google Sheets differ from our BOM.
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Would you like to rename them in Google Sheets to match our BOM?
                        </p>
                      </div>
                      <Switch checked={renameHeaders} onCheckedChange={setRenameHeaders} />
                    </div>
                    <div className="space-y-1 pt-1">
                      {data.renamedHeaders.map((r) => (
                        <div key={r.canonicalLabel} className="text-xs text-muted-foreground font-mono">
                          "{r.oldHeader}" → <strong className="text-foreground">"{r.newHeader}"</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
