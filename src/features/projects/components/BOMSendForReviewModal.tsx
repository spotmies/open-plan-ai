// BOMSendForReviewModal — submitter picks scope (this part only vs. + sub-components)
// and one or more approvers from the project team, then sends the part(s) for review.
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Boxes, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectMembers } from '@/hooks/useProjectTeam';
import type { BOMApprovalRequestScope } from './bomData';

interface Props {
  open: boolean;
  projectId: string;
  partLabel: string;
  hasChildren: boolean;
  onClose: () => void;
  onSubmit: (scope: BOMApprovalRequestScope, approverIds: string[], comment?: string) => Promise<void> | void;
}

export function BOMSendForReviewModal({ open, projectId, partLabel, hasChildren, onClose, onSubmit }: Props) {
  const { data: allMembers = [] } = useProjectMembers(projectId);
  // Only maintainers/admins can be assigned as approvers — members are excluded.
  const members = allMembers.filter(m => m.role === 'admin' || m.role === 'maintainer');
  const [scope, setScope] = useState<BOMApprovalRequestScope>('node');
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setScope('node');
    setApproverIds([]);
    setComment('');
    setErr(false);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const toggleApprover = (id: string) => {
    setApproverIds(prev => (prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]));
    if (err) setErr(false);
  };

  const handleSubmit = async () => {
    if (approverIds.length === 0) { setErr(true); return; }
    setSubmitting(true);
    try {
      await onSubmit(scope, approverIds, comment.trim() || undefined);
      reset();
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send {partLabel} for Review</DialogTitle>
          <DialogDescription>
            Choose what to include and who should review it. The selected approver(s) will be notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Scope
            </Label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setScope('node')}
                className={cn(
                  'flex items-start gap-2.5 px-3 py-2.5 rounded-md border text-left transition-colors',
                  scope === 'node' ? 'border-primary bg-primary/5' : 'border-border bg-muted/40 hover:bg-muted',
                )}
              >
                <FileText className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium text-foreground">This part only</div>
                  <div className="text-[11px] text-muted-foreground">Just {partLabel}, no sub-components.</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setScope('subtree')}
                disabled={!hasChildren}
                className={cn(
                  'flex items-start gap-2.5 px-3 py-2.5 rounded-md border text-left transition-colors',
                  scope === 'subtree' ? 'border-primary bg-primary/5' : 'border-border bg-muted/40 hover:bg-muted',
                  !hasChildren && 'opacity-50 cursor-not-allowed',
                )}
              >
                <Boxes className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium text-foreground">This part + all sub-components</div>
                  <div className="text-[11px] text-muted-foreground">
                    {hasChildren ? 'One review covers the whole subtree.' : 'No sub-components to include.'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Approver(s)<span className="text-destructive ml-0.5">*</span>
            </Label>
            {members.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No project members found to assign as approvers.</p>
            ) : (
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border border-border rounded-md p-2">
                {members.map(m => (
                  <label key={m.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/60 cursor-pointer">
                    <Checkbox
                      checked={approverIds.includes(m.id)}
                      onCheckedChange={() => toggleApprover(m.id)}
                    />
                    <span className="text-sm text-foreground">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground">· {m.role}</span>
                  </label>
                ))}
              </div>
            )}
            {err && (
              <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> Select at least one approver.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Note (optional)
            </Label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Any context for the reviewer…"
              className="text-sm bg-muted border-border resize-none"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send for Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
