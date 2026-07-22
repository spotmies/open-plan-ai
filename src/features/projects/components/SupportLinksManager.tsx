import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { config } from '@/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectMembers } from '@/hooks/useProjectTeam';
import { useIssueColumns } from '@/hooks/useIssueColumns';
import { DEFAULT_ISSUE_COLUMNS } from '@/services/issueColumns.service';
import {
  useSupportLinks,
  useCreateSupportLink,
  useUpdateSupportLink,
  useDeleteSupportLink,
  useRegenerateSupportLinkToken,
} from '@/hooks/useSupportLinks';
import type {
  AutoAssignStrategy,
  IssueCategory,
  IssueSeverity,
  CreateSupportLinkInput,
  SupportLink,
} from '@/services/supportLinks.service';

interface FormState {
  name: string;
  defaultColumnKey: string;
  defaultCategory: IssueCategory;
  defaultSeverity: IssueSeverity;
  autoAssignStrategy: AutoAssignStrategy;
  autoAssignUserIds: string[];
  notifyUserIds: string[];
  notifyEmails: string;
  requireEmail: boolean;
  requirePhone: boolean;
}

const CATEGORY_OPTIONS: { value: IssueCategory; label: string }[] = [
  { value: 'defect', label: 'Defect' },
  { value: 'risk', label: 'Risk' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'test-failure', label: 'Test Failure' },
  { value: 'design-change', label: 'Design Change' },
  { value: 'other', label: 'Other' },
];

const SEVERITY_OPTIONS: { value: IssueSeverity; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'trivial', label: 'Trivial' },
];

const emptyForm: FormState = {
  name: '',
  defaultColumnKey: 'open',
  defaultCategory: 'defect',
  defaultSeverity: 'minor',
  autoAssignStrategy: 'none',
  autoAssignUserIds: [],
  notifyUserIds: [],
  notifyEmails: '',
  requireEmail: false,
  requirePhone: false,
};

const ENDPOINT = `${config.api.baseUrl.replace(/\/$/, '')}/support/tickets`;

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error('Could not copy to clipboard'),
  );
}

/** Ready-to-paste snippets with the real endpoint and real key baked in. */
function snippets(apiKey: string) {
  return {
    curl: `curl -X POST "${ENDPOINT}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Customer issue","description":"Details...","customer":{"name":"Jane","email":"jane@acme.com"},"device":{"macAddress":"AA:BB:CC:DD:EE:FF","osInfo":"Windows 11","browserInfo":"Chrome 124"}}'`,
    node: `await fetch("${ENDPOINT}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Customer issue",
    description: "Details...",
    customer: { name: "Jane", email: "jane@acme.com" },
    device: { macAddress: "AA:BB:CC:DD:EE:FF", osInfo: "Windows 11", browserInfo: "Chrome 124" },
  }),
});`,
    javascript: `fetch("${ENDPOINT}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Customer issue",
    description: "Details...",
    customer: { name: "Jane", email: "jane@acme.com" },
    device: { macAddress: "AA:BB:CC:DD:EE:FF", osInfo: "Windows 11", browserInfo: "Chrome 124" },
  }),
})
  .then((res) => res.json())
  .then(({ data }) => console.log("Ticket created:", data.id))
  .catch((err) => console.error("Ticket failed:", err));`,
    python: `import requests

requests.post(
    "${ENDPOINT}",
    headers={"Authorization": "Bearer ${apiKey}", "Content-Type": "application/json"},
    json={
        "title": "Customer issue",
        "description": "Details...",
        "customer": {"name": "Jane", "email": "jane@acme.com"},
        "device": {"macAddress": "AA:BB:CC:DD:EE:FF", "osInfo": "Windows 11", "browserInfo": "Chrome 124"},
    },
)`,
  };
}

