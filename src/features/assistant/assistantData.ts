import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Flag,
  GitPullRequest,
  LayoutGrid,
  Layers,
  ListChecks,
  Search,
  Shield,
  Sparkles,
  UserPlus,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import type { Project } from '@/types';

export type AssistantCategoryId = 'ask' | 'act' | 'build';

export interface AssistantCategoryMeta {
  id: AssistantCategoryId;
  label: string;
  title: string;
  icon: LucideIcon;
  description: string;
  /** Not yet wired to a real backend — kept in the data model but not rendered until then. */
  hidden?: boolean;
}

export const ASSISTANT_CATEGORIES: AssistantCategoryMeta[] = [
  {
    id: 'ask',
    label: 'Ask',
    title: 'Ask',
    icon: Search,
    description: 'Status, blockers, BOM health, changes — answered live and traceable.',
  },
  {
    id: 'act',
    label: 'Act',
    title: 'Act',
    icon: Wand2,
    description: 'Create tasks, raise issues, shift gates, import a BOM revision.',
    hidden: true,
  },
  {
    id: 'build',
    label: 'Build',
    title: 'Build',
    icon: LayoutGrid,
    description: 'Stand up a whole project — or just a requirements set — from a PRD, a BOM, and a schedule.',
    hidden: true,
  },
];

export interface AssistantSuggestion {
  id: string;
  category: AssistantCategoryId;
  icon: LucideIcon;
  text: string;
}

export const ASSISTANT_SUGGESTIONS: AssistantSuggestion[] = [
  // Act
  { id: 'act-create-task', category: 'act', icon: ClipboardCheck, text: 'Create a task "power tree review" under Power module, assign Sam, due Friday' },
  { id: 'act-move-gate', category: 'act', icon: Flag, text: 'Move the DVT gate to March 12' },
  { id: 'act-assign-backlog', category: 'act', icon: UserPlus, text: 'Assign all unassigned firmware tasks to the embedded team' },
  { id: 'act-acceptance-criteria', category: 'act', icon: ClipboardCheck, text: 'Generate acceptance criteria for SYS-006' },
  { id: 'act-check-conflicts', category: 'act', icon: Shield, text: 'Check Signal Processing requirements for conflicts' },
  // Build
  { id: 'build-new-project', category: 'build', icon: LayoutGrid, text: 'Create a new project from these documents' },
  { id: 'build-requirements', category: 'build', icon: LayoutGrid, text: 'Create requirements for this project from these notes' },
];

/**
 * Ask-category suggestions, generated from the org's real projects instead
 * of a fixed example project name. Spreads the project-specific templates
 * across up to the first 3 projects (round-robin) for variety when the org
 * has more than one; the two scope-agnostic templates always default to
 * "All projects" (AssistantPanel's initial composer scope) so they don't
 * need a project name at all. Returns [] when there are no projects yet —
 * callers should show an empty state instead of this list in that case.
 */
export function buildAskSuggestions(projects: Pick<Project, 'name'>[]): AssistantSuggestion[] {
  if (projects.length === 0) return [];
  const nameAt = (i: number) => projects[i % projects.length].name;
  return [
    { id: 'ask-status', category: 'ask', icon: Activity, text: `What's the status of ${nameAt(0)}?` },
    { id: 'ask-blocking', category: 'ask', icon: Shield, text: `What's blocking ${nameAt(1)}?` },
    { id: 'ask-req-coverage', category: 'ask', icon: ListChecks, text: `How's requirements coverage looking for ${nameAt(2)}?` },
    { id: 'ask-single-sourced', category: 'ask', icon: Layers, text: 'Which BOM lines are single-sourced?' },
    { id: 'ask-req-rework', category: 'ask', icon: Sparkles, text: 'Which requirements need rework before approval?' },
  ];
}

// ─── Real conversation/message types (Phase 1 — Ask, read-only) ───────────────
// Replaces the earlier mock array below — the assistant now talks to a real
// backend (src/services/assistant.service.ts).

/** Matches the backend's ai_conversations.scope enum exactly (lowercase). */
export type BackendAiScope = 'project' | 'all_projects' | 'bom';

export const ASSISTANT_SCOPE_OPTIONS = ['This project', 'All projects', 'This BOM'] as const;
export type AssistantScope = (typeof ASSISTANT_SCOPE_OPTIONS)[number];

