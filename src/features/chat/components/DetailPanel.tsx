import { useState, useEffect } from 'react';
import { X, Bell, LogOut, FileText, UserPlus, Download, Image, Pencil, Check, Loader2, Camera, Trash2, Shield, ShieldOff, ChevronLeft, ChevronRight, Pin, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { OnlineStatus } from './OnlineStatus';
import { Conversation, ConversationMember, ReachableUser } from '../types';
import { useAuth } from '@/contexts/AuthContext';
import { useChatStore } from '../stores/useChatStore';
import { chatService } from '@/services/chat.service';
import { resolveFileUrl } from '@/utils/fileUrl';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { FilePreviewDialog, FilePreviewTarget } from '@/components/FilePreviewDialog';
import { logger } from '@/services/monitoring/logger';

interface SharedFile {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath?: string;
  url?: string;
  createdAt: string;
  senderName?: string;
}

interface DetailPanelProps {
  conversation: Conversation;
  onRefetch?: () => void;
  className?: string;
  pinnedCount?: number;
  favouriteCount?: number;
  onShowPinned?: () => void;
  onShowFavourites?: () => void;
}

const MEMBER_PREVIEW_COUNT = 5;
const FILE_PREVIEW_COUNT = 4;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export function DetailPanel({ conversation, onRefetch, className, pinnedCount = 0, favouriteCount = 0, onShowPinned, onShowFavourites }: DetailPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentUserId = user?.id;
  const setDetailPanelOpen = useChatStore((s) => s.setDetailPanelOpen);
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);
  const isGroup = conversation.type === 'group';
  const [view, setView] = useState<'details' | 'people' | 'files'>('details');

  useEffect(() => {
    setView('details');
  }, [conversation.id]);

  const currentMember = conversation.members.find((m) => m.id === currentUserId);
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = currentMember?.role === 'admin';
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const isProjectGroup = isGroup && !!linkedProjectId;
  const canManageMembers = isOwner || isAdmin;
  const canEditGroupInfo = isOwner || isAdmin || isProjectGroup;

  // Shared files
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FilePreviewTarget | null>(null);
  const previewableFiles: FilePreviewTarget[] = sharedFiles
    .filter((f) => !!f.url)
    .map((f) => ({ url: f.url as string, fileName: f.fileName, mimeType: f.mimeType }));

  // Add member dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [reachableUsers, setReachableUsers] = useState<ReachableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [showAddConfirm, setShowAddConfirm] = useState(false);

  // Edit group info
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(conversation.name);
  const [editDescription, setEditDescription] = useState(conversation.description || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(conversation.avatarUrl || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Confirmation state
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Per-conversation notifications toggle
  const [notificationsEnabled, setNotificationsEnabled] = useState(currentMember?.notificationsEnabled ?? true);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);

  useEffect(() => {
    setNotificationsEnabled(currentMember?.notificationsEnabled ?? true);
  }, [conversation.id, currentMember?.notificationsEnabled]);

  const handleToggleNotifications = async (checked: boolean) => {
    const previous = notificationsEnabled;
    setNotificationsEnabled(checked);
    setIsTogglingNotifications(true);
    try {
      await chatService.updateNotificationSettings(conversation.id, checked);
    } catch (err) {
      setNotificationsEnabled(previous);
      logger.warn('[DetailPanel] Failed to update notification settings', {
        conversationId: conversation.id,
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error('Failed to update notification settings');
    } finally {
      setIsTogglingNotifications(false);
    }
  };

  useEffect(() => {
    setEditName(conversation.name);
    setEditDescription(conversation.description || '');
    setEditAvatarUrl(conversation.avatarUrl || '');
    setAvatarError(false);
    setFilesLoading(true);
    chatService.getSharedFiles(conversation.id)
      .then(setSharedFiles)
      .catch((err) => {
        logger.warn('[DetailPanel] Failed to load shared files', {
          conversationId: conversation.id,
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => setFilesLoading(false));
  }, [conversation.id, conversation.name, conversation.description, conversation.avatarUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!isGroup) {
      setLinkedProjectId(null);
      return;
    }

    const timeoutMs = Number(
      import.meta.env.VITE_CHAT_PROJECT_ID_LOOKUP_TIMEOUT_MS ?? 2500
    );

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setLinkedProjectId(null);
    }, timeoutMs);

    chatService.getProjectIdForConversation(conversation.id)
      .then((projectId) => {
        if (cancelled) return;
        setLinkedProjectId(projectId);
      })
      .catch(() => {
        if (cancelled) return;
        setLinkedProjectId(null);
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [conversation.id, isGroup]);

  const handleUpdateGroupInfo = async () => {
    if (!editName.trim()) {
      toast.error('Group name is required');
      return;
    }

    setIsUpdating(true);
    try {
      await chatService.updateGroupDetails(conversation.id, {
        name: editName,
        description: editDescription,
        avatar_url: editAvatarUrl || null
      });
      toast.success('Group details updated');
      setIsEditing(false);
      onRefetch?.();
    } catch (err: any) {
      logger.error('Full Update Error:', err);
      const errorMessage = err.message || err.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));

      if (errorMessage.includes('column "avatar_url" of relation "conversations" does not exist')) {
        toast.error('Database update required: Please run the SQL command provided in chat to add the missing avatar_url column.');
      } else {
        toast.error('Update failed: ' + errorMessage);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const isEmoji = (str: string) => {
    const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
    return emojiRegex.test(str) && str.length <= 8;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2MB');
      return;
    }

    setIsUploading(true);
    setAvatarError(false);
    try {
      const publicUrl = await chatService.uploadGroupAvatar(file);

      // Persist immediately to database (WhatsApp style)
      await chatService.updateGroupDetails(conversation.id, {
        avatar_url: publicUrl
      });

      setEditAvatarUrl(publicUrl);
      toast.success('Group photo updated');
      onRefetch?.();
    } catch (err: any) {
      logger.error(err);
      toast.error('Failed to update group photo: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      await chatService.addMemberToGroup(conversation.id, userId);
      toast.success('Member added');
      setAddDialogOpen(false);
      onRefetch?.();
    } catch (err) {
      logger.error(err);
      toast.error('Failed to add member');
    }
  };

  const handleBulkAdd = async () => {
    if (selectedUserIds.length === 0) return;
    setShowAddConfirm(false); // Close confirm dialog
    setIsBulkAdding(true);
    try {
      await chatService.addMembersToGroup(conversation.id, selectedUserIds);

      // Send system message for all added members
      const addedNames = reachableUsers
        .filter(u => selectedUserIds.includes(u.id))
        .map(u => u.name);

      if (addedNames.length > 0) {
        const namesStr = addedNames.length === 1 ? addedNames[0] :
          addedNames.length === 2 ? `${addedNames[0]} and ${addedNames[1]}` :
            `${addedNames.slice(0, -1).join(', ')}, and ${addedNames[addedNames.length - 1]}`;

        await chatService.sendSystemMessage(conversation.id, `${namesStr} joined the group`);
      }

      toast.success(`${selectedUserIds.length} members added`);
      setAddDialogOpen(false);
      setSelectedUserIds([]);
      onRefetch?.();
    } catch (err) {
      logger.error(err);
      toast.error('Failed to add members');
    } finally {
      setIsBulkAdding(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await chatService.removeMemberFromGroup(conversation.id, userId);
      toast.success('Member removed');
      onRefetch?.();
    } catch (err) {
      logger.error(err);
      toast.error('Failed to remove member');
    }
  };

  const handleDownloadSharedFile = async (file: SharedFile) => {
    const key = `${file.fileName}-${file.createdAt}`;
    if (downloadingFile === key) return;

    setDownloadingFile(key);
    try {
      await chatService.downloadChatAttachment({
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        storagePath: file.storagePath,
        url: file.url,
      });
      toast.success(`Downloading ${file.fileName}`);
    } catch (error) {
      logger.error('Failed to download shared file:', error);
      toast.error('Failed to download file');
    } finally {
      setDownloadingFile(null);
    }
  };

  const handlePreviewSharedFile = (file: SharedFile) => {
    if (!file.url) {
      handleDownloadSharedFile(file);
      return;
    }
    setPreviewFile({ url: file.url, fileName: file.fileName, mimeType: file.mimeType });
  };

  const handleMakeAdmin = async (userId: string) => {
    try {
      await chatService.updateMemberRole(conversation.id, userId, 'admin');
      toast.success('Made admin');
      onRefetch?.();
    } catch (err) {
      toast.error('Failed to update role');
    }
  };

  const handleDismissAdmin = async (userId: string) => {
    try {
      await chatService.updateMemberRole(conversation.id, userId, 'member');
      toast.success('Dismissed admin');
      onRefetch?.();
    } catch (err) {
      toast.error('Failed to update role');
    }
  };


  const handleLeaveGroup = async () => {
    if (!currentUserId) return;
    try {
      await chatService.removeMemberFromGroup(conversation.id, currentUserId);
      toast.success('You left the group');
      onRefetch?.();
      navigate('/chat');
    } catch (err) {
      logger.error(err);
      toast.error('Failed to leave group');
    }
  };

  const handleDeleteGroup = async () => {
    setIsDeletingGroup(true);
    try {
      await chatService.deleteConversation(conversation.id);
      toast.success('Group deleted');
      onRefetch?.();
      navigate('/chat');
    } catch (err) {
      logger.error(err);
      toast.error('Failed to delete group');
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const openAddDialog = async () => {
    setAddDialogOpen(true);
    setLoadingUsers(true);
    setSelectedUserIds([]);
    try {
      const users = await chatService.getReachableUsers();
      const existingIds = new Set(conversation.members.map((m) => m.id));
      setReachableUsers(users.filter((u) => !existingIds.has(u.id)));
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const renderMemberRow = (member: ConversationMember) => (
    <div key={member.id} className="flex items-center gap-2.5 group">
      <div className="relative shrink-0">
        <Avatar className="h-8 w-8">
          {member.avatarUrl && (
            <AvatarImage src={member.avatarUrl} alt={member.name} className="object-cover" />
          )}
          <AvatarFallback className="text-[10px]">{member.initials}</AvatarFallback>
        </Avatar>
        <OnlineStatus isOnline={onlineUserIds.has(member.id)} className="absolute -bottom-0.5 -right-0.5" size="sm" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm truncate block">
          {member.id === currentUserId ? 'You' : member.name}
        </span>
      </div>
      {isGroup && member.role?.toLowerCase() === 'owner' && (
        <span className="text-[11px] text-muted-foreground shrink-0">owner</span>
      )}
      {isGroup && member.role?.toLowerCase() === 'admin' && (
        <span className="text-[11px] text-muted-foreground shrink-0">admin</span>
      )}
      {isGroup && canManageMembers && member.id !== currentUserId && member.role !== 'owner' && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {isOwner && member.role !== 'admin' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
              onClick={() => handleMakeAdmin(member.id)}
              title="Make Admin"
            >
              <Shield className="h-4 w-4" />
            </Button>
          )}
          {isOwner && member.role === 'admin' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => handleDismissAdmin(member.id)}
              title="Dismiss Admin"
            >
              <ShieldOff className="h-4 w-4" />
            </Button>
          )}
          {!(isAdmin && member.role === 'admin') && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmRemoveId(member.id)}
              title="Remove member"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const renderSharedFileRow = (file: SharedFile, key: string) => {
    const isImage = file.mimeType?.startsWith('image/');
    const fileKey = `${file.fileName}-${file.createdAt}`;
    const isDownloading = downloadingFile === fileKey;
    return (
      <div
        key={key}
        className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors"
      >
        <button
          type="button"
          onClick={() => handlePreviewSharedFile(file)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          title={`Preview ${file.fileName}`}
        >
          {isImage ? (
            <Image className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{file.fileName}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {[file.senderName, formatShortDate(file.createdAt), formatFileSize(file.fileSize)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDownloadSharedFile(file);
          }}
          disabled={isDownloading}
          className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-70"
          title={`Download ${file.fileName}`}
        >
          {isDownloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col h-full border-l border-border w-[280px] shrink-0", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        {view === 'people' || view === 'files' ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 -ml-1.5" onClick={() => setView('details')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-sm font-semibold">
              {view === 'people' ? `People (${conversation.members.length})` : `Shared Files (${sharedFiles.length})`}
            </h3>
          </div>
        ) : (
          <h3 className="text-sm font-semibold">Details</h3>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailPanelOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {view === 'people' ? (
        <ScrollArea className="flex-1">
          <div className="p-4">
            {isGroup && canManageMembers && (
              <button
                type="button"
                onClick={openAddDialog}
                className="w-full flex items-center gap-2.5 p-2 -mx-2 mb-3 rounded-md hover:bg-muted transition-colors text-left"
              >
                <div className="h-8 w-8 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center shrink-0">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium">Add people</span>
              </button>
            )}
            <div className="space-y-3">
              {conversation.members.map(renderMemberRow)}
            </div>
          </div>
        </ScrollArea>
      ) : view === 'files' ? (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-1.5">
            {sharedFiles.map((file, i) => renderSharedFileRow(file, `${file.fileName}-${file.createdAt}-${i}`))}
          </div>
        </ScrollArea>
      ) : (
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Info */}
          <div className="text-center relative group/info">
            {isGroup && canEditGroupInfo && !isEditing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 absolute top-0 right-0 opacity-0 group-hover/info:opacity-100 transition-opacity"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}

            {isEditing ? (
              <div className="space-y-3 pt-4">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="relative group/avatar cursor-pointer transition-transform hover:scale-105"
                    onClick={() => !isUploading && document.getElementById('group-avatar-upload')?.click()}
                  >
                    <Avatar className="h-24 w-24 mx-auto border-4 border-primary/10 shadow-sm">
                      {editAvatarUrl && !isEmoji(editAvatarUrl) && !avatarError ? (
                        <AvatarImage
                          src={resolveFileUrl(editAvatarUrl) ?? editAvatarUrl}
                          onError={() => setAvatarError(true)}
                        />
                      ) : null}
                      <AvatarFallback className={cn('text-3xl font-semibold', isGroup && 'bg-primary/5 text-primary')}>
                        {isEmoji(editAvatarUrl) ? (
                          editAvatarUrl
                        ) : (
                          editName.split(' ').map((w) => w[0]).join('').slice(0, 2) || '??'
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                      {isUploading ? (
                        <Loader2 className="h-8 w-8 text-white animate-spin" />
                      ) : (
                        <Camera className="h-8 w-8 text-white" />
                      )}
                    </div>
                    <input
                      id="group-avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={isUploading}
                    />
                  </div>
                  <p className="text-[10px] font-medium text-primary/60 uppercase tracking-wider">Change Group Image</p>
                </div>

                <div className="space-y-2">
                  <Input
                    placeholder="Group Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9 font-semibold text-center"
                  />
                  <Textarea
                    placeholder="Group Description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="text-xs resize-none"
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(conversation.name);
                      setEditDescription(conversation.description || '');
                      setEditAvatarUrl(conversation.avatarUrl || '');
                    }}
                    disabled={isUpdating}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1"
                    onClick={handleUpdateGroupInfo}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Saving...' : (
                      <>
                        <Check className="h-3 w-3" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {(() => {
                  const isSelfChat = !isGroup && conversation.members.every((m) => m.id === currentUserId);
                  const otherMember = !isGroup
                    ? conversation.members.find((m) => m.id !== currentUserId) ?? (isSelfChat ? conversation.members[0] : undefined)
                    : null;
                  const topAvatarUrl = isGroup ? conversation.avatarUrl : otherMember?.avatarUrl;
                  const topInitials = isGroup
                    ? conversation.name.split(' ').map((w) => w[0]).join('').slice(0, 2)
                    : otherMember?.initials || '??';
                  const topName = isGroup
                    ? conversation.name
                    : isSelfChat
                      ? `${otherMember?.name || 'You'} (You)`
                      : otherMember?.name || conversation.name;
                  return (
                    <>
                      <Avatar key={otherMember?.id ?? conversation.id} className="h-16 w-16 mx-auto">
                        {topAvatarUrl && !isEmoji(topAvatarUrl) ? (
                          <AvatarImage src={resolveFileUrl(topAvatarUrl) ?? topAvatarUrl} className="object-cover" />
                        ) : null}
                        <AvatarFallback className={cn('text-lg font-semibold', isGroup && 'bg-primary/10 text-primary')}>
                          {topAvatarUrl && isEmoji(topAvatarUrl) ? topAvatarUrl : topInitials}
                        </AvatarFallback>
                      </Avatar>
                      <h4 className="font-semibold mt-2">{topName}</h4>
                    </>
                  );
                })()}
                {conversation.description && (
                  <p className="text-xs text-muted-foreground mt-1">{conversation.description}</p>
                )}
              </>
            )}
          </div>

          <Separator />

          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setView('people')}
              >
                Members ({conversation.members.length})
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {isGroup && canManageMembers && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openAddDialog} title="Add member">
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setView('people')}
              className="flex items-center flex-wrap gap-2"
            >
              {conversation.members.slice(0, MEMBER_PREVIEW_COUNT).map((member) => (
                <div key={member.id} className="relative">
                  <Avatar className="h-9 w-9">
                    {member.avatarUrl && (
                      <AvatarImage src={member.avatarUrl} alt={member.name} className="object-cover" />
                    )}
                    <AvatarFallback className="text-[11px]">{member.initials}</AvatarFallback>
                  </Avatar>
                  <OnlineStatus isOnline={onlineUserIds.has(member.id)} className="absolute -bottom-0.5 -right-0.5" size="sm" />
                </div>
              ))}
              {conversation.members.length > MEMBER_PREVIEW_COUNT && (
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium text-muted-foreground shrink-0">
                  +{conversation.members.length - MEMBER_PREVIEW_COUNT}
                </div>
              )}
            </button>
          </div>

          <Separator />

          {/* Pinned & Favourite messages */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={onShowPinned}
              className="w-full flex items-center gap-2.5 p-2 -mx-2 rounded-md hover:bg-muted transition-colors text-left"
            >
              <Pin className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm flex-1">Pinned Messages</span>
              <span className="text-xs text-muted-foreground">{pinnedCount}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={onShowFavourites}
              className="w-full flex items-center gap-2.5 p-2 -mx-2 rounded-md hover:bg-muted transition-colors text-left"
            >
              <Star className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-sm flex-1">Favourite Messages</span>
              <span className="text-xs text-muted-foreground">{favouriteCount}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          <Separator />

          {/* Shared Files */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-medium text-muted-foreground">Shared Files</h5>
            </div>
            {filesLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
            ) : sharedFiles.length === 0 ? (
              <div className="flex flex-col items-center py-4 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40 mb-1" />
                <p className="text-xs text-muted-foreground">No shared files yet</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {sharedFiles
                    .slice(0, FILE_PREVIEW_COUNT)
                    .map((file, i) => renderSharedFileRow(file, `${file.fileName}-${file.createdAt}-${i}`))}
                </div>
                {sharedFiles.length > FILE_PREVIEW_COUNT && (
                  <button
                    type="button"
                    className="text-xs text-primary font-medium mt-2 pl-2 hover:underline"
                    onClick={() => setView('files')}
                  >
                    Show more ({sharedFiles.length - FILE_PREVIEW_COUNT} more)
                  </button>
                )}
              </>
            )}
          </div>

          <Separator />

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Notifications</span>
            </div>
            <Switch
              checked={notificationsEnabled}
              disabled={isTogglingNotifications}
              onCheckedChange={handleToggleNotifications}
            />
          </div>

          {isGroup && (
            <>
              <Separator />
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => setConfirmLeaveOpen(true)}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Leave Group
              </Button>
              {isOwner && (
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Group
                </Button>
              )}
            </>
          )}
        </div>
      </ScrollArea>
      )}

      {/* Add Member Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
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
                      "flex items-center gap-3 w-full p-2.5 rounded-lg transition-colors cursor-pointer group hover:bg-muted/50",
                      selectedUserIds.includes(u.id) && "bg-primary/5"
                    )}
                    onClick={() => toggleUserSelection(u.id)}
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
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className={cn(
                "gap-2 px-4 transition-all duration-300",
                selectedUserIds.length > 0 ? "opacity-100 translate-y-0" : "opacity-50 pointer-events-none"
              )}
              onClick={() => setShowAddConfirm(true)}
              disabled={selectedUserIds.length === 0 || isBulkAdding}
            >
              {isBulkAdding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  Add {selectedUserIds.length > 0 ? `${selectedUserIds.length} ` : ''}Member{selectedUserIds.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Confirmation */}
      <ConfirmationDialog
        open={showAddConfirm}
        onOpenChange={setShowAddConfirm}
        onConfirm={handleBulkAdd}
        title="Confirm Adding Members"
        description={`Are you sure you want to add ${selectedUserIds.length === 1
          ? reachableUsers.find(u => u.id === selectedUserIds[0])?.name || '1 member'
          : `${selectedUserIds.length} members`
          } to "${conversation.name}"?`}
        confirmText="Add Members"
      />

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={!!confirmRemoveId}
        onOpenChange={(open) => !open && setConfirmRemoveId(null)}
        onConfirm={() => confirmRemoveId && handleRemoveMember(confirmRemoveId)}
        title="Remove Member"
        description="Are you sure you want to remove this member from the group? They will no longer be able to see new messages."
        confirmText="Remove"
        variant="destructive"
      />

      <ConfirmationDialog
        open={confirmLeaveOpen}
        onOpenChange={setConfirmLeaveOpen}
        onConfirm={handleLeaveGroup}
        title="Leave Group"
        description="Are you sure you want to leave this group? You will lose access to the conversation history."
        confirmText="Leave"
        variant="destructive"
      />

      <ConfirmationDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleDeleteGroup}
        title="Delete Group"
        description={`Are you sure you want to delete "${conversation.name}"? This will permanently remove the group and all its messages for every member. This cannot be undone.`}
        confirmText={isDeletingGroup ? 'Deleting...' : 'Delete'}
        variant="destructive"
      />

      <FilePreviewDialog
        file={previewFile}
        files={previewableFiles}
        onClose={() => setPreviewFile(null)}
      />

    </div>
  );
}
