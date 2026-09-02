import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelect } from '@/components/ui/multi-select';
import { useProjectMembers } from '@/hooks/useProjectTeam';
import { useProjectDetail, useProjectModules } from '@/hooks/useProjectDetail';
import type { ProposalFormState } from '../assistantData';
import { BomFieldEditor } from './AssistantProposalBomFields';
import { BOM_FIELD_KEYS, BOM_FIELD_ORDER, BOM_FIELD_LABELS } from '../bomProposalFields';
import { EcoFieldEditor } from './AssistantProposalEcoFields';
import { ECO_FIELD_KEYS, ECO_FIELD_ORDER, ECO_FIELD_LABELS } from '../ecoProposalFields';

const TASK_STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];
const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'trivial', label: 'Trivial' },
];
const ISSUE_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'wont-fix', label: "Won't Fix" },
];
const ISSUE_CATEGORY_OPTIONS = [
  { value: 'defect', label: 'Defect' },
  { value: 'risk', label: 'Risk' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'test-failure', label: 'Test Failure' },
  { value: 'design-change', label: 'Design Change' },
  { value: 'other', label: 'Other' },
];
const MODULE_TYPE_OPTIONS = [
  'hardware', 'software', 'firmware', 'testing', 'design', 'procurement',
  'manufacturing', 'qa', 'logistics', 'enclosure', 'pcb', 'power',
].map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));
const MILESTONE_STATUS_OPTIONS = [
  { value: '__automatic__', label: 'Automatic' },
  { value: 'on-track', label: 'On Track' },
  { value: 'at-risk', label: 'At Risk' },
  { value: 'blocked', label: 'Blocked' },
];

