import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, RefreshCw, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useShareAssistantConversation, useUnshareAssistantConversation } from '../hooks/useAssistantConversations';
import type { AssistantConversationSummary } from '../assistantData';

interface AssistantShareDialogProps {
  conversation: AssistantConversationSummary | null;
  onOpenChange: (open: boolean) => void;
}

export function AssistantShareDialog({ conversation, onOpenChange }: AssistantShareDialogProps) {
  const shareMutation = useShareAssistantConversation();
  const unshareMutation = useUnshareAssistantConversation();
  const [copied, setCopied] = useState(false);

  const open = !!conversation;
  // Falls back to the conversation prop's own shareId (already shared, from
  // a previous session) until a fresh mutation resolves — the prop is a
  // snapshot captured at click time and won't reactively pick up a
  // newly-minted shareId on its own.
  const shareId = shareMutation.data?.shareId ?? conversation?.shareId ?? null;
  const shareUrl = shareId ? `${window.location.origin}/share/${shareId}` : '';
  const isCreating = shareMutation.isPending && !conversation?.shareId;

  useEffect(() => {
    if (!open || !conversation) return;
    setCopied(false);
    if (!conversation.shareId) {
      shareMutation.mutate(conversation.id, {
        onError: () => toast.error("Couldn't create a share link — try again."),
      });
    }
    // Only re-fire when a *different* conversation is opened, not on every
    // shareMutation identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversation?.id]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — try again.");
    }
  };

  const handleUpdate = () => {
    if (!conversation) return;
    shareMutation.mutate(conversation.id, {
      onSuccess: () => toast.success('Share link updated with the latest messages'),
      onError: () => toast.error("Couldn't update the link — try again."),
    });
  };

  const handleRemove = () => {
    if (!conversation) return;
    unshareMutation.mutate(conversation.id, {
      onSuccess: () => onOpenChange(false),
      onError: () => toast.error("Couldn't remove the link — try again."),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share conversation
          </DialogTitle>
          <DialogDescription>
            Anyone with this link can view a read-only copy of this conversation as it looks right now. It won't
            update as the conversation continues — use "Update link" to refresh it later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {isCreating ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating link…
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  onClick={handleCopy}
                  disabled={!shareUrl}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={handleUpdate}
                  disabled={shareMutation.isPending}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', shareMutation.isPending && 'animate-spin')} />
                  Update link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={handleRemove}
                  disabled={unshareMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove link
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
