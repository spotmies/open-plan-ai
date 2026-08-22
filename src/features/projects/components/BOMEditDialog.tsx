import { useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { BOMNode, BOMRevision, BOMStatus } from './bomData';
import { BOMStatusPill } from './BOMShared';
import { CheckCircle, Clock, GitBranch, Save } from 'lucide-react';

// ── What gets saved ───────────────────────────────────────────────
export interface BOMEditPayload {
  /** if 'same' → overwrite current revision; if 'new' → append a new revision */
  versionMode: 'same' | 'new';
  newRevLabel?: string;    // e.g. "B" — only when versionMode === 'new'
  changeNotes: string;
  desc: string;
  qty: number;
  uom: string;
  manufacturer: string;
  distributor: string;
  price: number;
  leadTime: number;
  mpn: string;
  status: BOMStatus;
}

interface Props {
  node: BOMNode;
  open: boolean;
  onClose: () => void;
  onSave: (payload: BOMEditPayload) => void;
}

const LETTERS = 'ABCDEFGHIJ';
function nextRev(current: string): string {
  const idx = LETTERS.indexOf(current.toUpperCase());
  return idx >= 0 && idx < LETTERS.length - 1 ? LETTERS[idx + 1] : current;
}

const FormField = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={cn('space-y-1.5', className)}>
    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
    {children}
  </div>
);

export function BOMEditDialog({ node, open, onClose, onSave }: Props) {
  const [desc, setDesc] = useState(node.desc);
  const [qty, setQty] = useState(String(node.qty));
  const [uom, setUom] = useState(node.uom);
  const [manufacturer, setManufacturer] = useState(node.manufacturer);
  const [distributor, setDistributor] = useState(node.distributor);
  const [price, setPrice] = useState(String(node.price));
  const [leadTime, setLeadTime] = useState(String(node.leadTime));
  const [mpn, setMpn] = useState(node.mpn);
  const [status, setStatus] = useState<BOMStatus>(node.status);
  const [versionMode, setVersionMode] = useState<'same' | 'new'>('same');
  const [newRevLabel, setNewRevLabel] = useState(nextRev(node.rev));
  const [changeNotes, setChangeNotes] = useState('');

  // Reset form whenever the node changes (e.g. navigating to another part)
  // (production app would use useEffect; kept simple here)

  const handleSave = () => {
    onSave({
      versionMode,
      newRevLabel: versionMode === 'new' ? newRevLabel.toUpperCase() : undefined,
      changeNotes,
      desc,
      qty: parseFloat(qty) || node.qty,
      uom,
      manufacturer,
      distributor,
      price: parseFloat(price) || node.price,
      leadTime: parseInt(leadTime) || node.leadTime,
      mpn,
      status,
    });
    onClose();
  };

  const inp = 'h-8 text-sm bg-muted border-border focus-visible:ring-1';

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
          <SheetTitle className="text-base font-semibold flex items-center gap-2">
            Edit Part
            <span className="text-xs font-mono font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {node.pn}
            </span>
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Modify part details. Choose to update the current revision or create a new one.
          </SheetDescription>
        </SheetHeader>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <FormField label="Description">
            <Textarea
              value={desc} onChange={e => setDesc(e.target.value)}
              className="text-sm bg-muted border-border resize-none min-h-[64px]"
              rows={2}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quantity">
              <Input value={qty} onChange={e => setQty(e.target.value)} type="number" className={inp} />
            </FormField>
            <FormField label="Unit of Measure">
              <Input value={uom} onChange={e => setUom(e.target.value)} className={inp} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Manufacturer">
              <Input value={manufacturer} onChange={e => setManufacturer(e.target.value)} className={inp} />
            </FormField>
            <FormField label="Supplier / Distributor">
              <Input value={distributor} onChange={e => setDistributor(e.target.value)} className={inp} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unit Price ($)">
              <Input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" className={inp} />
            </FormField>
            <FormField label="Lead Time (weeks)">
              <Input value={leadTime} onChange={e => setLeadTime(e.target.value)} type="number" className={inp} />
            </FormField>
          </div>

          <FormField label="Manufacturer Part Number (MPN)">
            <Input value={mpn} onChange={e => setMpn(e.target.value)} className={cn(inp, 'font-mono')} />
          </FormField>

          <FormField label="Status">
            <div className="flex gap-2">
              {(['approved', 'pending'] as BOMStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors',
                    status === s
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  )}
                >
                  {s === 'approved'
                    ? <CheckCircle className="w-3.5 h-3.5" style={{ color: '#16A34A' }} />
                    : <Clock className="w-3.5 h-3.5" style={{ color: '#D97706' }} />}
                  {s === 'approved' ? 'Approved' : 'Pending'}
                </button>
              ))}
            </div>
          </FormField>

          {/* ── Version management ──────────────────────────────── */}
          <div className="pt-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Save as Version
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/40">
              <button
                type="button"
                onClick={() => setVersionMode('same')}
                className={cn(
                  'flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  versionMode === 'same' ? 'bg-card border border-border shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Update Rev {node.rev}
              </button>
              <button
                type="button"
                onClick={() => setVersionMode('new')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  versionMode === 'new' ? 'bg-card border border-border shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <GitBranch className="w-3.5 h-3.5" />
                New revision
              </button>
            </div>

            {versionMode === 'new' ? (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground shrink-0">Label:</span>
                <Input
                  value={newRevLabel}
                  onChange={e => setNewRevLabel(e.target.value.toUpperCase().slice(0, 3))}
                  className="h-7 text-xs font-mono w-16 bg-background"
                  placeholder="B"
                />
                <span className="text-xs text-muted-foreground">Rev {node.rev} is preserved in history.</span>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground mt-2">Overwrites Rev {node.rev} in place. No history entry is created.</div>
            )}

            {/* Change notes */}
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Change notes {versionMode === 'new' && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                value={changeNotes}
                onChange={e => setChangeNotes(e.target.value)}
                placeholder={versionMode === 'new'
                  ? 'Describe what changed in this revision…'
                  : 'Optional: describe the correction made…'}
                className="text-sm bg-muted border-border resize-none min-h-[60px]"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 shrink-0 bg-card">
          <div className="text-xs text-muted-foreground">
            {versionMode === 'new'
              ? `Will create Rev ${newRevLabel || '?'} — Rev ${node.rev} preserved in history`
              : `Will overwrite Rev ${node.rev} in place`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              disabled={versionMode === 'new' && !changeNotes.trim()}
              onClick={handleSave}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {versionMode === 'new' ? `Save as Rev ${newRevLabel || '?'}` : 'Save Changes'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
