import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { Conversation, ChatMessage, ReachableUser, MessageReaction, EntityTagRef, PinnedMessage, FavouriteMessage } from '@/features/chat/types';
import { resolveFileUrl } from '@/utils/fileUrl';
import type { Project } from '@/types';

/** Caches blob URLs for already-fetched chat attachments, keyed by their source URL, so repeat opens reuse the local copy instead of re-fetching. */
const attachmentBlobUrlCache = new Map<string, string>();

const OPENED_ATTACHMENTS_STORAGE_KEY = 'chat:openedAttachments';

/** Persists which attachment URLs have already been opened/downloaded, so the UI can stop showing a "download" affordance for them across page reloads. */
function loadOpenedAttachments(): Set<string> {
  try {
    const raw = localStorage.getItem(OPENED_ATTACHMENTS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

const openedAttachments = loadOpenedAttachments();

function persistOpenedAttachments(): void {
  try {
    localStorage.setItem(OPENED_ATTACHMENTS_STORAGE_KEY, JSON.stringify([...openedAttachments]));
  } catch {
    // localStorage unavailable (private mode, quota) — in-memory tracking still works for this session.
  }
}

function markAttachmentOpened(url: string): void {
  if (!openedAttachments.has(url)) {
    openedAttachments.add(url);
    persistOpenedAttachments();
  }
}

/** Computes initials from a display name: first letter of the first 2 words, or the single letter for a one-word name. */
function computeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

/** Map backend MessageResponse (camelCase) to frontend ChatMessage (flat senderId). */
function mapChatMessage(raw: any): ChatMessage {
  const fileUrl = raw.fileUrl ?? raw.file_url ?? null;
  const resolvedFileUrl = fileUrl ? (resolveFileUrl(fileUrl) ?? fileUrl) : undefined;
  const createdAt = raw.createdAt ?? raw.created_at ?? new Date().toISOString();
  const updatedAt = raw.updatedAt ?? raw.updated_at ?? createdAt;
  const deletedAt = raw.deletedAt ?? raw.deleted_at ?? undefined;

  return {
    id: raw.id,
    conversationId: raw.conversationId ?? raw.conversation_id ?? '',
    senderId: raw.senderId ?? raw.sender_id ?? raw.sender?.id ?? '',
    senderName: raw.senderName ?? raw.sender?.name ?? raw.sender_name ?? 'Unknown',
    senderAvatar: resolveFileUrl(raw.senderAvatar ?? raw.sender?.avatarUrl ?? raw.sender?.avatar_url) ?? raw.senderAvatar ?? raw.sender?.avatarUrl ?? undefined,
    senderInitials: raw.senderInitials ?? raw.sender?.initials ?? computeInitials(raw.sender?.name ?? ''),
    contentType: (raw.contentType ?? raw.content_type ?? 'text') as any,
    content: raw.content ?? '',
    attachments: resolvedFileUrl ? [{
      id: raw.id,
      type: (raw.contentType ?? raw.content_type ?? 'file') === 'image' ? 'image' : 'file',
      url: resolvedFileUrl,
      name: raw.fileName ?? raw.file_name ?? raw.content ?? 'file',
      size: raw.fileSize ?? raw.file_size ?? 0,
      mimeType: raw.fileMimeType ?? raw.file_mime_type ?? '',
    }] : (raw.attachments ?? []),
    entityTags: raw.entityTags ?? raw.entity_tags ?? [],
    createdAt,
    updatedAt,
    isEdited: updatedAt !== createdAt && !deletedAt,
    deletedAt,
    replyToMessageId: raw.replyToMessageId ?? raw.reply_to_message_id ?? undefined,
  };
}

/** Pulls {fileName, url, mimeType} out of a file/image message, handling both the new attachments[] shape and legacy JSON-encoded content. */
function extractForwardableFile(message: ChatMessage): { fileName: string; url: string; mimeType?: string } | null {
  if (message.attachments?.length) {
    const a = message.attachments[0] as any;
    const url = a.url;
    if (!url) return null;
    return { fileName: a.name ?? a.fileName ?? 'file', url, mimeType: a.mimeType ?? a.type };
  }
  try {
    const parsed = JSON.parse(message.content);
    if (parsed.fileName && parsed.url) {
      return { fileName: parsed.fileName, url: parsed.url, mimeType: parsed.mimeType };
    }
  } catch {
    // legacy content wasn't JSON — no file info available
  }
  return null;
}

function mapPinnedMessage(raw: any): PinnedMessage {
  return {
    ...mapChatMessage(raw),
    pinnedAt: raw.pinnedAt ?? raw.pinned_at ?? new Date().toISOString(),
    pinnedBy: raw.pinnedBy ?? raw.pinned_by ?? null,
  };
}

function mapFavouriteMessage(raw: any): FavouriteMessage {
  return {
    ...mapChatMessage(raw),
    favouritedAt: raw.favouritedAt ?? raw.favourited_at ?? new Date().toISOString(),
  };
}

/** Map the backend ConversationResponse shape to the frontend Conversation type. */
function mapConversation(raw: any): Conversation {
  const members = (raw.members ?? []).map((m: any) => {
    const rawAvatarUrl = m.avatarUrl ?? m.avatar_url ?? null;
    return {
      id: m.userId ?? m.id,
      userId: m.userId ?? m.id,
      name: m.name ?? '',
      email: m.email ?? '',
      avatarUrl: resolveFileUrl(rawAvatarUrl) ?? rawAvatarUrl ?? undefined,
      initials: m.initials ?? computeInitials(m.name ?? ''),
      role: m.role ?? 'member',
      lastSeenAt: m.lastSeenAt ?? m.last_seen_at ?? null,
      lastReadAt: m.lastReadAt ?? m.last_read_at ?? null,
      joinedAt: m.joinedAt ?? m.joined_at ?? null,
      leftAt: m.leftAt ?? m.left_at ?? null,
      notificationsEnabled: m.notificationsEnabled ?? m.notifications_enabled ?? true,
    };
  });

  const rawConvAvatarUrl = raw.avatarUrl ?? raw.avatar_url ?? null;
  return {
    id: raw.id,
    type: raw.isGroupChat ? 'group' : 'dm',
    name: raw.title ?? raw.name ?? '',
    title: raw.title ?? raw.name ?? null,
    description: raw.description ?? undefined,
    avatarUrl: resolveFileUrl(rawConvAvatarUrl) ?? rawConvAvatarUrl ?? undefined,
    members,
    lastMessage: raw.lastMessage
      ? {
          content: raw.lastMessage.content,
          senderId: raw.lastMessage.senderId ?? undefined,
          senderName: raw.lastMessage.senderName ?? '',
          createdAt: raw.lastMessage.createdAt,
        }
      : undefined,
    lastMessageAt: raw.updatedAt ?? raw.lastMessageAt ?? raw.createdAt ?? new Date().toISOString(),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    unreadCount: raw.unreadCount ?? 0,
    isFavourite: raw.isFavourite ?? raw.is_favourite ?? false,
  };
}

/** Dispatched when the current user is added to conversation_members so chat UI can re-check send access. */
export const CHAT_ACCESS_INVALIDATE_EVENT = 'openplan-invalidate-conversation-access';

export const chatService = {
  async getConversationAccessState(
    _conversationId: string
  ): Promise<{ readOnly: boolean; leftAt: string | null; joinedAt: string | null }> {
    return { readOnly: false, leftAt: null, joinedAt: new Date().toISOString() };
  },

  async getConversations(): Promise<Conversation[]> {
    const data = await apiClient.get<any[]>(ENDPOINTS.CONVERSATIONS.LIST);
    return (data || []).map(mapConversation);
  },

  async getConversationById(conversationId: string): Promise<Conversation> {
    const data = await apiClient.get<any>(ENDPOINTS.CONVERSATIONS.BY_ID(conversationId));
    return mapConversation(data);
  },

  async getOrCreateDM(otherUserId: string): Promise<string> {
    const data = await apiClient.post<any>(ENDPOINTS.CONVERSATIONS.CREATE, {
      type: 'direct',
      memberIds: [otherUserId],
    });
    return mapConversation(data).id;
  },

  async createGroup(
    name: string,
    description: string | undefined,
    memberIds: string[],
    avatarUrl?: string
  ): Promise<string> {
    const data = await apiClient.post<any>(ENDPOINTS.CONVERSATIONS.CREATE, {
      type: 'group',
      name,
      description,
      memberIds,
      avatarUrl,
    });
    return mapConversation(data).id;
  },

  async getMessages(
    conversationId: string,
    options?: { before?: string; limit?: number }
  ): Promise<ChatMessage[]> {
    const query = new URLSearchParams();
    if (options?.before) query.set('before', options.before);
    if (options?.limit) query.set('limit', String(options.limit));
    const qs = query.toString() ? '?' + query.toString() : '';
    const data = await apiClient.get<any[]>(ENDPOINTS.CONVERSATIONS.MESSAGES(conversationId) + qs);
    return (data || []).map(mapChatMessage);
  },

  async sendMessage(
    conversationId: string,
    content: string,
    _userId?: string,
    replyToMessageId?: string,
    entityTags?: EntityTagRef[]
  ): Promise<ChatMessage> {
    const data = await apiClient.post<any>(ENDPOINTS.CONVERSATIONS.MESSAGES(conversationId), {
      content,
      type: 'text',
      replyToMessageId: replyToMessageId || null,
      entityTags: entityTags?.length ? entityTags : undefined,
    });
    return mapChatMessage(data);
  },

  /**
   * Forwards a message to another conversation. Text messages are re-sent as-is;
   * file/image messages are re-fetched from their stored URL and re-uploaded, since
   * there's no "clone by reference" endpoint on the backend — only direct file upload.
   */
  async forwardMessage(targetConversationId: string, message: ChatMessage): Promise<ChatMessage> {
    const isFileMessage = message.contentType === 'file' || message.contentType === 'image';
    const fileInfo = isFileMessage ? extractForwardableFile(message) : null;

    if (!fileInfo) {
      return this.sendMessage(targetConversationId, message.content);
    }

    const response = await fetch(fileInfo.url);
    if (!response.ok) throw new Error('Failed to fetch attachment for forwarding');
    const blob = await response.blob();
    const file = new File([blob], fileInfo.fileName, { type: fileInfo.mimeType || blob.type });

    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.raw.post<{ success: boolean; data: any }>(
      ENDPOINTS.CONVERSATIONS.FILE_MESSAGE(targetConversationId),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return mapChatMessage(res.data.data);
  },

  async editMessage(messageId: string, newContent: string): Promise<void> {
    await apiClient.patch(ENDPOINTS.MESSAGES.UPDATE(messageId), { content: newContent });
  },

  async deleteMessage(messageId: string, _senderName: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.MESSAGES.DELETE(messageId));
  },

  async deleteMessageForMe(messageId: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.MESSAGES.DELETE_FOR_ME(messageId));
  },

  async markConversationAsRead(conversationId: string): Promise<void> {
    await apiClient.patch(ENDPOINTS.CONVERSATIONS.READ(conversationId), {});
  },

  async updateNotificationSettings(conversationId: string, enabled: boolean): Promise<void> {
    await apiClient.patch(ENDPOINTS.CONVERSATIONS.NOTIFICATIONS(conversationId), { enabled });
  },

  async getMembers(conversationId: string): Promise<unknown[]> {
    return apiClient.get(ENDPOINTS.CONVERSATIONS.MEMBERS(conversationId));
  },

  /** Projects every active member of this conversation belongs to — used to scope the "/" entity-tag picker. */
  async getMutualProjects(conversationId: string): Promise<Project[]> {
    return apiClient.get<Project[]>(ENDPOINTS.CONVERSATIONS.MUTUAL_PROJECTS(conversationId));
  },

  async addMemberToGroup(conversationId: string, userId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.CONVERSATIONS.MEMBERS(conversationId), { userId });
  },

  async addMembersToGroup(conversationId: string, userIds: string[]): Promise<void> {
    await Promise.all(userIds.map((uid) => this.addMemberToGroup(conversationId, uid)));
  },

  async removeMemberFromGroup(conversationId: string, userId: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.CONVERSATIONS.MEMBER(conversationId, userId));
  },

  async deleteConversation(conversationId: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.CONVERSATIONS.BY_ID(conversationId));
  },

  async toggleConversationFavourite(conversationId: string): Promise<{ action: 'added' | 'removed' }> {
    return apiClient.post(ENDPOINTS.CONVERSATIONS.FAVOURITE_TOGGLE(conversationId), {});
  },

  async hideConversation(conversationId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.CONVERSATIONS.HIDE(conversationId), {});
  },

  async updateMemberRole(
    conversationId: string,
    userId: string,
    role: 'admin' | 'member'
  ): Promise<void> {
    await apiClient.patch(ENDPOINTS.CONVERSATIONS.MEMBER(conversationId, userId), { role });
  },

  async updateGroupDetails(
    conversationId: string,
    updates: { name?: string; description?: string; avatar_url?: string | null }
  ): Promise<void> {
    await apiClient.patch(ENDPOINTS.CONVERSATIONS.BY_ID(conversationId), {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.avatar_url !== undefined && { avatarUrl: updates.avatar_url }),
    });
  },

  async searchUsers(query: string): Promise<ReachableUser[]> {
    return apiClient.get(`${ENDPOINTS.USERS.SEARCH}?q=${encodeURIComponent(query)}`);
  },

  async getReachableUsers(orgId?: string): Promise<ReachableUser[]> {
    try {
      const params = orgId
        ? `?q=&limit=100&orgId=${encodeURIComponent(orgId)}`
        : '?q=&limit=100';
      const users: ReachableUser[] = await apiClient.get(`${ENDPOINTS.USERS.SEARCH}${params}`);
      return users.map((u) => ({
        ...u,
        avatarUrl: resolveFileUrl(u.avatarUrl) ?? u.avatarUrl,
      }));
    } catch {
      return [];
    }
  },

  async getReactions(
    messageIds: string[],
    _currentUserId: string
  ): Promise<Record<string, MessageReaction[]>> {
    if (messageIds.length === 0) return {};
    const ids = messageIds.join(',');
    return apiClient.get(`${ENDPOINTS.REACTIONS.BULK}?ids=${ids}`);
  },

  async toggleReaction(messageId: string, emoji: string): Promise<void> {
    await apiClient.post(ENDPOINTS.REACTIONS.TOGGLE(messageId), { emoji });
  },

  async pinMessage(conversationId: string, messageId: string): Promise<PinnedMessage> {
    const data = await apiClient.post<any>(ENDPOINTS.PINS.TOGGLE(conversationId, messageId), {});
    return mapPinnedMessage(data);
  },

  async unpinMessage(conversationId: string, messageId: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.PINS.TOGGLE(conversationId, messageId));
  },

  async getPinnedMessages(conversationId: string): Promise<PinnedMessage[]> {
    const data = await apiClient.get<any[]>(ENDPOINTS.PINS.LIST(conversationId));
    return (data || []).map(mapPinnedMessage);
  },

  async toggleFavourite(messageId: string): Promise<{ action: 'added' | 'removed' }> {
    return apiClient.post(ENDPOINTS.FAVOURITES.TOGGLE(messageId), {});
  },

  async getFavouriteMessages(conversationId: string): Promise<FavouriteMessage[]> {
    const data = await apiClient.get<any[]>(ENDPOINTS.FAVOURITES.LIST(conversationId));
    return (data || []).map(mapFavouriteMessage);
  },

  async getAllFavouriteMessages(): Promise<FavouriteMessage[]> {
    const data = await apiClient.get<any[]>(ENDPOINTS.FAVOURITES.LIST_ALL);
    return (data || []).map(mapFavouriteMessage);
  },

  async getSharedFiles(
    conversationId: string
  ): Promise<
    { fileName: string; fileSize: number; mimeType: string; url?: string; storagePath?: string; createdAt: string; senderName?: string }[]
  > {
    const data = await apiClient.get<any[]>(ENDPOINTS.CONVERSATIONS.FILES(conversationId));
    return (data || []).map((f: any) => ({
      fileName: f.fileName ?? '',
      fileSize: f.fileSize ?? 0,
      mimeType: f.fileMimeType ?? '',
      url: f.fileUrl ? (resolveFileUrl(f.fileUrl) ?? f.fileUrl) : undefined,
      storagePath: f.fileUrl ?? undefined,
      createdAt: f.createdAt ?? '',
      senderName: f.senderName || undefined,
    }));
  },

  async getChatAttachmentDownloadUrl(file: {
    storagePath?: string;
    url?: string;
    fileName?: string;
  }): Promise<string> {
    if (file.url) return file.url;
    throw new Error('Attachment URL is not available');
  },

  /** Whether this attachment URL has already been opened/downloaded — used to hide the download affordance for it. */
  isAttachmentOpened(url: string): boolean {
    return openedAttachments.has(url);
  },

  /** Marks an attachment URL as opened/downloaded, e.g. after a plain `<a download>` click. */
  markAttachmentOpened(url: string): void {
    markAttachmentOpened(url);
  },

  /**
   * Opens a chat attachment for viewing, reusing a cached blob URL on repeat clicks so
   * re-opening a file doesn't re-trigger the browser's save-to-disk download every time.
   */
  async openChatAttachment(file: { fileName: string; url?: string }): Promise<void> {
    if (!file.url) return;

    const cached = attachmentBlobUrlCache.get(file.url);
    if (cached) {
      window.open(cached, '_blank', 'noopener,noreferrer');
      markAttachmentOpened(file.url);
      return;
    }

    try {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error('Failed to fetch attachment');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      attachmentBlobUrlCache.set(file.url, objectUrl);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // CORS or network failure — fall back to opening the original URL directly.
      window.open(file.url, '_blank', 'noopener,noreferrer');
    }
    markAttachmentOpened(file.url);
  },

  async downloadChatAttachment(file: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath?: string;
    url?: string;
  }): Promise<void> {
    const downloadUrl = await this.getChatAttachmentDownloadUrl(file);

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Failed to download attachment');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = file.fileName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // fetch()+blob() can be blocked by CORS on the file host even though the
      // file itself is reachable — fall back to a direct navigation, which
      // isn't subject to CORS, so the browser can still open/save the file.
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = file.fileName;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  },

  /** Uploads to storage and returns the raw "serve:" reference — store this as-is; resolve for display with resolveFileUrl(). */
  async uploadGroupAvatar(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await apiClient.raw.post<{ success: boolean; data: { avatarUrl: string } }>(
      ENDPOINTS.UPLOADS.GROUP_AVATAR,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.data.avatarUrl;
  },

  async sendSystemMessage(conversationId: string, content: string): Promise<void> {
    await apiClient.post(ENDPOINTS.CONVERSATIONS.MESSAGES(conversationId), {
      content,
      type: 'system',
    });
  },

  /** Same wire shape as sendSystemMessage, but returns the created message — a call-history card needs its id right away to edit in place once the call ends. */
  async sendCallCard(conversationId: string, content: string): Promise<ChatMessage> {
    const data = await apiClient.post<any>(ENDPOINTS.CONVERSATIONS.MESSAGES(conversationId), {
      content,
      type: 'system',
    });
    return mapChatMessage(data);
  },

  // Project chat group: lazily created on first "Start Chat" click, keyed by project id.
  async ensureProjectGroup(projectId: string): Promise<string> {
    const data = await apiClient.post<any>(ENDPOINTS.PROJECTS.CHAT(projectId), {});
    return data.conversationId;
  },

  async getProjectGroupConversationId(projectId: string): Promise<string | null> {
    const data = await apiClient.get<any>(ENDPOINTS.PROJECTS.CHAT(projectId));
    return data?.conversationId ?? null;
  },

  async getProjectIdForConversation(conversationId: string): Promise<string | null> {
    const data = await apiClient.get<any>(ENDPOINTS.CONVERSATIONS.BY_ID(conversationId));
    return data?.projectId ?? data?.project_id ?? null;
  },

  async syncProjectGroupMembers(_projectId: string): Promise<void> {
    // No-op — newly added project members are pulled into the group chat
    // lazily, the next time anyone opens the chat for that project.
  },

  async retainProjectChatMembershipAfterRemoval(
    _projectId: string,
    _userIds: string[]
  ): Promise<void> {
    // No-op — removing someone from a project intentionally leaves their
    // chat membership untouched unless the caller explicitly removes them too.
  },

  async forceRemoveProjectChatMembers(projectId: string, userIds: string[]): Promise<void> {
    const conversationId = await this.getProjectGroupConversationId(projectId);
    if (!conversationId) return;
    await Promise.all(userIds.map((userId) => this.removeMemberFromGroup(conversationId, userId)));
  },
};
