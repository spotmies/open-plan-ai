import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Conversation, ReachableUser } from '../types';
import { chatService } from '@/services/chat.service';
import { useOrganization } from '@/contexts/OrganizationContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logger } from '@/services/monitoring/logger';

interface AddMemberDialogProps {
  conversation: Conversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: () => void;
}

export function AddMemberDialog({ conversation, open, onOpenChange, onMemberAdded }: AddMemberDialogProps) {
  const { currentOrganization } = useOrganization();
  const [reachableUsers, setReachableUsers] = useState<ReachableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  useEffect(() => {
    if (!open || !currentOrganization?.id) return;
    setSelectedUserIds([]);
    setLoadingUsers(true);
    chatService.getReachableUsers(currentOrganization.id)
      .then((users) => {
        const existingIds = new Set(conversation.members.map((m) => m.id));
        setReachableUsers(users.filter((u) => !existingIds.has(u.id)));
      })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoadingUsers(false));
  }, [open, conversation.members, currentOrganization?.id]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleBulkAdd = async () => {
    if (selectedUserIds.length === 0) return;
    setIsBulkAdding(true);
    try {
      await chatService.addMembersToGroup(conversation.id, selectedUserIds);

      const addedNames = reachableUsers
        .filter((u) => selectedUserIds.includes(u.id))
        .map((u) => u.name);

      if (addedNames.length > 0) {
        const namesStr =
          addedNames.length === 1
            ? addedNames[0]
            : addedNames.length === 2
              ? `${addedNames[0]} and ${addedNames[1]}`
              : `${addedNames.slice(0, -1).join(', ')}, and ${addedNames[addedNames.length - 1]}`;
        await chatService.sendSystemMessage(conversation.id, `${namesStr} joined the group`);
      }

      toast.success(`${selectedUserIds.length} member${selectedUserIds.length > 1 ? 's' : ''} added`);
      onOpenChange(false);
      setSelectedUserIds([]);
      onMemberAdded();
    } catch (err) {
      logger.error(err);
      toast.error('Failed to add members');
    } finally {
      setIsBulkAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>
            Select members from your organization to add to this group.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          {loadingUsers ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading users...</p>
          ) : reachableUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No more users to add</p>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2">
              {reachableUsers.map((u) => (
                <div
                  key={u.id}
                  className={cn(
                    'flex items-center gap-3 w-full p-2.5 rounded-lg transition-colors cursor-pointer group hover:bg-muted/50',
                    selectedUserIds.includes(u.id) && 'bg-primary/5',
                  )}
                  onClick={() => toggleUser(u.id)}
                >
                  <Checkbox
                    id={`user-${u.id}`}
                    checked={selectedUserIds.includes(u.id)}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary pointer-events-none"
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={u.avatarUrl} />
                    <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
                      {u.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                      {u.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="mt-2">
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className={cn(
              'gap-2 px-4 transition-all duration-300',
              selectedUserIds.length > 0 ? 'opacity-100' : 'opacity-50 pointer-events-none',
            )}
            onClick={handleBulkAdd}
            disabled={selectedUserIds.length === 0 || isBulkAdding}
          >
            {isBulkAdding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>Add {selectedUserIds.length > 0 ? `${selectedUserIds.length} ` : ''}Member{selectedUserIds.length > 1 ? 's' : ''}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