export function scopeLabelToBackend(label: AssistantScope): BackendAiScope {
  if (label === 'All projects') return 'all_projects';
  if (label === 'This BOM') return 'bom';
  return 'project';
}

export function backendScopeToLabel(scope: BackendAiScope): AssistantScope {
  if (scope === 'all_projects') return 'All projects';
  if (scope === 'bom') return 'This BOM';
  return 'This project';
}

// ─── Focus entities: multi-select bias layered on top of scope ────────────────
// 'bom' used to be the only entity with its own scope toggle even though the
// backend already supported querying all of these regardless of scope — see
// [[assistant-scope-multiselect-paused]]. New conversations always send
// scope 'project'/'all_projects' plus an optional focusEntities array;
// `AiConversationFocusEntity` on the backend is the source of truth this list
// must match (ai-conversations.types.ts).
export const ASSISTANT_FOCUS_ENTITIES = [
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'issues', label: 'Issues', icon: AlertTriangle },
  { id: 'milestones', label: 'Milestones', icon: Flag },
  { id: 'hardware_modules', label: 'Modules', icon: LayoutGrid },
  { id: 'bom_nodes', label: 'BOM', icon: Layers },
  { id: 'ecos', label: 'ECO', icon: GitPullRequest },
] as const;
export type AssistantFocusEntity = (typeof ASSISTANT_FOCUS_ENTITIES)[number]['id'];

/** Same scope labels, but resolves 'project'/'bom' to the actual project name when known — matches AssistantScopePopover's label. */
export function resolveConversationScopeLabel(scope: BackendAiScope, projectName?: string): string {
  if (scope === 'all_projects') return 'All projects';
  if (!projectName) return backendScopeToLabel(scope);
  return scope === 'bom' ? `${projectName} · BOM` : projectName;
}

export type AssistantMessageRole = 'user' | 'assistant' | 'tool';

// Ad-hoc file/image attached to the Ask composer — matches the backend's
// AiMessageAttachment (ai-conversations.types.ts). No relation to project
// "Files" attachments; these are ephemeral turn inputs only.
export interface AiMessageAttachment {
  id: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
}

export interface AssistantMessage {
  id: string;
  // Null only for the very first message of a conversation. Editing a user
  // message inserts a new sibling with the same parentId rather than
  // mutating in place — see lib/messageBranches.ts for how the default
  // branch (and version nav) is reconstructed from this.
  parentId: string | null;
  role: AssistantMessageRole;
  content: string | null;
  attachments?: AiMessageAttachment[] | null;
  // Raw backend tool-call payload (ai_messages.tool_calls). Shape depends on
  // role: an assistant message that called a tool carries
  // AssistantToolCall[]; the tool-role message that resolves a paused
  // ask_user call carries a single { toolCallId, name } marker. Untyped here
  // since only the ask_user recap below consumes it.
  toolCalls?: unknown;
  createdAt: string;
}

// ─── present_card (see backend presentCard.tool.ts, the authoritative shape) ──

export type CardSeverity = 'critical' | 'major' | 'minor' | 'trivial';
/** 'danger' for blockers/risks/overdue-heavy cards — purely cosmetic, set server-side from the model's present_card call. */
export type CardTone = 'default' | 'danger';
/** Matches the backend's real projects.stage enum exactly — never the design mock's fabricated EVT/DVT/PVT/MP gate names. */
export type ProjectStage = 'concept' | 'design' | 'development' | 'testing' | 'production';

export interface CardItem {
  id: string;
  title: string;
  severity?: CardSeverity;
  contextLabel?: string;
  dueDate?: string;
  assignees?: string[];
}

export type BomCardFlag = 'single_sourced' | 'long_lead' | 'missing_mfr_pn' | 'missing_approval';

export interface BomCardItem {
  id: string;
  partNumber: string;
  name: string;
  manufacturer?: string;
  flag: BomCardFlag;
  /** Short precomputed display detail, e.g. "16w" for a long-lead part. */
  flagDetail?: string;
}

interface AssistantCardBase {
  title: string;
  badge?: string;
  tone?: CardTone;
  itemsLabel?: string;
  emptyText?: string;
  followUps?: string[];
  /** Computed server-side from the turn's actual tool calls — never model-supplied. */
  sources: string[];
}

