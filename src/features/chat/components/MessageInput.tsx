import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Paperclip, Loader2, X, Smile, File as FileIcon, Users, CheckSquare, AlertCircle, Flag, Cpu, Layers, FileText, ChevronLeft, Plus, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '../stores/useChatStore';
import { chatService } from '@/services/chat.service';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ConversationMember, ChatMessage, ChatEntityType, EntityTagRef } from '../types';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { WifiOff, Clock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { logger } from '@/services/monitoring/logger';
import { useProjectTasks } from '@/hooks/useTasks';
import { useProjectIssues } from '@/hooks/useIssues';
import { useProjectMilestones } from '@/hooks/useMilestones';
import { useProjectModules } from '@/hooks/useModules';
import { useECOList } from '@/hooks/useECOs';
import { useBomTree } from '@/hooks/useBom';
import { fromApiNode, bomFlatAll } from '@/features/projects/components/bomData';
import EntityTagChip from './EntityTagChip';

interface MessageInputProps {
  conversationId: string;
  onMessageSent?: () => void;
  onTyping?: () => void;
  members?: ConversationMember[];
  isGroup?: boolean;
  sendMessage?: (content: string, type?: 'text' | 'file', fileData?: any, replyToMessageId?: string, entityTags?: EntityTagRef[]) => Promise<void>;
  readOnly?: boolean;
  readOnlyNotice?: string | null;
  replyingTo?: ChatMessage | null;
  onCancelReply?: () => void;
}

const MAX_CHARS = 4000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 10;
const MAX_ENTITY_TAGS = 5;

type SlashStage = 'type' | 'project' | 'item';

const ENTITY_TYPE_OPTIONS: { type: ChatEntityType; label: string; Icon: typeof CheckSquare }[] = [
  { type: 'task', label: 'Task', Icon: CheckSquare },
  { type: 'issue', label: 'Issue', Icon: AlertCircle },
  { type: 'milestone', label: 'Milestone', Icon: Flag },
  { type: 'hardware_module', label: 'Hardware Module', Icon: Cpu },
  { type: 'bom_node', label: 'BOM', Icon: Layers },
  { type: 'eco', label: 'ECO', Icon: FileText },
];

const ENTITY_TYPE_LABEL: Record<ChatEntityType, string> = Object.fromEntries(
  ENTITY_TYPE_OPTIONS.map((o) => [o.type, o.label])
) as Record<ChatEntityType, string>;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Build file message content payload (shared for send and queue). */
function buildFileContent(payload: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  url?: string;
  text?: string;
}) {
  return {
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    mimeType: payload.mimeType,
    storagePath: payload.storagePath,
    url: payload.url,
    text: payload.text,
  };
}

