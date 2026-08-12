import { useMemo, useState } from 'react';
import { MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useProjects } from '@/hooks/useProjects';
import { AssistantConversationRow } from './AssistantConversationRow';
import { AssistantShareDialog } from './AssistantShareDialog';
import {
  useAssistantConversations,
  useUpdateAssistantConversation,
  useDeleteAssistantConversation,
  useDeleteAllAssistantConversations,
} from '../hooks/useAssistantConversations';
import type { AssistantConversationSummary } from '../assistantData';

const MAX_PINNED = 5;

interface AssistantConversationListProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  onActiveDeleted: () => void;
}

export function AssistantConversationList({
  activeId,
  onSelect,
  onNewConversation,
  onActiveDeleted,
}: AssistantConversationListProps) {
  const { data: conversations = [], isLoading } = useAssistantConversations();
  const { data: projects = [] } = useProjects();
  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const updateConversation = useUpdateAssistantConversation();
  const deleteConversation = useDeleteAssistantConversation();
  const deleteAllConversations = useDeleteAllAssistantConversations();

  const [renamingConversation, setRenamingConversation] = useState<AssistantConversationSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AssistantConversationSummary | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [sharingConversation, setSharingConversation] = useState<AssistantConversationSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? sorted.filter((c) => (c.title || 'New conversation').toLowerCase().includes(query))
    : sorted;
  const pinned = filtered.filter((c) => c.pinned);
  const rest = filtered.filter((c) => !c.pinned);

  const handleTogglePin = (conversation: AssistantConversationSummary) => {
    updateConversation.mutate(
      { id: conversation.id, updates: { pinned: !conversation.pinned } },
      {
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't update that conversation."),
      },
    );
  };

  const handleConfirmRename = () => {
    if (!renamingConversation || !renameValue.trim()) return;
    updateConversation.mutate(
      { id: renamingConversation.id, updates: { title: renameValue.trim() } },
      {
        onError: () => toast.error("Couldn't rename that conversation — try again."),
      },
    );
    setRenamingConversation(null);
    setRenameValue('');
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    deleteConversation.mutate(id, {
      onSuccess: () => {
        if (id === activeId) onActiveDeleted();
      },
      onError: () => toast.error("Couldn't delete that conversation — try again."),
    });
    setPendingDelete(null);
  };

  const handleConfirmDeleteAll = () => {
    deleteAllConversations.mutate(undefined, {
      onSuccess: () => onActiveDeleted(),
      onError: () => toast.error("Couldn't delete your conversations — try again."),
    });
    setConfirmDeleteAll(false);
  };

  const renderRow = (conversation: AssistantConversationSummary) => (
    <AssistantConversationRow
      key={conversation.id}
      conversation={conversation}
      projectName={conversation.projectId ? projectNameById.get(conversation.projectId) : undefined}
      isActive={conversation.id === activeId}
      onSelect={onSelect}
      onTogglePin={handleTogglePin}
      onRequestRename={(c) => {
        setRenamingConversation(c);
        setRenameValue(c.title || '');
      }}
      onRequestDelete={setPendingDelete}
      onRequestShare={setSharingConversation}
    />
  );

  return (
    <div className="flex h-full w-full md:w-[280px] shrink-0 flex-col border-r border-border">
      <div className="flex items-center gap-1.5 p-3">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={onNewConversation}>
          <Plus className="h-4 w-4" />
          New conversation
        </Button>
        {/* Hidden: "Delete all conversations" dropdown menu. Unhide by restoring this block. */}
        {false && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive gap-2"
                disabled={conversations.length === 0}
                onClick={() => setConfirmDeleteAll(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete all conversations
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {conversations.length > 0 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 px-2">
        <div className="space-y-1 pb-2">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mx-1 h-14 rounded-lg" />)}

          {!isLoading && conversations.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No conversations yet — ask the assistant something to get started.
            </p>
          )}

          {!isLoading && conversations.length > 0 && filtered.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No conversations match "{searchQuery.trim()}".
            </p>
          )}

          {!isLoading && pinned.length > 0 && (
            <>
              <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pinned · {pinned.length}/{MAX_PINNED}
              </p>
              {pinned.map(renderRow)}
              <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recent
              </p>
            </>
          )}

          {!isLoading && rest.map(renderRow)}
        </div>
      </ScrollArea>

      <Dialog
        open={!!renamingConversation}
        onOpenChange={(open) => {
          if (!open) {
            setRenamingConversation(null);
            setRenameValue('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Conversation title"
                value={renameValue}
                maxLength={80}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
                autoFocus
              />
            </div>
            <Button onClick={handleConfirmRename} disabled={!renameValue.trim()} className="w-full">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete conversation?"
        description={`"${pendingDelete?.title || 'New conversation'}" will be permanently deleted.`}
        confirmText="Delete"
        variant="destructive"
      />

      <ConfirmationDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        onConfirm={handleConfirmDeleteAll}
        title="Delete all conversations?"
        description={`This will permanently delete all ${conversations.length} conversation${conversations.length === 1 ? '' : 's'}, including pinned ones.`}
        confirmText="Delete all"
        variant="destructive"
      />

      <AssistantShareDialog
        conversation={sharingConversation}
        onOpenChange={(open) => !open && setSharingConversation(null)}
      />
    </div>
  );
}
