/**
 * BOMImportSubcomponentsDialog — bulk-add sub-components to a BOM node from an .xlsx/.xls file.
 * Stages: upload (template + file picker) → preview (validated rows) → result (import progress/summary).
 */
import { useRef, useState } from 'react';
import type { Workbook, Worksheet } from 'exceljs';
import Papa from 'papaparse';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  FileSpreadsheet, Download, Upload, ChevronLeft, AlertCircle, CheckCircle2,
  Loader2, X, Sparkles,
} from 'lucide-react';
import {
  BOMNode, ApiPartResponse, ParsedImportRow,
  SUBCOMPONENT_IMPORT_COLUMNS, parseSubcomponentImportRows,
  checkColumnMappingConfidence, applyColumnMapping, validateLevels,
} from './bomData';
import { useOrgParts, useCreatePart } from '@/hooks/useParts';
import { useCreateBomNode, useMapImportColumns, useFixImportRow } from '@/hooks/useBom';
import { useAuth } from '@/modules/auth';

const MAX_IMPORT_ROWS = 200;
const CATEGORY_NOTE = 'top, power, control, charging, enclosure, hmi, safety, other — or any custom category';

interface ImportResult {
  row: ParsedImportRow;
  success: boolean;
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** If null/undefined, parts are imported as top-level BOM nodes (no parent). */
  parentNode?: BOMNode | null;
  projectId: string;
  orgId: string;
}

// Some spreadsheet exports (e.g. Altium BOM reports) prepend title/metadata
// rows before the real header row. Scan the first few rows for the one that
// best matches our known column aliases instead of assuming row 1 is it.
const HEADER_SCAN_ROWS = 25;
const KNOWN_HEADER_ALIASES = new Set(SUBCOMPONENT_IMPORT_COLUMNS.flatMap(c => c.aliases));

function findHeaderRowIndex(matrix: unknown[][]): number {
  let bestIndex = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(HEADER_SCAN_ROWS, matrix.length); i++) {
    const row = matrix[i] ?? [];
    const score = row.filter(cell => KNOWN_HEADER_ALIASES.has(String(cell ?? '').trim().toLowerCase())).length;
    if (score > bestScore) { bestScore = score; bestIndex = i; }
  }
  // Require at least 2 recognizable column names before trusting a row as the header;
  // otherwise fall back to row 0 (preserves prior behavior for already-clean files).
  return bestScore >= 2 ? bestIndex : 0;
}

function rowsFromMatrix(matrix: unknown[][]): { headers: string[]; rows: Record<string, unknown>[] } {
  const headerRowIndex = findHeaderRowIndex(matrix);
  const headerCells = matrix[headerRowIndex] ?? [];
  const headers = headerCells.map(c => String(c ?? '').trim()).filter(Boolean);

  const rows: Record<string, unknown>[] = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const rowCells = matrix[i] ?? [];
    const obj: Record<string, unknown> = {};
    rowCells.forEach((cell, colNumber) => {
      const header = String(headerCells[colNumber] ?? '').trim();
      if (header) obj[header] = cell;
    });
    const hasData = Object.values(obj).some(v => v != null && String(v).trim() !== '');
    if (hasData) rows.push(obj);
  }
  return { headers, rows };
}

function sheetToRows(sheet: Worksheet): { headers: string[]; rows: Record<string, unknown>[] } {
  const matrix: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => { cells[colNumber] = cell.value; });
    matrix[rowNumber - 1] = cells;
  });
  return rowsFromMatrix(matrix);
}

