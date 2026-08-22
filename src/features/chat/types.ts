export type ConversationType = 'dm' | 'group';
export type MessageContentType = 'text' | 'system' | 'file' | 'image';
export type ConversationMemberRole = 'owner' | 'admin' | 'member';

export type ChatEntityType = 'task' | 'issue' | 'milestone' | 'hardware_module' | 'bom_node' | 'eco';

export interface EntityTagRef {
  entityType: ChatEntityType;
  entityId: string;
  projectId: string;
  label: string;
}

export interface ReadReceipt {
  messageId: string;
  userId: string;
  readAt: string;
}

export interface ConversationMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  initials: string;
  role: ConversationMemberRole;
  isOnline: boolean;
  lastSeenAt?: string;
  lastReadAt?: string | null;
  notificationsEnabled?: boolean;
}

export interface MessageAttachment {
  id: string;
  // New backend fields
  name?: string;
  size?: number;
  type?: string;
  // Legacy fields
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  storagePath?: string;
  url?: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
  reactedByMe: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderInitials: string;
  contentType: MessageContentType;
  content: string;
  attachments: MessageAttachment[];
  entityTags?: EntityTagRef[];
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
  deletedAt?: string;
  deletedByName?: string;
  readReceipts?: ReadReceipt[];
  reactions?: MessageReaction[];
  status?: 'pending' | 'sending' | 'sent' | 'delivered' | 'read';
  isOptimistic?: boolean;
  replyToMessageId?: string;
  replyToMessage?: {
    id: string;
    senderName: string;
    content: string;
    contentType: MessageContentType;
    deletedAt?: string;
  };
}

export interface PinnedMessage extends ChatMessage {
  pinnedAt: string;
  pinnedBy: string | null;
}

export interface FavouriteMessage extends ChatMessage {
  favouritedAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string;
  title?: string | null;
  description?: string;
  avatarUrl?: string;
  members: ConversationMember[];
  lastMessage?: {
    content: string;
    senderId?: string;
    senderName: string;
    createdAt: string;
    status?: 'pending' | 'sending' | 'sent' | 'delivered' | 'read';
  };
  lastMessageAt: string;
  createdAt: string;
  unreadCount?: number;
  isFavourite?: boolean;
}

export interface ReachableUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  initials: string;
  role: string;
  isOnline: boolean;
}