function IntegrationCode({ apiKey }: { apiKey: string | null }) {
  const [lang, setLang] = useState<'curl' | 'node' | 'javascript' | 'python'>('curl');

  if (!apiKey) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        No active key — click regenerate to create one and get your integration code.
      </div>
    );
  }

  const code = snippets(apiKey);

  return (
    <div className="rounded-md border bg-muted/30 p-2 space-y-2">
      <div className="flex items-center gap-1">
        {(['curl', 'node', 'javascript', 'python'] as const).map((l) => (
          <Button
            key={l}
            variant={lang === l ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs capitalize"
            onClick={() => setLang(l)}
          >
            {l}
          </Button>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Copy code"
          onClick={() => copy(code[lang], 'Code')}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <pre className="text-[11px] leading-relaxed overflow-x-auto whitespace-pre font-mono p-1">
        {code[lang]}
      </pre>
    </div>
  );
}

export function SupportLinksManager({ projectId }: { projectId: string }) {
  const { data: links = [] } = useSupportLinks(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: issueColumns } = useIssueColumns(projectId);
  const columns = issueColumns && issueColumns.length > 0 ? issueColumns : DEFAULT_ISSUE_COLUMNS;

  const createMut = useCreateSupportLink(projectId);
  const updateMut = useUpdateSupportLink(projectId);
  const deleteMut = useDeleteSupportLink(projectId);
  const regenMut = useRegenerateSupportLinkToken(projectId);

  const memberOptions = useMemo(
    () => members.map((m) => ({ label: m.name, value: m.id })),
    [members],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (link: SupportLink) => {
    setEditingId(link.id);
    setForm({
      name: link.name,
      defaultColumnKey: link.defaultColumnKey ?? 'open',
      defaultCategory: link.defaultCategory ?? 'defect',
      defaultSeverity: link.defaultSeverity ?? 'minor',
      autoAssignStrategy: link.autoAssignStrategy,
      autoAssignUserIds: link.autoAssignUserIds ?? [],
      notifyUserIds: link.notifyUserIds ?? [],
      notifyEmails: (link.notifyEmails ?? []).join(', '),
      requireEmail: link.requireEmail,
      requirePhone: link.requirePhone,
    });
    setDialogOpen(true);
  };

  const buildPayload = (): CreateSupportLinkInput => ({
    name: form.name.trim(),
    defaultColumnKey: form.defaultColumnKey,
    defaultCategory: form.defaultCategory,
    defaultSeverity: form.defaultSeverity,
    autoAssignStrategy: form.autoAssignStrategy,
    autoAssignUserIds: form.autoAssignStrategy === 'none' ? [] : form.autoAssignUserIds,
    notifyUserIds: form.notifyUserIds,
    notifyEmails: form.notifyEmails.split(',').map((e) => e.trim()).filter(Boolean),
    requireEmail: form.requireEmail,
    requirePhone: form.requirePhone,
  });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Please give the key a name');
      return;
    }
    try {
      if (editingId) {
        await updateMut.mutateAsync({ linkId: editingId, input: buildPayload() });
      } else {
        await createMut.mutateAsync(buildPayload());
      }
      setDialogOpen(false);
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Ready-to-paste code your systems use to create issues via the API.
        </p>
        <Button onClick={openCreate} size="sm" className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> New key
        </Button>
      </div>

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No API keys yet.</p>
      ) : (
        links.map((link) => (
          <div key={link.id} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{link.name}</span>
                <Badge variant={link.isActive ? 'default' : 'secondary'}>
                  {link.isActive ? 'Active' : 'Disabled'}
                </Badge>
                <span className="text-xs text-muted-foreground shrink-0">
                  {link.submissionCount} ticket{link.submissionCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch
                  checked={link.isActive}
                  onCheckedChange={(checked) =>
                    updateMut.mutate({ linkId: link.id, input: { isActive: checked } })
                  }
                  aria-label="Toggle active"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit"
                  onClick={() => openEdit(link)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Regenerate key"
                  onClick={() => regenMut.mutate(link.id)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete"
                  onClick={() => deleteMut.mutate(link.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <IntegrationCode apiKey={link.apiKey} />
          </div>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit API key' : 'New API key'}</DialogTitle>
            <DialogDescription>
              Configure where tickets land, who they’re assigned to, and who gets notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Website backend, Zendesk sync"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Drop new tickets into</Label>
              <Select value={form.defaultColumnKey} onValueChange={(v) => setForm({ ...form, defaultColumnKey: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.status} value={c.status}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Default Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.defaultCategory}
                  onValueChange={(v) => setForm({ ...form, defaultCategory: v as IssueCategory })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Default Severity</Label>
                <Select
                  value={form.defaultSeverity}
                  onValueChange={(v) => setForm({ ...form, defaultSeverity: v as IssueSeverity })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Auto-assign</Label>
              <Select value={form.autoAssignStrategy}
                onValueChange={(v) => setForm({ ...form, autoAssignStrategy: v as AutoAssignStrategy })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No auto-assign</SelectItem>
                  <SelectItem value="fixed">Fixed developer</SelectItem>
                  <SelectItem value="round_robin">Round-robin across developers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.autoAssignStrategy !== 'none' && (
              <div className="space-y-1.5">
                <Label>{form.autoAssignStrategy === 'fixed' ? 'Developer' : 'Developer pool'}</Label>
                <MultiSelect
                  options={memberOptions}
                  selected={form.autoAssignUserIds}
                  onChange={(vals) =>
                    setForm({
                      ...form,
                      autoAssignUserIds: form.autoAssignStrategy === 'fixed' ? vals.slice(-1) : vals,
                    })
                  }
                  placeholder="Select developer(s)"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notify these team members</Label>
              <MultiSelect
                options={memberOptions}
                selected={form.notifyUserIds}
                onChange={(vals) => setForm({ ...form, notifyUserIds: vals })}
                placeholder="Select team members"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Also email (comma-separated)</Label>
              <Input
                placeholder="support@company.com, ops@company.com"
                value={form.notifyEmails}
                onChange={(e) => setForm({ ...form, notifyEmails: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.requireEmail} onCheckedChange={(c) => setForm({ ...form, requireEmail: c })} />
                Require customer email
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.requirePhone} onCheckedChange={(c) => setForm({ ...form, requirePhone: c })} />
                Require phone
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {editingId ? 'Save changes' : 'Create key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
