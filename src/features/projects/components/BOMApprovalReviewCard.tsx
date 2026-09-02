// BOMApprovalReviewCard — compact approve/reject card shown on the BOM detail
// screen (above the Info row) when the current user can decide the part's
// active review request.
import { useState } from 'react';
import { Check, XCircle, ShieldCheck, Boxes, Loader2, AlertCircle, Clock } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { BOMApprovalRequest } from './bomData';

interface Props {
  request: BOMApprovalRequest;
  partLabel: string;
  onApprove: (comment?: string) => Promise<void> | void;
  onReject: (reason: string, comment?: string) => Promise<void> | void;
  isPending: boolean;
  className?: string;
}

export function BOMApprovalReviewCard({ request, partLabel, onApprove, onReject, isPending, className }: Props) {
  const [note, setNote] = useState('');
  const [noteErr, setNoteErr] = useState(false);
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    setSubmitting('approve');
    try {
      await onApprove(note.trim() || undefined);
      setNote('');
    } finally {
      setSubmitting(null);
    }
  };

  const handleReject = async () => {
    if (!note.trim()) { setNoteErr(true); return; }
    setSubmitting('reject');
    try {
      await onReject(note.trim());
      setNote('');
    } finally {
      setSubmitting(null);
    }
  };

  const busy = isPending || submitting !== null;

  return (
    <div
      className={cn('mx-6 mb-5 rounded-xl px-4 py-3', className)}
      style={{ background: 'rgba(245,158,11,0.05)', borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(245,158,11,0.25)' }}
    >
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: '#D97706' }} />
        <span className="text-sm font-semibold text-foreground">Needs Your Review</span>
        {request.scope === 'subtree' && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground bg-muted border border-border">
            <Boxes className="w-2.5 h-2.5" /> {partLabel} + sub-components
          </span>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto">
          Requested by <span className="font-medium text-foreground">{request.requestedByName}</span>
        </span>
      </div>

      {request.comment && (
        <div className="mb-2 px-2.5 py-2 rounded-md bg-muted/50 border border-border text-[11.5px] text-foreground/90 break-words whitespace-pre-wrap">
          <span className="block text-muted-foreground mb-1">Note from {request.requestedByName}:</span>
          {request.comment}
        </div>
      )}

      {request.approverDecisions.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {request.approverDecisions.map(a => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted border border-border text-muted-foreground"
            >
              {a.decision === 'approved' && <Check className="w-2.5 h-2.5" style={{ color: '#16A34A' }} />}
              {a.decision === 'rejected' && <XCircle className="w-2.5 h-2.5" style={{ color: '#DC2626' }} />}
              {a.decision === 'pending' && <Clock className="w-2.5 h-2.5" />}
              {a.name}
            </span>
          ))}
        </div>
      )}

      <Textarea
        value={note}
        onChange={e => { setNote(e.target.value); if (noteErr) setNoteErr(false); }}
        placeholder="Add a note (required if rejecting)…"
        className={cn('text-sm bg-muted resize-none mb-2', noteErr ? 'border-red-500/60' : 'border-border')}
        rows={2}
      />
      {noteErr && (
        <p className="text-[11px] text-destructive flex items-center gap-1 mb-2">
          <AlertCircle className="w-3 h-3" /> A note is required when rejecting.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting === 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" style={{ color: '#16A34A' }} />}
          Approve
        </button>
        <button
          onClick={handleReject}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />}
          Reject
        </button>
      </div>
    </div>
  );
}