interface FieldEditorProps {
  entityType: string;
  projectId: string | null;
  fieldKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** Renders the right control for one field key, shared by the full single-item form and the bulk-shared one-field editor — a field always looks and behaves the same way in both places. */
function FieldEditor({ entityType, projectId, fieldKey, value, onChange }: FieldEditorProps) {
  const membersQuery = useProjectMembers(projectId ?? undefined);
  const projectDetailQuery = useProjectDetail(projectId ?? undefined);
  const modulesQuery = useProjectModules(projectId ?? undefined);

  const memberOptions = (membersQuery.data ?? []).map((m) => ({ value: m.id, label: m.name }));
  const milestoneOptions = (projectDetailQuery.data?.milestones ?? []).map((m) => ({ value: m.id, label: m.title }));
  const moduleOptions = (modulesQuery.data ?? []).map((m) => ({ value: m.id, label: m.name }));

  // A BOM proposal's form is the whole "Add New Part" form, so most of its
  // keys need controls nothing else uses (a UOM picker, a supplier table, a
  // requirement-id chip list). The handful it shares — name, description,
  // owner — deliberately fall through to the editors below.
  if (entityType === 'bom_node' && BOM_FIELD_KEYS.has(fieldKey)) {
    return <BomFieldEditor projectId={projectId} fieldKey={fieldKey} value={value} onChange={onChange} />;
  }

  // An ECO proposal's form is the whole 5-tab wizard — most of its keys need
  // ECO-specific controls (a change-class picker, the effectivity type, the
  // affected-parts / diff-rows / pipeline tables). title/description fall
  // through; targetDate/ownerId reuse the shared editors below.
  if (entityType === 'eco' && ECO_FIELD_KEYS.has(fieldKey)) {
    return <EcoFieldEditor projectId={projectId} fieldKey={fieldKey} value={value} onChange={onChange} />;
  }

  switch (fieldKey) {
    case 'title':
    case 'name':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Title" />;
    case 'description':
      return <Textarea value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Description (optional)" rows={3} />;
    case 'assigneeIds': {
      const selected = (value as string[] | null) ?? [];
      return (
        <MultiSelect
          options={memberOptions}
          selected={selected}
          onChange={(values) => onChange(values)}
          placeholder="Unassigned"
        />
      );
    }
    case 'ownerId':
      return (
        <Select value={(value as string | null) ?? '__none__'} onValueChange={(v) => onChange(v === '__none__' ? null : v)}>
          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Unassigned</SelectItem>
            {memberOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case 'milestoneId':
      return (
        <Select value={(value as string | null) ?? '__none__'} onValueChange={(v) => onChange(v === '__none__' ? null : v)}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {milestoneOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case 'moduleId':
      return (
        <Select value={(value as string | null) ?? '__none__'} onValueChange={(v) => onChange(v === '__none__' ? null : v)}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {moduleOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    // Task's bulk-shared DTO key is the array form (moduleIds), since a task
    // can in principle link several modules — the propose tool only ever
    // sets one, so this renders the same single-module picker and converts
    // at the boundary.
    case 'moduleIds': {
      const current = (value as string[] | undefined)?.[0] ?? '__none__';
      return (
        <Select value={current} onValueChange={(v) => onChange(v === '__none__' ? [] : [v])}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {moduleOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    case 'status': {
      // Hardware modules have no fixed status enum backend-side — free text.
      if (entityType === 'hardware_module') {
        return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Status" />;
      }
      const options = entityType === 'issue' ? ISSUE_STATUS_OPTIONS : entityType === 'milestone' ? MILESTONE_STATUS_OPTIONS : TASK_STATUS_OPTIONS;
      const current = entityType === 'milestone' ? ((value as string | null) ?? '__automatic__') : ((value as string) ?? options[0].value);
      return (
        <Select value={current} onValueChange={(v) => onChange(entityType === 'milestone' && v === '__automatic__' ? null : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    case 'priority':
    case 'severity':
      return (
        <Select value={(value as string) ?? 'minor'} onValueChange={onChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case 'category':
      return (
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
          <SelectContent>
            {ISSUE_CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case 'type':
      return (
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
          <SelectContent>
            {MODULE_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case 'startDate':
    case 'dueDate':
    case 'targetDate':
      return <Input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
    case 'completed':
      return (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />
          Mark this milestone as complete
        </label>
      );
    default:
      return <Input value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

const FIELD_ORDER = [
  'title', 'name', 'description', 'category', 'type', 'assigneeIds', 'ownerId',
  'milestoneId', 'moduleId', 'status', 'completed', 'severity', 'priority', 'startDate', 'targetDate', 'dueDate',
];
const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  name: 'Name',
  description: 'Description',
  category: 'Category',
  type: 'Type',
  assigneeIds: 'Assignee',
  ownerId: 'Owner',
  milestoneId: 'Milestone',
  moduleId: 'Module',
  status: 'Status',
  completed: 'Completion',
  severity: 'Severity',
  priority: 'Priority',
  startDate: 'Start date',
  targetDate: 'Target date',
  dueDate: 'Due date',
};

interface AssistantProposalFormProps {
  entityType: string;
  /** Null for a personal (no-project) task — its form never includes an assignee/milestone/module field, so the project-scoped pickers below are simply never rendered for it. */
  projectId: string | null;
  formState: ProposalFormState;
  onSubmit: (edits: Record<string, unknown>) => Promise<unknown>;
  onCancel: () => void;
}

export function AssistantProposalForm({ entityType, projectId, formState, onSubmit, onCancel }: AssistantProposalFormProps) {
  const rawInitial = formState.mode === 'single' ? (formState.fields ?? {}) : { [formState.sharedFields?.[0]?.field ?? '']: formState.sharedFields?.[0]?.value };
  // Milestones default to "Automatic" (null → computed from tasks) when the model doesn't propose
  // a status, which reads as a fake status option to the user — default the form to On Track instead.
  // Skip that when the proposal is about completion (a 'completed' field is present): pinning an
  // unrelated status override onto a "mark complete" request would be a surprise side effect.
  const initial = entityType === 'milestone' && 'status' in rawInitial && !('completed' in rawInitial)
    && (rawInitial.status === null || rawInitial.status === undefined)
    ? { ...rawInitial, status: 'on-track' }
    : rawInitial;
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (key: string, value: unknown) => setValues((prev) => ({ ...prev, [key]: value }));
  const labelFor = (key: string) =>
    (entityType === 'bom_node' ? BOM_FIELD_LABELS[key] : entityType === 'eco' ? ECO_FIELD_LABELS[key] : undefined) ?? FIELD_LABELS[key] ?? key;

  const requiredMissing = formState.mode === 'single'
    ? formState.required.filter((key) => {
        const v = values[key];
        return v === undefined || v === null || (typeof v === 'string' && v.trim().length === 0);
      })
    : [];

  const handleSubmit = async () => {
    if (requiredMissing.length > 0) {
      setError(`${requiredMissing.map(labelFor).join(', ')} ${requiredMissing.length === 1 ? 'is' : 'are'} required.`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (formState.mode === 'single') {
        await onSubmit(values);
      } else {
        const field = formState.sharedFields?.[0]?.field ?? '';
        await onSubmit({ field, value: values[field] });
      }
    } catch {
      // The mutation's own onError already surfaced a toast — form stays open so the user can fix and retry.
    } finally {
      setSubmitting(false);
    }
  };

  // A BOM form follows the part form's own tab order (details → sourcing →
  // traceability → documents), which shares only a few keys with the
  // task/issue/milestone/module order.
  const order = entityType === 'bom_node' ? BOM_FIELD_ORDER : entityType === 'eco' ? ECO_FIELD_ORDER : FIELD_ORDER;
  const fieldKeys = formState.mode === 'single'
    ? order.filter((key) => key in (formState.fields ?? {}))
    : [formState.sharedFields?.[0]?.field ?? ''];

  return (
    <div className="space-y-3">
      {fieldKeys.map((key) => (
        <div key={key} className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            {formState.mode === 'bulk-shared' ? (formState.sharedFields?.[0]?.label ?? key) : labelFor(key)}
            {formState.required.includes(key) && <span className="text-destructive"> *</span>}
          </Label>
          <FieldEditor entityType={entityType} projectId={projectId} fieldKey={key} value={values[key]} onChange={(v) => setField(key, v)} />
        </div>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Submit'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
