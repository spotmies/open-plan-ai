import { useState } from 'react';
import { Paperclip, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBomTree } from '@/hooks/useBom';
import { KNOWN_BOM_CATEGORIES, UOM_OPTIONS, getCategoryMeta, type ApiNodeResponse } from '@/features/projects/components/bomData';

const BOM_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
];

const OTHER_CATEGORY = '__other__';

interface BomFieldEditorProps {
  projectId: string | null;
  fieldKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

function toNumberOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function NumberField({ value, onChange, placeholder, step }: { value: unknown; onChange: (v: unknown) => void; placeholder?: string; step?: string }) {
  return (
    <Input
      type="number"
      step={step}
      min="0"
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(toNumberOrNull(e.target.value))}
      placeholder={placeholder}
    />
  );
}

function CategoryField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const current = (value as string) ?? '';
  const isKnown = (KNOWN_BOM_CATEGORIES as readonly string[]).includes(current);
  // A category outside the preset list is a real, supported value ("Other" in
  // the part form) — keep the free-text box open on it rather than snapping
  // the selection back to a preset the user never chose.
  const [custom, setCustom] = useState(!isKnown && current.length > 0);

  if (custom) {
    return (
      <div className="flex items-center gap-2">
        <Input value={current} onChange={(e) => onChange(e.target.value)} placeholder="Custom category" />
        <Button type="button" variant="ghost" size="sm" onClick={() => { setCustom(false); onChange(''); }}>
          Presets
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={current || undefined}
      onValueChange={(v) => {
        if (v === OTHER_CATEGORY) {
          setCustom(true);
          onChange('');
          return;
        }
        onChange(v);
      }}
    >
      <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
      <SelectContent>
        {KNOWN_BOM_CATEGORIES.map((c) => (
          <SelectItem key={c} value={c}>{getCategoryMeta(c).label}</SelectItem>
        ))}
        <SelectItem value={OTHER_CATEGORY}>Other…</SelectItem>
      </SelectContent>
    </Select>
  );
}

function flattenTree(nodes: ApiNodeResponse[], depth = 0, out: Array<{ id: string; label: string }> = []): Array<{ id: string; label: string }> {
  for (const n of nodes) {
    out.push({ id: n.id, label: `${'— '.repeat(depth)}${n.part?.partNumber ?? n.part?.name ?? 'Unnamed part'}` });
    if (n.children?.length) flattenTree(n.children, depth + 1, out);
  }
  return out;
}