export function MessageInput({ conversationId, onMessageSent, onTyping, members, isGroup = false, sendMessage, readOnly = false, readOnlyNotice = null, replyingTo = null, onCancelReply }: MessageInputProps) {
  const isMobile = useIsMobile();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const setDraft = useChatStore((s) => s.setDraft);
  const value = useChatStore((s) => s.draftMessages[conversationId] || '');

  const [isSending, setIsSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const lastTypingRef = useRef(0);
  const dragCounterRef = useRef(0);
  const { user } = useAuth();

  const { isOnline, pendingCount, enqueueText, enqueueFile } = useOfflineQueue(user?.id);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionStartRef = useRef<number>(-1);

  const otherMembers = useMemo(
    () => (members || []).filter((m) => m.id !== user?.id),
    [members, user?.id]
  );

  // Show "Everyone" option in group chats with at least 2 other members
  const showEveryoneOption = useMemo(() => {
    if (!isGroup || otherMembers.length < 2) return false;
    if (mentionQuery === null) return false;
    const q = mentionQuery.toLowerCase();
    const alreadyMentionedEveryone = value.toLowerCase().includes('@everyone');
    return !alreadyMentionedEveryone && 'everyone'.includes(q);
  }, [isGroup, otherMembers.length, mentionQuery, value]);

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const draftLower = value.toLowerCase();
    return otherMembers.filter((m) => {
      const alreadyMentioned = draftLower.includes(`@${m.name.toLowerCase()}`);
      if (alreadyMentioned) return false;
      return m.name.toLowerCase().includes(q);
    });
  }, [mentionQuery, otherMembers, value]);

  // Total items in the mention dropdown (everyone slot + individual members)
  const totalMentionItems = (showEveryoneOption ? 1 : 0) + filteredMentions.length;

  // ── Slash-command entity tag picker ──────────────────────────────────────
  const [slashStage, setSlashStage] = useState<SlashStage | null>(null);
  const [slashSearch, setSlashSearch] = useState('');
  const [slashItemSearch, setSlashItemSearch] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashEntityType, setSlashEntityType] = useState<ChatEntityType | null>(null);
  const [slashProjectId, setSlashProjectId] = useState<string | null>(null);
  const [pendingEntityTags, setPendingEntityTags] = useState<EntityTagRef[]>([]);
  const slashStartRef = useRef<number>(-1);
  const slashSearchInputRef = useRef<HTMLInputElement>(null);

  const { data: conversationProjectId } = useQuery({
    queryKey: ['chat', 'conversationProjectId', conversationId],
    queryFn: () => chatService.getProjectIdForConversation(conversationId),
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000,
  });

  // Only projects every active conversation member belongs to — a tagged entity
  // must be openable by whoever receives it, not just by the sender.
  const projectsQuery = useQuery({
    queryKey: ['chat', 'mutualProjects', conversationId],
    queryFn: () => chatService.getMutualProjects(conversationId),
    enabled: !!conversationId,
    staleTime: 45 * 1000,
  });
  const { data: projectsList } = projectsQuery;

  const itemStageActive = slashStage === 'item';
  const taskItemsQ = useProjectTasks(itemStageActive && slashEntityType === 'task' ? slashProjectId ?? undefined : undefined);
  const issueItemsQ = useProjectIssues(itemStageActive && slashEntityType === 'issue' ? slashProjectId ?? undefined : undefined);
  const milestoneItemsQ = useProjectMilestones(itemStageActive && slashEntityType === 'milestone' ? (slashProjectId ?? '') : '');
  const moduleItemsQ = useProjectModules(itemStageActive && slashEntityType === 'hardware_module' ? (slashProjectId ?? '') : '');
  const ecoItemsQ = useECOList(itemStageActive && slashEntityType === 'eco' ? slashProjectId ?? undefined : undefined);
  const bomTreeQ = useBomTree(itemStageActive && slashEntityType === 'bom_node' ? slashProjectId ?? undefined : undefined);

  const filteredEntityTypes = useMemo(() => {
    if (slashStage !== 'type') return [];
    const q = slashSearch.toLowerCase();
    return ENTITY_TYPE_OPTIONS.filter((o) => o.label.toLowerCase().includes(q));
  }, [slashStage, slashSearch]);

  const projectOptions = useMemo(() => {
    if (slashStage !== 'project') return [];
    const q = slashItemSearch.toLowerCase();
    return (projectsList ?? [])
      .filter((p) => !!p.myRole)
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [slashStage, slashItemSearch, projectsList]);

  const isProjectOptionsLoading = slashStage === 'project' && projectsQuery.isLoading;

  const isItemOptionsLoading = itemStageActive && !!slashEntityType && (
    (slashEntityType === 'task' && taskItemsQ.isLoading) ||
    (slashEntityType === 'issue' && issueItemsQ.isLoading) ||
    (slashEntityType === 'milestone' && milestoneItemsQ.isLoading) ||
    (slashEntityType === 'hardware_module' && moduleItemsQ.isLoading) ||
    (slashEntityType === 'eco' && ecoItemsQ.isLoading) ||
    (slashEntityType === 'bom_node' && bomTreeQ.isLoading)
  );

  const slashProjectName = useMemo(
    () => (slashProjectId ? (projectsList ?? []).find((p) => p.id === slashProjectId)?.name ?? null : null),
    [slashProjectId, projectsList]
  );

  const itemOptions = useMemo(() => {
    if (!itemStageActive || !slashEntityType) return [];
    let opts: { id: string; label: string }[] = [];
    switch (slashEntityType) {
      case 'task':
        opts = (taskItemsQ.data ?? []).map((t: any) => ({ id: t.id, label: t.title }));
        break;
      case 'issue':
        opts = (issueItemsQ.data ?? []).map((i: any) => ({ id: i.id, label: i.title }));
        break;
      case 'milestone':
        opts = (milestoneItemsQ.data ?? []).map((m: any) => ({ id: m.id, label: m.title }));
        break;
      case 'hardware_module':
        opts = (moduleItemsQ.data ?? []).map((m: any) => ({ id: m.id, label: m.name }));
        break;
      case 'eco':
        opts = (ecoItemsQ.data?.data ?? []).map((e: any) => ({ id: e.id, label: `${e.num} — ${e.title}` }));
        break;
      case 'bom_node': {
        const roots = (bomTreeQ.data?.roots ?? []).map((r: any) => fromApiNode(r));
        opts = bomFlatAll(roots).map((n) => ({ id: n.id, label: `${n.pn} — ${n.name}` }));
        break;
      }
    }
    const q = slashItemSearch.toLowerCase();
    return opts.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 30);
  }, [itemStageActive, slashEntityType, slashItemSearch, taskItemsQ.data, issueItemsQ.data, milestoneItemsQ.data, moduleItemsQ.data, ecoItemsQ.data, bomTreeQ.data]);

  useEffect(() => {
    if (slashStage === 'project' || slashStage === 'item') {
      slashSearchInputRef.current?.focus();
    }
  }, [slashStage]);

  const cancelSlash = useCallback(() => {
    setSlashStage(null);
    setSlashSearch('');
    setSlashItemSearch('');
    setSlashEntityType(null);
    setSlashProjectId(null);
    slashStartRef.current = -1;
    setSlashIndex(0);
  }, []);

  // Close any open "@" mention / "/" entity picker when switching conversations —
  // their trigger position and match list refer to the previous conversation.
  useEffect(() => {
    setMentionQuery(null);
    mentionStartRef.current = -1;
    setMentionIndex(0);
    cancelSlash();
  }, [conversationId, cancelSlash]);

  const selectEntityType = (type: ChatEntityType) => {
    const start = slashStartRef.current;
    const el = textareaRef.current;
    if (start >= 0 && el) {
      const before = value.substring(0, start);
      const after = value.substring(el.selectionStart ?? value.length);
      setDraft(conversationId, before + after);
      requestAnimationFrame(() => el.setSelectionRange(start, start));
    }
    slashStartRef.current = -1;
    setSlashSearch('');
    setSlashEntityType(type);
    setSlashItemSearch('');
    setSlashIndex(0);
    if (conversationProjectId) {
      setSlashProjectId(conversationProjectId);
      setSlashStage('item');
    } else {
      setSlashStage('project');
    }
  };

  const selectProject = (project: { id: string; name: string }) => {
    setSlashProjectId(project.id);
    setSlashStage('item');
    setSlashItemSearch('');
    setSlashIndex(0);
  };

  const selectItem = (item: { id: string; label: string }) => {
    if (!slashEntityType || !slashProjectId) return;
    if (pendingEntityTags.length >= MAX_ENTITY_TAGS) {
      toast.warning(`Maximum ${MAX_ENTITY_TAGS} tagged items allowed.`);
      cancelSlash();
      return;
    }
    setPendingEntityTags((prev) => [...prev, { entityType: slashEntityType, entityId: item.id, projectId: slashProjectId, label: item.label }]);
    cancelSlash();
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const removeEntityTag = (index: number) => {
    setPendingEntityTags((prev) => prev.filter((_, i) => i !== index));
  };

  const goBackSlashStage = () => {
    if (slashStage === 'item' && !conversationProjectId) {
      setSlashStage('project');
      setSlashItemSearch('');
      setSlashIndex(0);
    } else {
      cancelSlash();
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const handlePickerSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = slashStage === 'project' ? projectOptions : itemOptions;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (list.length > 0) setSlashIndex((p) => (p + 1) % list.length); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (list.length > 0) setSlashIndex((p) => (p - 1 + list.length) % list.length); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (list.length === 0) return;
      if (slashStage === 'project') selectProject(projectOptions[slashIndex]);
      else selectItem(itemOptions[slashIndex]);
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); cancelSlash(); textareaRef.current?.focus(); return; }
    if (e.key === 'Backspace' && slashItemSearch === '') { e.preventDefault(); goBackSlashStage(); }
  };

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 144) + 'px';
  }, []);

  // Re-measure on layout swaps too: the mobile/desktop branches render structurally
  // different textarea containers, so crossing the breakpoint remounts the textarea
  // DOM node and this effect must rerun to size the fresh node correctly.
  useEffect(() => { resize(); }, [value, resize, isMobile]);

  // Mobile-only: when this screen is entered via a deep link (e.g. tapping a
  // chat notification), the mobile header/bottom-nav chrome collapses away
  // and the message pane's width settles *after* the textarea's first
  // mount/measurement, leaving a stale inline height until something
  // (previously only typing) re-triggers resize(). Re-measure whenever the
  // textarea's own box actually changes size so it self-corrects immediately.
  useEffect(() => {
    if (!isMobile) return;
    const el = textareaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile, resize]);

  // Create and revoke object URLs for file previews to avoid memory leaks
  useEffect(() => {
    const urls = pendingFiles.map((file) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      return isImage || isVideo ? URL.createObjectURL(file) : '';
    });
    setPreviewUrls(urls);
    return () => {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [pendingFiles]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!emojiPickerRef.current?.contains(target) && !emojiButtonRef.current?.contains(target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const handleEmojiSelect = (emoji: any) => {
    const native = emoji.native as string;
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const newValue = value.substring(0, start) + native + value.substring(end);
      if (newValue.length <= MAX_CHARS) {
        setDraft(conversationId, newValue);
        requestAnimationFrame(() => {
          const pos = start + native.length;
          el.setSelectionRange(pos, pos);
        });
      }
    } else {
      setDraft(conversationId, value + native);
    }
    // Picker stays open
  };

  const insertMention = (member: ConversationMember) => {
    const start = mentionStartRef.current;
    const el = textareaRef.current;
    if (start < 0 || !el) return;
    const before = value.substring(0, start);
    const after = value.substring(el.selectionStart);
    const newValue = `${before}@${member.name} ${after}`;
    setDraft(conversationId, newValue);
    setMentionQuery(null);
    mentionStartRef.current = -1;
    setMentionIndex(0);
    requestAnimationFrame(() => {
      const pos = start + member.name.length + 2;
      el.setSelectionRange(pos, pos);
      el.focus();
    });
  };

  const insertEveryoneMention = () => {
    const start = mentionStartRef.current;
    const el = textareaRef.current;
    if (start < 0 || !el) return;
    const before = value.substring(0, start);
    const after = value.substring(el.selectionStart);
    const newValue = `${before}@everyone ${after}`;
    setDraft(conversationId, newValue);
    setMentionQuery(null);
    mentionStartRef.current = -1;
    setMentionIndex(0);
    requestAnimationFrame(() => {
      const pos = start + '@everyone '.length;
      el.setSelectionRange(pos, pos);
      el.focus();
    });
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const newFiles = Array.from(incoming);
    const tooBig = newFiles.filter(f => f.size > MAX_FILE_SIZE);
    if (tooBig.length > 0) {
      toast.error(`${tooBig.length} file(s) exceed 10MB limit and were skipped`);
    }
    const valid = newFiles.filter(f => f.size <= MAX_FILE_SIZE);
    setPendingFiles(prev => {
      const seen = new Set(prev.map(f => `${f.name}-${f.size}-${f.lastModified}`));
      const deduped = valid.filter(f => {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (deduped.length < valid.length) {
        toast.info('Duplicate file(s) were skipped.');
      }
      const combined = [...prev, ...deduped];
      if (combined.length > MAX_FILES) {
        const dropped = combined.length - MAX_FILES;
        const droppedNames = combined.slice(MAX_FILES).map(f => f.name).join(', ');
        toast.warning(`Only ${MAX_FILES} files allowed. Dropped: ${droppedNames || dropped + ' file(s)'}.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (readOnly) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const fileList: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) fileList.push(file);
      }
    }
    if (fileList.length > 0) {
      e.preventDefault();
      const dt = new DataTransfer();
      fileList.forEach(f => dt.items.add(f));
      addFiles(dt.files);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDraggingOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    if (readOnly) return;
    addFiles(e.dataTransfer.files);
  };

  const sendFileMessage = async (file: File, caption?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    if (replyingTo?.id) formData.append('replyToMessageId', replyingTo.id);
    const res = await apiClient.raw.post<{ success: boolean; data: any }>(
      `${ENDPOINTS.CONVERSATIONS.FILE_MESSAGE(conversationId)}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  };

  const handleSend = async () => {
    if (readOnly) return;
    const trimmed = value.trim();
    if ((!trimmed && pendingFiles.length === 0 && pendingEntityTags.length === 0) || isSending) return;
    if (pendingFiles.length > MAX_FILES) {
      toast.warning(`Maximum ${MAX_FILES} files allowed. Remove some before sending.`);
      return;
    }

    setDraft(conversationId, '');
    setMentionQuery(null);
    cancelSlash();

    // ── OFFLINE: enqueue everything locally ──────────────────────────────
    if (!isOnline) {
      try {
        if (trimmed) await enqueueText(conversationId, trimmed);
        if (pendingFiles.length > 0) {
          await Promise.all(pendingFiles.map((file) => enqueueFile(conversationId, file)));
        }
        setPendingFiles([]);
        toast.info('📵 Saved offline — will send when you reconnect');
      } catch (err) {
        logger.error('[MessageInput] Offline queue failed:', err);
        toast.error('Failed to save message offline. Please try again.');
      }
      return;
    }

    // ── ONLINE: send normally ─────────────────────────────────────────────
    const tagsToSend = pendingEntityTags;
    setIsSending(true);
    try {
      if (pendingFiles.length > 0) {
        if (trimmed || tagsToSend.length > 0) {
          if (sendMessage) await sendMessage(trimmed, 'text', undefined, replyingTo?.id, tagsToSend);
          else await chatService.sendMessage(conversationId, trimmed, undefined, replyingTo?.id, tagsToSend);
        }
        for (const file of pendingFiles) {
          await sendFileMessage(file);
        }
        setPendingFiles([]);
      } else {
        if (sendMessage) await sendMessage(trimmed, 'text', undefined, replyingTo?.id, tagsToSend);
        else await chatService.sendMessage(conversationId, trimmed, undefined, replyingTo?.id, tagsToSend);
      }

      setPendingEntityTags([]);
      onMessageSent?.();
      onCancelReply?.();
    } catch (err) {
      logger.error('Failed to send message:', err);
      toast.error('Failed to send message');
      setDraft(conversationId, trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashStage === 'type' && filteredEntityTypes.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(p => (p + 1) % filteredEntityTypes.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex(p => (p - 1 + filteredEntityTypes.length) % filteredEntityTypes.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectEntityType(filteredEntityTypes[slashIndex].type); return; }
      if (e.key === 'Escape') { e.preventDefault(); cancelSlash(); return; }
    }
    if (mentionQuery !== null && totalMentionItems > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(p => (p + 1) % totalMentionItems); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(p => (p - 1 + totalMentionItems) % totalMentionItems); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (showEveryoneOption && mentionIndex === 0) {
          insertEveryoneMention();
        } else {
          const memberIdx = showEveryoneOption ? mentionIndex - 1 : mentionIndex;
          insertMention(filteredMentions[memberIdx]);
        }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); mentionStartRef.current = -1; return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length > MAX_CHARS) return;
    setDraft(conversationId, newValue);

    const now = Date.now();
    if (now - lastTypingRef.current > 2000) { lastTypingRef.current = now; onTyping?.(); }

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPos);

    if (slashStage === null || slashStage === 'type') {
      const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
      if (lastSlashIndex >= 0) {
        const charBefore = lastSlashIndex > 0 ? textBeforeCursor[lastSlashIndex - 1] : ' ';
        const queryText = textBeforeCursor.substring(lastSlashIndex + 1);
        if ((charBefore === ' ' || charBefore === '\n' || lastSlashIndex === 0) && !queryText.includes(' ')) {
          slashStartRef.current = lastSlashIndex;
          setSlashStage('type');
          setSlashSearch(queryText);
          setSlashIndex(0);
          setMentionQuery(null);
          mentionStartRef.current = -1;
          return;
        }
      }
      if (slashStage === 'type') {
        cancelSlash();
      }
    }

    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex >= 0) {
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      const queryText = textBeforeCursor.substring(lastAtIndex + 1);
      if ((charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) && !queryText.includes(' ')) {
        mentionStartRef.current = lastAtIndex;
        setMentionQuery(queryText);
        setMentionIndex(0);
        return;
      }
    }
    setMentionQuery(null);
    mentionStartRef.current = -1;
  };

  const showCharCount = value.length > MAX_CHARS * 0.9;

  return (
    <div
      className={cn(
        'border-t border-border/70 bg-gradient-to-t from-background via-background/95 to-background/80 px-2 md:px-4 py-2 relative',
        isDraggingOver && 'ring-2 ring-primary ring-inset'
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-t-none bg-primary/10 border-2 border-dashed border-primary pointer-events-none">
          <div className="flex flex-col items-center gap-1 text-primary">
            <Paperclip className="h-6 w-6" />
            <span className="text-sm font-medium">Drop files to attach</span>
          </div>
        </div>
      )}

      {/* ── Offline banner ── */}
      {!isOnline && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 font-medium">No internet connection — messages will be queued</span>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {pendingCount} queued
            </span>
          )}
        </div>
      )}

      {readOnly && readOnlyNotice && (
        <div className="mb-2 px-3 py-2 rounded-lg border border-amber-300/30 bg-amber-500/10 text-amber-700 text-xs">
          {readOnlyNotice}
        </div>
      )}

      {replyingTo && (
        <div className="mb-2 px-3 py-2 rounded-lg border border-border/60 bg-muted/40">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Replying to {replyingTo.senderName}
              </p>
              <p className="text-xs truncate">
                {replyingTo.deletedAt
                  ? 'Message deleted'
                  : replyingTo.contentType === 'file'
                    ? 'Attachment'
                    : replyingTo.content}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={onCancelReply}
              aria-label="Cancel reply"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Pending entity tag chips ── */}
      {pendingEntityTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingEntityTags.map((tag, i) => (
            <EntityTagChip key={`${tag.entityType}-${tag.entityId}-${i}`} tag={tag} variant="pending" onRemove={() => removeEntityTag(i)} />
          ))}
        </div>
      )}

      {/* ── Pending files preview grid ── */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingFiles.map((file, i) => {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const previewUrl = (isImage || isVideo) ? previewUrls[i] || null : null;

            return (
              <div
                key={i}
                className="relative group w-16 h-16 rounded-lg border bg-muted overflow-hidden shrink-0 flex items-center justify-center"
              >
                {isImage && previewUrl ? (
                  <img src={previewUrl} alt={file.name} className="w-full h-full object-contain" />
                ) : isVideo && previewUrl ? (
                  <video src={previewUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 p-1.5 w-full h-full">
                    <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="text-[8px] font-bold text-primary bg-primary/10 rounded px-1 py-0.5 uppercase leading-none shrink-0">
                      {file.name.split('.').pop()}
                    </span>
                    <span className="text-[8px] text-muted-foreground text-center leading-tight line-clamp-2 w-full break-all">
                      {file.name.replace(/\.[^.]+$/, '')}
                    </span>
                  </div>
                )}

                {/* Size badge */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate px-0.5">
                  {formatBytes(file.size)}
                </div>

                {/* Remove button */}
                <button
                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                  onClick={() => removeFile(i)}
                  title="Remove"
                  type="button"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}

          {/* +Add more slot (if < 10) */}
          {pendingFiles.length < MAX_FILES && (
            <button
              type="button"
              className="w-16 h-16 rounded-lg border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="Add more files"
            >
              <Paperclip className="h-4 w-4" />
              <span className="text-[9px]">Add</span>
            </button>
          )}

          {/* Count badge */}
          <div className="self-end text-[10px] text-muted-foreground pb-1">
            {pendingFiles.length}/{MAX_FILES}
          </div>
        </div>
      )}

      <div className="relative">
        {/* Mention dropdown */}
        {mentionQuery !== null && totalMentionItems > 0 && (
          <div className="absolute bottom-full mb-1 left-0 w-full max-w-[300px] bg-popover border border-border rounded-lg shadow-lg z-50 max-h-[200px] overflow-y-auto">
            {/* Everyone option — shown only in group chats */}
            {showEveryoneOption && (
              <button
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors border-b border-border/50',
                  mentionIndex === 0 && 'bg-muted'
                )}
                onMouseDown={(e) => { e.preventDefault(); insertEveryoneMention(); }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Users className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <span className="font-semibold text-foreground block">Everyone</span>
                  <span className="text-xs text-muted-foreground">Notify all group members</span>
                </div>
              </button>
            )}
            {filteredMentions.map((member, i) => {
              const itemIndex = (showEveryoneOption ? 1 : 0) + i;
              return (
                <button
                  key={member.id}
                  className={cn('flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors', itemIndex === mentionIndex && 'bg-muted')}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(member); }}
                >
                  <span className="font-medium">{member.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{member.email}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Slash-command entity tag picker */}
        {slashStage !== null && (
          <div className="absolute bottom-full mb-1 left-0 w-full max-w-[300px] bg-popover border border-border rounded-lg shadow-lg z-50 max-h-[260px] overflow-hidden flex flex-col">
            {slashStage !== 'type' && (
              <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border text-xs text-muted-foreground shrink-0">
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); goBackSlashStage(); }}
                  className="p-0.5 rounded hover:bg-muted"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="font-medium text-foreground">{slashEntityType && ENTITY_TYPE_LABEL[slashEntityType]}</span>
                {slashStage === 'item' && slashProjectName && <span>· {slashProjectName}</span>}
              </div>
            )}

            {slashStage === 'type' && (
              <div className="overflow-y-auto">
                {filteredEntityTypes.length === 0 && (
                  <div className="px-3 py-4 text-xs text-center text-muted-foreground">No match</div>
                )}
                {filteredEntityTypes.map((opt, i) => (
                  <button
                    key={opt.type}
                    type="button"
                    className={cn('flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors', i === slashIndex && 'bg-muted')}
                    onMouseDown={(e) => { e.preventDefault(); selectEntityType(opt.type); }}
                  >
                    <opt.Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            )}

            {(slashStage === 'project' || slashStage === 'item') && (
              <>
                <div className="px-2 py-1.5 border-b border-border shrink-0">
                  <input
                    ref={slashSearchInputRef}
                    value={slashItemSearch}
                    onChange={(e) => { setSlashItemSearch(e.target.value); setSlashIndex(0); }}
                    onKeyDown={handlePickerSearchKeyDown}
                    placeholder={slashStage === 'project' ? 'Search projects…' : `Search ${slashEntityType ? ENTITY_TYPE_LABEL[slashEntityType].toLowerCase() : 'items'}…`}
                    className="w-full bg-transparent text-sm px-1 py-0.5 outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div className="overflow-y-auto">
                  {slashStage === 'project' ? (
                    isProjectOptionsLoading ? (
                      <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading projects…
                      </div>
                    ) : projectOptions.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-center text-muted-foreground">No projects found</div>
                    ) : (
                      projectOptions.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          className={cn('flex items-center w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors truncate', i === slashIndex && 'bg-muted')}
                          onMouseDown={(e) => { e.preventDefault(); selectProject(p); }}
                        >
                          {p.name}
                        </button>
                      ))
                    )
                  ) : isItemOptionsLoading ? (
                    <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading {slashEntityType ? ENTITY_TYPE_LABEL[slashEntityType].toLowerCase() : 'items'}…
                    </div>
                  ) : itemOptions.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-center text-muted-foreground">No results</div>
                  ) : (
                    itemOptions.map((opt, i) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={cn('flex items-center w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors truncate', i === slashIndex && 'bg-muted')}
                        onMouseDown={(e) => { e.preventDefault(); selectItem(opt); }}
                      >
                        {opt.label}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-full mb-2 left-0 z-50 shadow-2xl rounded-xl overflow-hidden">
            <Picker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              theme="auto"
              previewPosition="none"
              skinTonePosition="none"
              maxFrequentRows={2}
              perLine={8}
            />
          </div>
        )}

        {/* Hidden inputs — both support multiple */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />

        {/* Input bar */}
        {isMobile ? (
          <div className="mx-auto w-full flex items-center gap-1.5">
            {/* 😊 Emoji */}
            <Button
              ref={emojiButtonRef}
              variant="ghost" size="icon" type="button"
              className={cn(
                'h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-yellow-500 hover:bg-accent/70 transition-colors',
                showEmojiPicker && 'text-yellow-500 bg-yellow-500/10'
              )}
              title="Emoji"
              onClick={() => setShowEmojiPicker(v => !v)}
            >
              <Smile className="h-5 w-5" />
            </Button>

            {/* + Attach */}
            <Button
              variant="ghost" size="icon" type="button"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-colors"
              title="Attach files"
              onClick={() => fileInputRef.current?.click()}
              disabled={readOnly}
            >
              <Plus className="h-5 w-5" />
            </Button>

            {/* Bordered message pill */}
            <div className="flex-1 min-w-0 flex items-center gap-1 rounded-full border border-input bg-background px-4 min-h-[42px] focus-within:ring-2 focus-within:ring-ring/70 transition-all">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Type a message..."
                rows={1}
                className="w-full resize-none overflow-hidden bg-transparent text-sm leading-5 max-h-[140px] placeholder:text-muted-foreground/90 focus-visible:outline-none"
                disabled={readOnly}
              />
              {showCharCount && (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {value.length}/{MAX_CHARS}
                </span>
              )}
            </div>

            {/* Send */}
            <Button
              size="icon" type="button"
              className="h-11 w-11 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90"
              disabled={readOnly || ((!value.trim() && pendingFiles.length === 0 && pendingEntityTags.length === 0) || isSending)}
              onClick={handleSend}
            >
              {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
            </Button>
          </div>
        ) : (
          <div className="mx-auto w-full flex items-center gap-1 rounded-2xl border border-input/80 bg-background/85 backdrop-blur-md px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] focus-within:ring-2 focus-within:ring-ring/70 focus-within:ring-offset-2 ring-offset-background transition-all">

            {/* 😊 Emoji */}
            <Button
              ref={emojiButtonRef}
              variant="ghost" size="icon" type="button"
              className={cn(
                'h-7 w-7 md:h-8 md:w-8 shrink-0 text-muted-foreground hover:text-yellow-500 transition-colors',
                'rounded-full hover:bg-accent/70',
                showEmojiPicker && 'text-yellow-500 bg-yellow-500/10'
              )}
              title="Emoji"
              onClick={() => setShowEmojiPicker(v => !v)}
            >
              <Smile className="h-4 w-4" />
            </Button>

            {/* 📎 File */}
            <Button
              variant="ghost" size="icon" type="button"
              className="h-7 w-7 md:h-8 md:w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-colors"
              title="Attach files"
              onClick={() => fileInputRef.current?.click()}
              disabled={readOnly}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {/* Textarea */}
            <div className="flex-1 min-w-0 relative px-0.5 flex items-center min-h-[28px] md:min-h-[32px]">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={otherMembers.length <= 1 ? 'Type a message...' : 'Type a message... Use @ to mention'}
                rows={1}
                className="w-full resize-none bg-transparent text-sm leading-5 max-h-[140px] placeholder:text-muted-foreground/90 focus-visible:outline-none"
                disabled={readOnly}
              />
              {showCharCount && (
                <span className="absolute bottom-0.5 right-1 text-[10px] text-muted-foreground">
                  {value.length}/{MAX_CHARS}
                </span>
              )}
            </div>

            {/* Send */}
            <Button
              size="icon" type="button"
              className="h-8 w-8 shrink-0 rounded-full bg-primary text-primary-foreground shadow-[0_3px_10px_rgba(0,0,0,0.22)] hover:bg-primary/90"
              disabled={readOnly || ((!value.trim() && pendingFiles.length === 0 && pendingEntityTags.length === 0) || isSending)}
              onClick={handleSend}
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
