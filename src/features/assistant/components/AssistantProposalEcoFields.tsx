import { Paperclip, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { useBomTree } from '@/hooks/useBom';
import { useProjectMembers } from '@/hooks/useProjectTeam';
import { useProjectModules } from '@/hooks/useProjectDetail';
import {
  ECO_TYPE_LABEL,
  REASON_LABEL,
  PRIORITY_LABEL,
  CHANGE_CLASS_LABEL,
  EFFECTIVITY_LABEL,
  IMPACT_LABEL,
  DISPOSITION_LABEL,
  CHANGE_LABEL_MAP,
  IMPACT_AREA_OPTIONS,
  IMPACT_AREA_LABEL,
} from '@/features/projects/components/ecoData';
import type { ApiNodeResponse } from '@/features/projects/components/bomData';

// Backend enum values are lowercase; ecoData.ts's label maps are keyed UPPERCASE
// (the frontend's own convention). Build lowercase-value option lists here.
type Opt = { value: string; label: string };
const lowerOpts = (map: Record<string, string>): Opt[] =>
  Object.entries(map).map(([k, v]) => ({ value: k.toLowerCase(), label: v }));

const TYPE_OPTIONS = lowerOpts(ECO_TYPE_LABEL);
const REASON_OPTIONS = lowerOpts(REASON_LABEL);
const PRIORITY_OPTIONS = lowerOpts(PRIORITY_LABEL);
const CHANGE_CLASS_OPTIONS: Opt[] = Object.entries(CHANGE_CLASS_LABEL).map(([k, v]) => ({ value: k, label: v }));
const EFFECTIVITY_OPTIONS = lowerOpts(EFFECTIVITY_LABEL);
const IMPACT_OPTIONS = lowerOpts(IMPACT_LABEL);
const DISPOSITION_OPTIONS = lowerOpts(DISPOSITION_LABEL);
const CHANGE_LABEL_OPTIONS = lowerOpts(CHANGE_LABEL_MAP);
const IMPACT_AREA_OPTS: Opt[] = IMPACT_AREA_OPTIONS.map((v) => ({ value: v, label: IMPACT_AREA_LABEL[v] }));

interface EcoFieldEditorProps {
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
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(toNumberOrNull(e.target.value))}
      placeholder={placeholder}
    />
  );
}

