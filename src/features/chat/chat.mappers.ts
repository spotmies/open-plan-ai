import type {
  ChatMessage,
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  MessageContentType,
  ConversationType,
  ChatEntityType,
  EntityTagRef,
} from './types';
import { resolveFileUrl } from '@/utils/fileUrl';

const ENTITY_TAG_TYPE_LABEL: Record<ChatEntityType, string> = {
  task: 'Task',
  issue: 'Issue',
  milestone: 'Milestone',
  hardware_module: 'Module',
  bom_node: 'BOM',
  eco: 'ECO',
};

/** Computes initials from a display name: first letter of the first 2 words, or the single letter for a one-word name. */
function computeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

/** Fallback preview text for a message whose content is empty (tag-only message). */
export function entityTagsPreviewText(entityTags: EntityTagRef[] | undefined | null): string {
  if (!entityTags?.length) return '';
  if (entityTags.length === 1) {
    return `${ENTITY_TAG_TYPE_LABEL[entityTags[0].entityType]}: ${entityTags[0].label}`;
  }
  return `${entityTags.length} items tagged`;
}

interface DbProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  initials: string;
  role: string | null;
  last_seen_at?: string | null;
}

interface DbConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  content_type: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  reply_to_message_id?: string | null;
}

interface DbConversation {
  id: string;
  type: string;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export function mapMember(
  dbMember: DbConversationMember,
  profile: DbProfile | undefined
): ConversationMember {
  const rawAvatarUrl = profile?.avatar_url ?? undefined;
  return {
    id: dbMember.user_id,
    name: profile?.name ?? 'Unknown',
    email: profile?.email ?? '',
    avatarUrl: resolveFileUrl(rawAvatarUrl) ?? rawAvatarUrl,
    initials: profile?.initials ?? '??',
    role: dbMember.role as ConversationMemberRole,
    isOnline: false,
    lastSeenAt: profile?.last_seen_at ?? undefined,
  };
}

export function mapMessage(
  dbMsg: (DbMessage & { deleted_by_name?: string | null }) | any,
  senderProfile: DbProfile | undefined | null
): ChatMessage {
  // Handle both snake_case (Supabase/DB) and camelCase (SocketIO/REST API) shapes
  const m = dbMsg as any;
  const senderId = m.sender_id ?? m.senderId ?? m.sender?.id ?? '';
  const conversationId = m.conversation_id ?? m.conversationId ?? '';
  const createdAt = m.created_at ?? m.createdAt ?? new Date().toISOString();
  const updatedAt = m.updated_at ?? m.updatedAt ?? createdAt;
  const deletedAt = m.deleted_at ?? m.deletedAt ?? null;
  const contentType = m.content_type ?? m.contentType ?? 'text';

  // For SocketIO messages, sender info is nested in msg.sender
  const senderName = senderProfile?.name ?? m.sender?.name ?? m.senderName ?? 'Unknown';
  const rawSenderAvatar = senderProfile?.avatar_url ?? m.sender?.avatarUrl ?? m.sender?.avatar_url ?? undefined;
  const senderAvatar = resolveFileUrl(rawSenderAvatar) ?? rawSenderAvatar ?? undefined;
  const senderInitials = senderProfile?.initials ?? m.sender?.initials ?? computeInitials(senderName) ?? '??';

  const fileUrl = m.fileUrl ?? m.file_url ?? null;
  const resolvedFileUrl = fileUrl ? (resolveFileUrl(fileUrl) ?? fileUrl) : undefined;

  return {
    id: m.id,
    conversationId,
    senderId,
    senderName,
    senderAvatar,
    senderInitials,
    contentType: contentType as MessageContentType,
    content: m.content,
    attachments: resolvedFileUrl ? [{
      id: m.id,
      type: contentType === 'image' ? 'image' : 'file',
      url: resolvedFileUrl,
      name: m.fileName ?? m.file_name ?? m.content ?? 'file',
      size: m.fileSize ?? m.file_size ?? 0,
      mimeType: m.fileMimeType ?? m.file_mime_type ?? '',
    }] : (m.attachments ?? []),
    entityTags: m.entityTags ?? m.entity_tags ?? [],
    createdAt,
    updatedAt,
    isEdited: updatedAt !== createdAt && !deletedAt,
    deletedAt: deletedAt ?? undefined,
    deletedByName: m.deleted_by_name ?? m.deletedByName ?? undefined,
    replyToMessageId: m.reply_to_message_id ?? m.replyToMessageId ?? undefined,
  };
}

export function mapConversation(
  dbConv: DbConversation,
  members: ConversationMember[],
  lastMessage?: { content: string; senderName: string; createdAt: string; status?: any },
  currentUserId?: string
): Conversation {
  // For DMs, name is the other person's name
  let name = dbConv.name ?? '';
  if (dbConv.type === 'dm' && currentUserId) {
    const other = members.find((m) => m.id !== currentUserId);
    if (other) name = other.name;
  }

  return {
    id: dbConv.id,
    type: dbConv.type as ConversationType,
    name,
    description: dbConv.description ?? undefined,
    avatarUrl: dbConv.avatar_url ?? undefined,
    members,
    lastMessage,
    lastMessageAt: dbConv.last_message_at,
    createdAt: dbConv.created_at,
  };
}
