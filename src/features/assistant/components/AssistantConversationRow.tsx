import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { resolveConversationScopeLabel, type AssistantConversationSummary } from '../assistantData';

interface AssistantConversationRowProps {
  conversation: AssistantConversationSummary;
  projectName?: string;
  isActive: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (conversation: AssistantConversationSummary) => void;
  onRequestRename: (conversation: AssistantConversationSummary) => void;
  onRequestDelete: (conversation: AssistantConversationSummary) => void;
}

export function AssistantConversationRow({
  conversation,
  projectName,
  isActive,
  onSelect,
  onTogglePin,
  onRequestRename,
  onRequestDelete,
}: AssistantConversationRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={cn(
        'group w-full rounded-lg px-3 py-2.5 text-left transition-colors',
        isActive ? 'bg-accent' : 'hover:bg-accent/50',
      )}
    >
      <div className="flex items-start gap-1.5">
        {conversation.pinned && <Pin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {conversation.title || 'New conversation'}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem className="gap-2" onClick={() => onTogglePin(conversation)}>
              {conversation.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              {conversation.pinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={() => onRequestRename(conversation)}>
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive gap-2"
              onClick={() => onRequestDelete(conversation)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
          {resolveConversationScopeLabel(conversation.scope, projectName)}
        </Badge>
        {conversation.status === 'awaiting_input' && (
          <Badge className="h-4 px-1.5 text-[10px] font-normal">Needs input</Badge>
        )}
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
        </span>
      </div>
    </button>
  );
}
