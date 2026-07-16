import { useState, useMemo, useEffect } from 'react';
import { Search, Check, Camera, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { chatService } from '@/services/chat.service';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ReachableUser } from '../types';
import { logger } from '@/services/monitoring/logger';
import { resolveFileUrl } from '@/utils/fileUrl';

interface NewGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (conversationId: string) => void;
  onConversationCreated?: () => Promise<void>;
  orgId?: string;
}

export function NewGroupDialog({ open, onOpenChange, onSelect, onConversationCreated, orgId }: NewGroupDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<ReachableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    chatService
      .getReachableUsers(orgId)
      .then(setUsers)
      .catch((err) => {
        logger.error('Failed to fetch users:', err);
        toast.error('Failed to load users');
      })
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q));
  }, [search, users]);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const convId = await chatService.createGroup(
        name,
        description || undefined,
        Array.from(selectedIds),
        avatarUrl || undefined
      );
      if (onConversationCreated) await onConversationCreated();
      toast.success(`Group "${name}" created`);
      reset();
      onOpenChange(false);
      onSelect(convId);
    } catch (err) {
      logger.error('Failed to create group:', err);
      toast.error('Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const reset = () => {
    setStep(1);
    setName('');
    setDescription('');
    setSelectedIds(new Set());
    setSearch('');
    setAvatarUrl('');
    setAvatarError(false);
    setIsCreating(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setIsUploading(true);
    setAvatarError(false);
    try {
      const publicUrl = await chatService.uploadGroupAvatar(file);
      setAvatarUrl(publicUrl);
      toast.success('Group photo uploaded');
    } catch (err: any) {
      logger.error(err);
      toast.error('Failed to upload image: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  const isEmoji = (str: string) => {
    const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
    return emojiRegex.test(str) && str.length <= 8;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Create Group' : 'Add Members'}</DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 pt-2">
              <div
                className="relative group/avatar cursor-pointer transition-transform hover:scale-105"
                onClick={() => !isUploading && document.getElementById('new-group-avatar')?.click()}
              >
                <Avatar className="h-20 w-20 mx-auto border-4 border-primary/10 shadow-sm">
                  {avatarUrl && !isEmoji(avatarUrl) && !avatarError ? (
                    <AvatarImage
                      src={resolveFileUrl(avatarUrl) ?? avatarUrl}
                      onError={() => setAvatarError(true)}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="text-2xl font-semibold bg-primary/5 text-primary">
                    {isEmoji(avatarUrl) ? avatarUrl : (name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?')}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
                <input
                  id="new-group-avatar"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </div>
              <p className="text-[10px] font-medium text-primary/60 uppercase tracking-wider">Add Group Image</p>
            </div>

            <div className="space-y-2">
              <Label>Group Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Design Team" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this group about?" rows={2} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-[240px] overflow-y-auto space-y-1">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                  </div>
                ))
              ) : (
                filtered.map((user) => {
                  const checked = selectedIds.has(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={cn('flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-left', checked ? 'bg-accent' : 'hover:bg-accent/50')}
                    >
                      <Checkbox checked={checked} />
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">{user.initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium block truncate">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.role}</span>
                      </div>
                      {checked && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
            {selectedIds.size > 0 && (
              <p className="text-xs text-muted-foreground">{selectedIds.size} member{selectedIds.size > 1 ? 's' : ''} selected</p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
          )}
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!name.trim()}>Next</Button>
          ) : (
            <Button onClick={handleCreate} disabled={selectedIds.size === 0 || isCreating}>
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {isCreating ? 'Creating...' : 'Create Group'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}