async function buildTemplateWorkbook(): Promise<Workbook> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();

  const sheet = workbook.addWorksheet('Sub-components');
  const headerRow = sheet.addRow(SUBCOMPONENT_IMPORT_COLUMNS.map(c => c.required ? `${c.label} *` : c.label));
  headerRow.font = { bold: true };
  // Highlight required columns in light yellow; Level column gets light blue (optional)
  headerRow.eachCell((cell, colNumber) => {
    const col = SUBCOMPONENT_IMPORT_COLUMNS[colNumber - 1];
    if (col?.required) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };
    } else if (col?.label === 'Level') {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F0FF' } };
    }
  });
  // Example rows: level 0 (top-level assembly) + level 1 (sub-component)
  sheet.addRow([
    '0', 'EV-CHG-001', 'EV Charging Assembly', 'Top-level EV charging assembly', 'power',
    'Acme Corp', 'ACM-0001', 'Digi-Key', '0', '0', '1', 'EA',
  ]);
  sheet.addRow([
    '1', 'EV-CONN-010', 'Charging Port Connector', 'IP67 waterproof charging port connector', 'power',
    'Acme Corp', 'ACM-1234', 'Digi-Key', '12.50', '4', '2', 'EA',
  ]);
  sheet.columns.forEach(col => { col.width = 22; });

  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRow(['Column', 'Required', 'Notes']);
  instructions.getRow(1).font = { bold: true };
  const notes: Record<string, string> = {
    'Level': 'Optional. 0 = top-level part, 1 = sub-component of the preceding 0-level row, 2 = sub-sub-component, etc. If omitted, all rows are treated as the same level.',
    'Part Number': 'Unique per organization. A matching part number attaches the existing part instead of creating a duplicate.',
    'Part Name': 'Short descriptive name for the part',
    'Description': 'Brief technical description of the part',
    'Category': `One of: ${CATEGORY_NOTE}`,
    'Manufacturer': 'e.g. Texas Instruments, Acme Corp',
    'MPN': 'Manufacturer part number, e.g. TI-A4B2C',
    'Supplier': 'Supplier / distributor name, e.g. Digi-Key, Mouser',
    'Unit Price': 'Numeric price per unit, e.g. 12.50',
    'Lead Time (weeks)': 'Numeric lead time in weeks, e.g. 4',
    'Quantity': 'Numeric, must be greater than 0',
    'UOM': 'Unit of measure: EA, SET, KG, M, FT, PCS, LOT',
  };
  SUBCOMPONENT_IMPORT_COLUMNS.forEach(c => {
    instructions.addRow([c.label, c.required ? 'Yes *' : 'No', notes[c.label] ?? '']);
  });
  instructions.columns.forEach(col => { col.width = 28; });

  return workbook;
}

