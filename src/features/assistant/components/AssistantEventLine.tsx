import { CheckCircle2, X, Clock, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssistantMessage } from '../assistantData';

const EVENT_META: Record<string, { Icon: typeof CheckCircle2; className: string }> = {
  proposal_confirmed: { Icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
  proposal_rejected: { Icon: X, className: 'text-muted-foreground' },
  proposal_expired: { Icon: Clock, className: 'text-muted-foreground' },
  proposal_superseded: { Icon: Ban, className: 'text-muted-foreground' },
};

/** Act (phase 2) — a role='event' message: subtle inline system note, never a chat bubble. */
export function AssistantEventLine({ message }: { message: AssistantMessage }) {
  const meta = (message.eventType && EVENT_META[message.eventType]) || EVENT_META.proposal_confirmed;
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-7 w-7 shrink-0" aria-hidden="true" />
      <div className={cn('flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground')}>
        <meta.Icon className={cn('h-3.5 w-3.5 shrink-0', meta.className)} />
        <span className="truncate">{message.content}</span>
      </div>
    </div>
  );
}