function ParentField({ projectId, value, onChange }: { projectId: string | null; value: unknown; onChange: (v: unknown) => void }) {
  const treeQuery = useBomTree(projectId ?? undefined);
  const options = flattenTree(treeQuery.data?.roots ?? []);
  return (
    <Select value={(value as string | null) ?? '__root__'} onValueChange={(v) => onChange(v === '__root__' ? null : v)}>
      <SelectTrigger><SelectValue placeholder="Top level" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__root__">Top level (no parent)</SelectItem>
        {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function RequirementsField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const ids = (value as string[]) ?? [];
  const [draft, setDraft] = useState('');
  const add = () => {
    const next = draft.trim();
    if (!next || ids.includes(next)) return;
    onChange([...ids, next]);
    setDraft('');
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="e.g. SYS-001"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      {ids.length === 0 ? (
        <p className="text-xs text-muted-foreground">No requirements linked.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-xs">
              {id}
              <button type="button" aria-label={`Remove ${id}`} onClick={() => onChange(ids.filter((r) => r !== id))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Shared shell for the three repeatable two-column editors (suppliers, additional fields, documents). */
function RowsField<T extends Record<string, unknown>>({
  rows,
  onChange,
  blank,
  addLabel,
  emptyLabel,
  render,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  blank: T;
  addLabel: string;
  emptyLabel: string;
  render: (row: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {rows.length === 0 && <p className="text-xs text-muted-foreground">{emptyLabel}</p>}
      {rows.map((row, i) => (
        // Index is the only stable identity these rows have — they are
        // positional, unsaved, and freely editable, so there is no id to key on.
        <div key={i} className="flex items-center gap-2">
          {render(row, (patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))))}
          <button type="button" aria-label="Remove row" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { ...blank }])}>
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}

type SupplierRow = { distributor: string; price: number | null; calcFromSubparts?: boolean };
type CustomFieldRow = { label: string; value: string };
type DocumentRow = {
  url?: string;
  fileName?: string;
  // Present when the entry is a file the user already attached in the
  // conversation — there is no URL to edit, and fileKey must survive the
  // round trip or the real file is lost on save.
  fileKey?: string;
  fileUrl?: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

/**
 * Renders the right control for one BOM-specific field key. Returns null for a
 * key this module doesn't own, so the caller falls through to the shared
 * editors — see BOM_FIELD_KEYS in ../bomProposalFields.
 */
export function BomFieldEditor({ projectId, fieldKey, value, onChange }: BomFieldEditorProps) {
  switch (fieldKey) {
    case 'partNumber':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="e.g. EV-PWR-021" />;
    case 'manufacturer':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Texas Instruments" />;
    case 'mpn':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="e.g. TI-A4B2C" />;
    case 'distributor':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Digi-Key" />;
    case 'revision':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder='Starting revision (typically "A")' />;
    case 'designators':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="e.g. C3, C4, C11" />;
    case 'notes':
      return <Textarea value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} rows={2} placeholder="Internal note on this line (optional)" />;
    case 'changeNotes':
      return <Textarea value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} rows={2} placeholder="What changed in this revision" />;
    case 'quantity':
      return <NumberField value={value} onChange={onChange} placeholder="1" />;
    case 'price':
      return <NumberField value={value} onChange={onChange} placeholder="0.00" step="0.01" />;
    case 'leadTimeDays':
      return <NumberField value={value} onChange={onChange} placeholder="Days" />;
    case 'category':
      return <CategoryField value={value} onChange={onChange} />;
    case 'parentId':
      return <ParentField projectId={projectId} value={value} onChange={onChange} />;
    case 'requirements':
      return <RequirementsField value={value} onChange={onChange} />;
    case 'unit':
      return (
        <Select value={(value as string) || 'EA'} onValueChange={onChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {UOM_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case 'status':
      return (
        <Select value={(value as string) || 'draft'} onValueChange={onChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {BOM_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case 'suppliers': {
      const rows = ((value as SupplierRow[]) ?? []).map((r) => ({ ...r }));
      return (
        <RowsField<SupplierRow>
          rows={rows}
          onChange={onChange}
          blank={{ distributor: '', price: null, calcFromSubparts: false }}
          addLabel="Add supplier"
          emptyLabel="No suppliers on this part."
          render={(row, update) => (
            <>
              <Input className="flex-1" value={row.distributor ?? ''} onChange={(e) => update({ distributor: e.target.value })} placeholder="Supplier / distributor" />
              <Input
                className="w-28"
                type="number"
                step="0.01"
                min="0"
                value={row.price === null || row.price === undefined ? '' : String(row.price)}
                onChange={(e) => update({ price: toNumberOrNull(e.target.value) })}
                placeholder="Unit price"
              />
            </>
          )}
        />
      );
    }
    case 'customFields': {
      const rows = ((value as CustomFieldRow[]) ?? []).map((r) => ({ ...r }));
      return (
        <RowsField<CustomFieldRow>
          rows={rows}
          onChange={onChange}
          blank={{ label: '', value: '' }}
          addLabel="Add field"
          emptyLabel="No additional fields. (A supplier part number belongs here.)"
          render={(row, update) => (
            <>
              <Input className="flex-1" value={row.label ?? ''} onChange={(e) => update({ label: e.target.value })} placeholder="Label" />
              <Input className="flex-1" value={row.value ?? ''} onChange={(e) => update({ value: e.target.value })} placeholder="Value" />
            </>
          )}
        />
      );
    }
    case 'documents': {
      const rows = ((value as DocumentRow[]) ?? []).map((r) => ({ ...r }));
      return (
        <RowsField<DocumentRow>
          rows={rows}
          onChange={onChange}
          blank={{ url: '', fileName: '' }}
          addLabel="Link a document"
          emptyLabel="No documents to attach. Files are linked by URL here — upload one from the part's Documents tab instead."
          render={(row, update) =>
            row.fileKey ? (
              // An attached file is a real stored object, not an address —
              // show what it is rather than an empty URL box.
              <>
                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-md border border-border/60 px-2 py-1.5 text-xs text-muted-foreground">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{row.fileName || 'Attached file'}</span>
                </span>
                <Input className="w-40" value={row.fileName ?? ''} onChange={(e) => update({ fileName: e.target.value })} placeholder="Display name" />
              </>
            ) : (
              <>
                <Input className="flex-1" value={row.url ?? ''} onChange={(e) => update({ url: e.target.value })} placeholder="https://…" />
                <Input className="w-40" value={row.fileName ?? ''} onChange={(e) => update({ fileName: e.target.value })} placeholder="Display name" />
              </>
            )
          }
        />
      );
    }
    default:
      return null;
  }
}