export interface AssistantStatusCard extends AssistantCardBase {
  type: 'status';
  items: CardItem[];
  metricValue: number;
  metricLabel?: string;
  taskCount?: { completed: number; total: number };
  /** Only set when the model actually fetched the real projects row this turn. */
  stage?: ProjectStage;
}

export interface AssistantListCard extends AssistantCardBase {
  type: 'list';
  items: CardItem[];
}

export interface AssistantBomCard extends AssistantCardBase {
  type: 'bom';
  items: BomCardItem[];
  totalLines: number;
  clearToBuildPct: number;
  rolledUpCost?: number;
  singleSourcedCount: number;
  longLeadCount: number;
  missingMfrPnCount: number;
  missingApprovalCount: number;
}

export type AssistantCard = AssistantStatusCard | AssistantListCard | AssistantBomCard;

/**
 * A present_card result is persisted like any other tool message (role='tool',
 * content = JSON.stringify(card)) — this is what tells the transcript to
 * render it as a card instead of hiding it as tool-call plumbing.
 */
export function isPresentCardMessage(message: AssistantMessage): boolean {
  if (message.role !== 'tool' || !message.content) return false;
  try {
    const parsed = JSON.parse(message.content) as { type?: unknown };
    return parsed?.type === 'status' || parsed?.type === 'list' || parsed?.type === 'bom';
  } catch {
    return false;
  }
}

export interface AskUserOption {
  label: string;
  description: string;
}

export interface AskUserQuestion {
  header: string;
  question: string;
  options: AskUserOption[];
  multiSelect: boolean;
}

/**
 * True for the role='tool' message that resolves a paused ask_user call —
 * created either by a real POST /answer or by the backend's 24h auto-expiry
 * path (see ai-conversations.service.ts answerQuestion/maybeExpirePendingQuestion).
 * Like present_card, this is content the transcript should show, not hidden
 * tool-call plumbing.
 */
export function isAskUserAnswerMessage(message: AssistantMessage): boolean {
  if (message.role !== 'tool') return false;
  const marker = message.toolCalls as { name?: string } | null | undefined;
  return !!marker && !Array.isArray(marker) && marker.name === 'ask_user';
}

/**
 * Recovers the original question set from the assistant message that made
 * the ask_user tool call (found via the answer message's parentId) — the
 * answer message itself only persists the toolCallId, not the question
 * text/options (see backend's askUser.tool.ts).
 */
export function extractAskUserQuestions(message: AssistantMessage | undefined): AskUserQuestion[] | null {
  if (!message || message.role !== 'assistant') return null;
  const calls = message.toolCalls as Array<{ function?: { name?: string; arguments?: string } }> | null;
  if (!Array.isArray(calls)) return null;
  const call = calls.find((c) => c?.function?.name === 'ask_user');
  if (!call?.function?.arguments) return null;
  try {
    return (JSON.parse(call.function.arguments) as { questions: AskUserQuestion[] }).questions;
  } catch {
    return null;
  }
}

export interface AskUserRecap {
  question: AskUserQuestion;
  answer: string;
}

/**
 * Pairs each original question with the text the user actually picked, by
 * position — the answer message's content is `${header}: ${selected}` lines
 * in the same order the questions were asked (see AssistantQuestionCard's
 * handleSubmit and the backend's answerQuestion). Returns null for the
 * 24h-expiry notice, which isn't in that shape — callers should fall back to
 * showing the raw content in that case.
 */
export function pairAskUserAnswers(questions: AskUserQuestion[], content: string | null): AskUserRecap[] | null {
  if (!content) return null;
  const lines = content.split('\n');
  if (lines.length !== questions.length) return null;
  return questions.map((question, i) => {
    const prefix = `${question.header}: `;
    const line = lines[i] ?? '';
    return { question, answer: line.startsWith(prefix) ? line.slice(prefix.length) : line };
  });
}

export type AssistantConversationStatus = 'active' | 'awaiting_input';

export interface AssistantConversationSummary {
  id: string;
  title: string | null;
  scope: BackendAiScope;
  projectId: string | null;
  status: AssistantConversationStatus;
  focusEntities: AssistantFocusEntity[] | null;
  pinned: boolean;
  pinnedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantConversationDetail extends AssistantConversationSummary {
  pendingQuestions: AskUserQuestion[] | null;
  messages: AssistantMessage[];
}