async function downloadTemplate() {
  const workbook = await buildTemplateWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'subcomponent-import-template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

export function BOMImportSubcomponentsDialog({ open, onClose, parentNode, projectId, orgId }: Props) {
  const [stage, setStage] = useState<'upload' | 'preview' | 'result'>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);
  const [mappingInProgress, setMappingInProgress] = useState(false);
  const [mappingWarning, setMappingWarning] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fixingRows, setFixingRows] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: partsData } = useOrgParts(orgId, { limit: 100 });
  const existingParts: ApiPartResponse[] = partsData?.data ?? [];

  const createPart = useCreatePart(orgId);
  const createNode = useCreateBomNode(projectId);
  const mapImportColumns = useMapImportColumns();
  const fixImportRow = useFixImportRow();
  const { user } = useAuth();

  const reset = () => {
    setStage('upload'); setFileName(null); setFileError(null);
    setParsedRows([]); setProgress({ done: 0, total: 0 }); setResults([]);
    setMappingInProgress(false); setMappingWarning(null); setIsDragging(false);
    setFixingRows(new Set());
  };

  const handleAiFix = async (row: ParsedImportRow) => {
    setFixingRows(prev => new Set(prev).add(row.rowNumber));
    try {
      const { suggestions } = await fixImportRow.mutateAsync({
        partNumber:   row.partNumber,
        name:         row.name,
        description:  row.description,
        category:     row.category,
        manufacturer: row.manufacturer,
        mpn:          row.mpn,
        supplier:     row.supplier,
        unitPriceRaw: row.unitPrice !== undefined ? String(row.unitPrice) : '',
        leadTimeRaw:  row.leadTimeWeeks !== undefined ? String(row.leadTimeWeeks) : '',
        quantityRaw:  String(row.quantity),
        uom:          row.uom,
        errors:       row.errors,
      });
      setParsedRows(prev => prev.map(r => {
        if (r.rowNumber !== row.rowNumber) return r;
        const updated = { ...r };
        if (suggestions.name && !r.name)        { updated.name = suggestions.name; }
        if (suggestions.description && !r.description) { updated.description = suggestions.description; }
        if (suggestions.category && !r.category) { updated.category = suggestions.category as typeof r.category; }
        // Re-derive errors from the updated fields
        const newErrors = updated.errors.filter(e =>
          !(e === 'Missing Part Name'   && updated.name) &&
          !(e === 'Missing Description' && updated.description) &&
          !(e === 'Missing Category'    && updated.category),
        );
        updated.errors = newErrors;
        return updated;
      }));
    } catch {
      // error is silent; the row stays red so the user knows the fix didn't work
    } finally {
      setFixingRows(prev => { const next = new Set(prev); next.delete(row.rowNumber); return next; });
    }
  };

  const handleClose = () => { reset(); onClose(); };

  const handleDragOver = (e: React.DragEvent) => {
    if (mappingInProgress) return;
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (mappingInProgress) return;
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (mappingInProgress) return;
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    setFileName(file.name);
    try {
      let headers: string[] = [];
      let rawRows: Record<string, unknown>[] = [];

      const isCsv = file.name.toLowerCase().endsWith('.csv');

      if (isCsv) {
        const text = await file.text();
        const result = Papa.parse(text, { header: false, skipEmptyLines: true });
        if (result.errors.length > 0 && result.data.length === 0) {
          throw new Error('Failed to parse CSV file: ' + result.errors[0].message);
        }
        const parsed = rowsFromMatrix(result.data as unknown[][]);
        headers = parsed.headers;
        rawRows = parsed.rows;
      } else {
        const buffer = await file.arrayBuffer();
        const { Workbook } = await import('exceljs');
        const workbook = new Workbook();
        await workbook.xlsx.load(buffer as unknown as Buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet) throw new Error('No sheet found in this file.');
        const parsed = sheetToRows(sheet);
        headers = parsed.headers;
        rawRows = parsed.rows;
      }

      if (rawRows.length === 0) throw new Error('No data rows found below the header.');
      if (rawRows.length > MAX_IMPORT_ROWS) {
        throw new Error(`This file has ${rawRows.length} rows — imports are capped at ${MAX_IMPORT_ROWS} rows per file.`);
      }

      const { confident } = checkColumnMappingConfidence(headers);
      if (confident) {
        setParsedRows(parseSubcomponentImportRows(rawRows, existingParts));
        setStage('preview');
        return;
      }

      setMappingInProgress(true);
      try {
        const { mapping } = await mapImportColumns.mutateAsync({ headers, sampleRows: rawRows.slice(0, 3) });
        const remappedRows = applyColumnMapping(rawRows, mapping);
        setParsedRows(parseSubcomponentImportRows(remappedRows, existingParts));
        setMappingWarning(null);
        setStage('preview');
      } catch (mapErr) {
        const status = (mapErr as { response?: { status?: number } })?.response?.status;
        // 422 = AI confirmed this file is not BOM/parts data — block the import.
        if (status === 422 && mapErr instanceof Error && mapErr.message) {
          throw mapErr;
        }
        // All other errors (AI unavailable, network, etc.) — fall back to parsing
        // the rows directly with raw headers. Some fields may be unmapped and show
        // as errors in the preview; the user can fix them with the AI Fix button.
        setParsedRows(parseSubcomponentImportRows(rawRows, existingParts));
        setMappingWarning('Column auto-mapping was unavailable. Review the rows below and use "Fix with AI" on any that need corrections.');
        setStage('preview');
      } finally {
        setMappingInProgress(false);
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not read this file.');
      setFileName(null);
    }
  };

  const levelIssues = validateLevels(parsedRows);
  const validRows = parsedRows.filter(r => r.errors.length === 0 && !levelIssues.has(r.rowNumber));
  const isMultiLevel = parsedRows.some(r => r.level > 0);

  const handleImport = async () => {
    setStage('result');
    setProgress({ done: 0, total: validRows.length });
    const acc: ImportResult[] = [];

    // parentIdStack[N] holds the node id of the most-recently-created node at level N-1,
    // which becomes the parentId for the next node at level N.
    // Index 0 is pre-seeded with the dialog's parentNode so level-0 rows attach correctly.
    const parentIdStack: (string | undefined)[] = [parentNode?.id ?? undefined];

    for (const row of validRows) {
      try {
        const level = row.level ?? 0;
        const resolvedParentId = level === 0
          ? (parentNode?.id ?? undefined)
          : parentIdStack[level]; // holds the last-created (level-1) node id

        let partId = row.existingPart?.id;
        if (!partId) {
          const part = await createPart.mutateAsync({
            partNumber:          row.partNumber,
            name:                row.name || row.partNumber,
            description:         row.description,
            category:            row.category as ApiPartResponse['category'],
            manufacturer:        row.manufacturer || undefined,
            distributor:         row.supplier || undefined,
            mpn:                 row.mpn || undefined,
            unit:                row.uom,
            initialStatus:       row.status,
            initialPrice:        row.unitPrice !== undefined ? row.unitPrice : undefined,
            initialLeadTimeDays: row.leadTimeWeeks !== undefined && row.leadTimeWeeks > 0 ? row.leadTimeWeeks * 7 : undefined,
          });
          partId = part.id;
        }
        const node = await createNode.mutateAsync({
          partId, quantity: row.quantity, unit: row.uom,
          designators: row.designators || null,
          status: row.status,
          parentId: resolvedParentId ?? null,
          ownerId: user?.id,
        });

        // Register this node's id as the parent for the next deeper level.
        // Splice to clear any stale entries from a previously deeper branch.
        parentIdStack[level + 1] = node.id;
        parentIdStack.splice(level + 2);

        acc.push({ row, success: true });
      } catch (err) {
        acc.push({ row, success: false, error: err instanceof Error ? err.message : 'Import failed' });
      }
      setProgress(p => ({ ...p, done: p.done + 1 }));
      setResults([...acc]);
    }
  };

  const importing = stage === 'result' && progress.done < progress.total;
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[720px] p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Import Sub-components
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {parentNode
              ? <>Bulk-add sub-components to <span className="font-mono text-foreground">{parentNode.pn}</span> from a spreadsheet. Use the <span className="font-medium text-foreground">Level</span> column to import nested hierarchies.</>
              : 'Bulk-add parts to the BOM from a spreadsheet. Use the Level column (0, 1, 2…) to import a full multi-level hierarchy.'}
          </DialogDescription>
        </DialogHeader>

        {stage === 'upload' && (
          <div className="px-5 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <Download className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0 text-xs text-muted-foreground">
                Download a template with all required columns (marked <span className="font-semibold text-foreground">*</span>) and an example row.
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>Download template</Button>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => { if (!mappingInProgress) fileInputRef.current?.click(); }}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors',
                mappingInProgress ? 'cursor-not-allowed opacity-70 border-border bg-muted/20' :
                isDragging ? 'border-primary bg-primary/10' : 'border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/30 cursor-pointer',
              )}
              style={{ height: 160 }}
            >
              {mappingInProgress ? (
                <>
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                  <span className="text-sm text-foreground font-medium">Extracting column headers…</span>
                  <span className="text-[11px] text-muted-foreground">Mapping your columns to the required fields</span>
                </>
              ) : (
                <>
                  <Upload className="w-7 h-7 text-muted-foreground/50" />
                  <span className="text-sm text-foreground font-medium">Click to upload a spreadsheet</span>
                  <span className="text-[11px] text-muted-foreground">.xlsx, .xls, or .csv · up to {MAX_IMPORT_ROWS} rows</span>
                  {fileName && !fileError && <span className="text-[11px] text-primary mt-1">{fileName}</span>}
                </>
              )}
            </div>
            <input
              ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={mappingInProgress}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            {fileError && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{fileError}</span>
              </div>
            )}
          </div>
        )}

        {stage === 'preview' && (
          <>
            <div className="px-5 pt-3 pb-2 shrink-0 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{validRows.length} valid</span>
                {parsedRows.length - validRows.length > 0 && (
                  <> · {parsedRows.length - validRows.length} will be skipped</>
                )}
              </span>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setStage('upload'); setFileName(null); setMappingWarning(null); }}>
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </Button>
            </div>
            {mappingWarning && (
              <div className="mx-5 mb-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 shrink-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>{mappingWarning}</span>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 pb-3 min-h-0">
              <div className="space-y-1">
                {parsedRows.map(row => {
                  const levelError = levelIssues.get(row.rowNumber);
                  const isValid = row.errors.length === 0 && !levelError;
                  const allErrors = levelError ? [...row.errors, levelError] : row.errors;
                  return (
                    <div key={row.rowNumber}
                      style={isMultiLevel ? { paddingLeft: `${12 + row.level * 16}px` } : undefined}
                      className={cn(
                        'flex items-start gap-2.5 pr-3 py-2 rounded-lg border text-xs',
                        isMultiLevel ? '' : 'px-3',
                        isValid ? 'border-border' : 'border-destructive/30 bg-destructive/5 opacity-70',
                      )}
                    >
                      {isValid
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        : <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isMultiLevel && row.level > 0 && (
                            <span className="text-muted-foreground/50 shrink-0">{'↳'}</span>
                          )}
                          <span className="font-mono font-medium text-foreground">{row.partNumber || `Row ${row.rowNumber}`}</span>
                          <span className="text-muted-foreground truncate">{row.name || row.description}</span>
                          {row.designators && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono truncate max-w-[180px]" title={row.designators}>
                              {row.designators} · qty {row.quantity}
                            </span>
                          )}
                          {row.existingPart && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              Existing part — will attach, not duplicate
                            </span>
                          )}
                        </div>
                        {!isValid && (
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-destructive">{allErrors.join(' · ')}</span>
                            {row.errors.some(e => ['Missing Part Name', 'Missing Description', 'Missing Category'].includes(e)) && (
                              <button
                                onClick={() => handleAiFix(row)}
                                disabled={fixingRows.has(row.rowNumber)}
                                className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {fixingRows.has(row.rowNumber)
                                  ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Fixing…</>
                                  : <><Sparkles className="w-2.5 h-2.5" /> Fix with AI</>}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-muted-foreground shrink-0">Row {row.rowNumber}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-border flex items-center justify-end gap-2 bg-card shrink-0">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button disabled={validRows.length === 0} onClick={handleImport}>
                Import {validRows.length} {validRows.length === 1 ? 'Part' : 'Parts'}
              </Button>
            </div>
          </>
        )}

        {stage === 'result' && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 flex flex-col gap-3">
              {importing ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  Importing {progress.done} of {progress.total}…
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {failureCount === 0
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <AlertCircle className="w-4 h-4 text-amber-500" />}
                  {successCount} imported{failureCount > 0 && ` · ${failureCount} failed`}
                </div>
              )}
              <div className="space-y-1">
                {results.map(r => (
                  <div key={r.row.rowNumber}
                    style={isMultiLevel ? { paddingLeft: `${12 + r.row.level * 16}px` } : undefined}
                    className={cn(
                      'flex items-center gap-2.5 py-2 rounded-lg border text-xs',
                      isMultiLevel ? 'pr-3' : 'px-3',
                      r.success ? 'border-border' : 'border-destructive/30 bg-destructive/5',
                    )}
                  >
                    {r.success
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : <X className="w-3.5 h-3.5 text-destructive shrink-0" />}
                    {isMultiLevel && r.row.level > 0 && (
                      <span className="text-muted-foreground/50 shrink-0">↳</span>
                    )}
                    <span className="font-mono font-medium text-foreground">{r.row.partNumber}</span>
                    <span className="text-muted-foreground truncate flex-1">{r.row.name || r.row.description}</span>
                    {r.error && <span className="text-destructive shrink-0">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-border flex items-center justify-end bg-card shrink-0">
              <Button disabled={importing} onClick={handleClose}>Close</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
