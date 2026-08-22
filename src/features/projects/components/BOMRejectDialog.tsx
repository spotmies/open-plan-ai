// BOMRejectDialog — mandatory-reason confirmation dialog for rejecting a pending BOM part.
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  partLabel?: string;
  onClose: () => void;
  onConfirm: (reason: string, comment?: string) => Promise<void> | void;
}

export function BOMRejectDialog({ open, partLabel, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [err, setErr] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason('');
    setComment('');
    setErr(false);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { setErr(true); return; }
    setSubmitting(true);
    try {
      await onConfirm(reason.trim(), comment.trim() || undefined);
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
          <DialogTitle>Reject {partLabel ?? 'Part'}</DialogTitle>
          <DialogDescription>
            Rejecting returns this part to review. A reason is required so the part's creator knows what to revise.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Rejection Reason<span className="text-destructive ml-0.5">*</span>
            </Label>
            <Textarea
              autoFocus
              value={reason}
              onChange={e => { setReason(e.target.value); if (err) setErr(false); }}
              placeholder="Explain why this part is being rejected…"
              className={cn('text-sm bg-muted resize-none', err ? 'border-red-500/60' : 'border-border')}
              rows={3}
            />
            {err && (
              <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> A rejection reason is required.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Additional Comments (optional)
            </Label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Any extra context for the creator…"
              className="text-sm bg-muted border-border resize-none"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Rejecting…' : 'Reject Part'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