function SelectField({ value, onChange, options, placeholder }: { value: unknown; onChange: (v: unknown) => void; options: Opt[]; placeholder?: string }) {
  return (
    <Select value={(value as string) || undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder ?? 'Select…'} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function CheckboxField({ value, onChange, label }: { value: unknown; onChange: (v: unknown) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <Checkbox checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />
      {label}
    </label>
  );
}

/** Shared shell for the repeatable two-column editors (affected parts, diff rows, pipeline stages). */
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
        // Positional, unsaved rows — index is the only stable identity.
        <div key={i} className="flex items-start gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {render(row, (patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))))}
          </div>
          <button
            type="button"
            aria-label="Remove row"
            className="mt-1.5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
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

function flattenBom(nodes: ApiNodeResponse[], out: Array<{ partNumber: string; name: string }> = []): Array<{ partNumber: string; name: string }> {
  for (const n of nodes) {
    const pn = n.part?.partNumber ?? n.part?.name ?? 'Unnamed part';
    out.push({ partNumber: pn, name: n.part?.name ?? '' });
    if (n.children?.length) flattenBom(n.children, out);
  }
  return out;
}

type PartRow = { partNumber: string; name?: string; disposition: string; impactLevel: string; revFrom?: string; revTo?: string; qty?: number | null; notes?: string };
type DiffRow = { parameter: string; fromValue?: string; toValue?: string; changeLabel: string };
type StageRow = { stage: string; approverId?: string | null; approverName?: string; isOptional: boolean; justification?: string };
type AttachmentRow = { url?: string; fileName?: string; fileKey?: string; fileUrl?: string; mimeType?: string | null; fileSize?: number | null };

function PartsField({ projectId, value, onChange }: { projectId: string | null; value: unknown; onChange: (v: unknown) => void }) {
  const treeQuery = useBomTree(projectId ?? undefined);
  const bomParts = flattenBom(treeQuery.data?.roots ?? []);
  const rows = ((value as PartRow[]) ?? []).map((r) => ({ ...r }));
  return (
    <RowsField<PartRow>
      rows={rows}
      onChange={onChange}
      blank={{ partNumber: '', disposition: 'rework', impactLevel: 'medium', revFrom: '', revTo: '' }}
      addLabel="Add affected part"
      emptyLabel="No affected parts on this ECO."
      render={(row, update) => (
        <>
          <Select value={row.partNumber || undefined} onValueChange={(v) => update({ partNumber: v })}>
            <SelectTrigger className="w-44"><SelectValue placeholder="BOM part" /></SelectTrigger>
            <SelectContent>
              {bomParts.length === 0 && <SelectItem value="__none__" disabled>No BOM parts in this project</SelectItem>}
              {bomParts.map((p) => (
                <SelectItem key={p.partNumber} value={p.partNumber}>{p.partNumber}{p.name ? ` — ${p.name}` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={row.disposition} onValueChange={(v) => update({ disposition: v })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DISPOSITION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={row.impactLevel} onValueChange={(v) => update({ impactLevel: v })}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {IMPACT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="w-20" value={row.revFrom ?? ''} onChange={(e) => update({ revFrom: e.target.value })} placeholder="Rev A" />
          <Input className="w-20" value={row.revTo ?? ''} onChange={(e) => update({ revTo: e.target.value })} placeholder="Rev B" />
        </>
      )}
    />
  );
}

function DiffRowsField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const rows = ((value as DiffRow[]) ?? []).map((r) => ({ ...r }));
  return (
    <RowsField<DiffRow>
      rows={rows}
      onChange={onChange}
      blank={{ parameter: '', fromValue: '', toValue: '', changeLabel: 'modified' }}
      addLabel="Add row"
      emptyLabel="No field-level diff rows."
      render={(row, update) => (
        <>
          <Input className="w-40" value={row.parameter} onChange={(e) => update({ parameter: e.target.value })} placeholder="Parameter" />
          <Input className="w-28" value={row.fromValue ?? ''} onChange={(e) => update({ fromValue: e.target.value })} placeholder="From" />
          <Input className="w-28" value={row.toValue ?? ''} onChange={(e) => update({ toValue: e.target.value })} placeholder="To" />
          <Select value={row.changeLabel} onValueChange={(v) => update({ changeLabel: v })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CHANGE_LABEL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      )}
    />
  );
}

function PipelineField({ projectId, value, onChange }: { projectId: string | null; value: unknown; onChange: (v: unknown) => void }) {
  const membersQuery = useProjectMembers(projectId ?? undefined);
  const members = (membersQuery.data ?? []).map((m) => ({ value: m.id, label: m.name }));
  const rows = ((value as StageRow[]) ?? []).map((r) => ({ ...r }));
  return (
    <RowsField<StageRow>
      rows={rows}
      onChange={onChange}
      blank={{ stage: '', approverId: null, isOptional: false }}
      addLabel="Add stage"
      emptyLabel="No approval stages defined yet."
      render={(row, update) => (
        <>
          <Input className="w-40" value={row.stage} onChange={(e) => update({ stage: e.target.value })} placeholder="Stage name" />
          <Select
            value={(row.approverId as string | null) ?? '__none__'}
            onValueChange={(v) => update({ approverId: v === '__none__' ? null : v, approverName: members.find((m) => m.value === v)?.label })}
          >
            <SelectTrigger className="w-40"><SelectValue placeholder="Approver" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {members.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <Checkbox checked={row.isOptional === true} onCheckedChange={(c) => update({ isOptional: c === true })} />
            Optional
          </label>
          {row.isOptional && (
            <Input className="w-full" value={row.justification ?? ''} onChange={(e) => update({ justification: e.target.value })} placeholder="Why is this stage optional?" />
          )}
        </>
      )}
    />
  );
}

function AttachmentsField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const rows = ((value as AttachmentRow[]) ?? []).map((r) => ({ ...r }));
  return (
    <RowsField<AttachmentRow>
      rows={rows}
      onChange={onChange}
      blank={{ url: '', fileName: '' }}
      addLabel="Link a document"
      emptyLabel="No attachments. Link one by URL here, or ask the assistant to attach a file you sent in this conversation."
      render={(row, update) =>
        row.fileKey ? (
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

function ModulesField({ projectId, value, onChange }: { projectId: string | null; value: unknown; onChange: (v: unknown) => void }) {
  const modulesQuery = useProjectModules(projectId ?? undefined);
  const options = (modulesQuery.data ?? []).map((m) => ({ value: m.id, label: m.name }));
  return (
    <MultiSelect
      options={options}
      selected={(value as string[]) ?? []}
      onChange={(values) => onChange(values)}
      placeholder="No modules affected"
    />
  );
}

/**
 * Renders the right control for one ECO-specific field key. Returns null for a
 * key this module doesn't own, so the caller falls through to the shared
 * editors — see ECO_FIELD_KEYS in ../ecoProposalFields.
 */
export function EcoFieldEditor({ projectId, fieldKey, value, onChange }: EcoFieldEditorProps) {
  switch (fieldKey) {
    case 'type':
      return <SelectField value={value} onChange={onChange} options={TYPE_OPTIONS} placeholder="Select a change type" />;
    case 'reason':
      return <SelectField value={value} onChange={onChange} options={REASON_OPTIONS} placeholder="Select a reason code" />;
    case 'priority':
      return <SelectField value={value} onChange={onChange} options={PRIORITY_OPTIONS} />;
    case 'changeClass':
      return <SelectField value={value} onChange={onChange} options={CHANGE_CLASS_OPTIONS} />;
    case 'effectivityType':
      return <SelectField value={value} onChange={onChange} options={EFFECTIVITY_OPTIONS} />;
    case 'scheduleImpact':
      return <SelectField value={value} onChange={onChange} options={IMPACT_OPTIONS} placeholder="Not set" />;
    case 'impactArea':
      return <SelectField value={value} onChange={onChange} options={IMPACT_AREA_OPTS} placeholder="Not set" />;
    case 'typeOther':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Describe the change type" />;
    case 'reasonOther':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Describe the reason" />;
    case 'originatingEcr':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="e.g. ECR-2026-088" />;
    case 'effectivityValue':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="A date, or the S/N / lot it cuts in at" />;
    case 'revFrom':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="e.g. A" />;
    case 'revTo':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="e.g. B" />;
    case 'certNotes':
      return <Textarea rows={2} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Certification type or firmware dependency" />;
    case 'unitCostDelta':
      return <NumberField value={value} onChange={onChange} step="0.01" placeholder="e.g. -4.55" />;
    case 'oneTimeCost':
      return <NumberField value={value} onChange={onChange} step="0.01" placeholder="e.g. 12400" />;
    case 'requiresRecertification':
      return <CheckboxField value={value} onChange={onChange} label="CE / UL / ISO re-test needed" />;
    case 'firmwareCoupling':
      return <CheckboxField value={value} onChange={onChange} label="Software / firmware dependency exists" />;
    case 'affectedModules':
      return <ModulesField projectId={projectId} value={value} onChange={onChange} />;
    case 'parts':
      return <PartsField projectId={projectId} value={value} onChange={onChange} />;
    case 'diffRows':
      return <DiffRowsField value={value} onChange={onChange} />;
    case 'attachments':
      return <AttachmentsField value={value} onChange={onChange} />;
    case 'pipelineSteps':
      return <PipelineField projectId={projectId} value={value} onChange={onChange} />;
    default:
      return null;
  }
}
