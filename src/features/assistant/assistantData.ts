import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Flag,
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

/**
 * Act-category suggestions, generated from the org's real projects the same
 * way buildAskSuggestions() is — round-robins real project names in rather
 * than a fixed example (no invented module/person/requirement-id specifics,
 * since none of that is loaded at the assistant empty-state yet). Every
 * template names a real project explicitly because a propose_* tool needs an
 * unambiguous destination project to resolve against; "me" resolves to the
 * signed-in user server-side (see resolveReferences.ts's SELF_REFERENCES),
 * so it's real data too, not a placeholder. Returns [] when there are no
 * projects yet — same empty-state contract as buildAskSuggestions.
 */
export function buildActSuggestions(projects: Pick<Project, 'name'>[]): AssistantSuggestion[] {
  if (projects.length === 0) return [];
  const nameAt = (i: number) => projects[i % projects.length].name;
  return [
    { id: 'act-create-task', category: 'act', icon: ClipboardCheck, text: `Create a task in ${nameAt(0)} and assign it to me, due Friday` },
    { id: 'act-move-milestone', category: 'act', icon: Flag, text: `Push ${nameAt(1)}'s next milestone out by a week` },
    { id: 'act-raise-issue', category: 'act', icon: AlertTriangle, text: `Raise an issue in ${nameAt(2)} and assign it to me` },
    { id: 'act-assign-backlog', category: 'act', icon: UserPlus, text: `Assign all unassigned tasks in ${nameAt(3)} to me` },
    { id: 'act-bom-approve', category: 'act', icon: Layers, text: `Mark a BOM line in ${nameAt(4)} as approved` },
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

// The composer's "Focus — pick any" multi-select was removed; this type is kept
// only because AssistantConversationSummary.focusEntities still reads it back
// from older conversations. Must match the backend's AiConversationFocusEntity
// (ai-conversations.types.ts).
export type AssistantFocusEntity = 'tasks' | 'issues' | 'milestones' | 'hardware_modules' | 'bom_nodes' | 'ecos';

/** Same scope labels, but resolves 'project'/'bom' to the actual project name when known — matches AssistantScopePopover's label. */
export function resolveConversationScopeLabel(scope: BackendAiScope, projectName?: string): string {
  if (scope === 'all_projects') return 'All projects';
  if (!projectName) return backendScopeToLabel(scope);
  return scope === 'bom' ? `${projectName} · BOM` : projectName;
}

// 'event' is Act (phase 2): a system-narrated proposal outcome
// (confirmed/rejected/expired/superseded) — see AssistantEventLine.tsx.
export type AssistantMessageRole = 'user' | 'assistant' | 'tool' | 'event';

export type AssistantProposalEventType = 'proposal_confirmed' | 'proposal_rejected' | 'proposal_expired' | 'proposal_superseded';

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
  // Act (phase 2), role === 'event' only.
  eventType?: AssistantProposalEventType | null;
  proposalId?: string | null;
}

// ─── present_card (see backend presentCard.tool.ts, the authoritative shape) ──

export type CardSeverity = 'critical' | 'major' | 'minor' | 'trivial';
/** 'danger' for blockers/risks/overdue-heavy cards — purely cosmetic, set server-side from the model's present_card call. */
export type CardTone = 'default' | 'danger';
/** Matches the backend's real projects.stage enum exactly — never the design mock's fabricated EVT/DVT/PVT/MP gate names. */
export type ProjectStage = 'concept' | 'design' | 'development' | 'testing' | 'production';

/** Matches presentCard.tool.ts's cardItemSchema.entityType — which query_project_data entity a status/list item came from, since those two card types can mix entity types (e.g. a blockers/risks list mixing tasks and issues). Used to pick the right deep-link route in AssistantCardMessage. */
export type CardItemEntityType = 'task' | 'issue' | 'milestone' | 'hardware_module' | 'bom_node' | 'eco';

export interface CardItem {
  id: string;
  title: string;
  severity?: CardSeverity;
  contextLabel?: string;
  dueDate?: string;
  assignees?: string[];
  /** Absent on cards persisted before this field existed — those rows just aren't clickable. */
  projectId?: string;
  entityType?: CardItemEntityType;
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
  /** Absent on cards persisted before this field existed. */
  projectId?: string;
}

// Modules and milestones get their own item shapes too — a progress meter,
// not a severity dot/assignee/id-badge row (see BomCardItem's own comment
// for the same reasoning, established when "bom" was added).
export interface ModuleCardItem {
  id: string;
  name: string;
  taskCount: number;
  progress: number;
  /** Absent on cards persisted before this field existed. */
  projectId?: string;
}

export interface MilestoneCardItem {
  id: string;
  title: string;
  /** Real raw backend status value (lowercase/underscored) — the UI derives its own overdue/on-track dot color from this + dueDate, never a model-supplied "at risk" label. */
  status: string;
  dueDate?: string;
  progress: number;
  linkedTaskCount: number;
  completedTaskCount: number;
  /** Absent on cards persisted before this field existed. */
  projectId?: string;
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

/** Purely cosmetic heading/icon selector for a "list" card — a closed enum the model picks from, never free text. Undefined/'general' keeps the existing plain "Summary" (or danger-tone "Blockers & Risks") heading. */
export type AssistantListSubject = 'tasks' | 'issues' | 'general';

export interface AssistantListCard extends AssistantCardBase {
  type: 'list';
  items: CardItem[];
  subject?: AssistantListSubject;
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

export interface AssistantModuleListCard extends AssistantCardBase {
  type: 'module_list';
  items: ModuleCardItem[];
}

export interface AssistantMilestoneListCard extends AssistantCardBase {
  type: 'milestone_list';
  items: MilestoneCardItem[];
}

// ─── Single-record "detail" cards ──────────────────────────────────────────
// One real record's own profile, not a list — no `badge`/`items`: the
// reference code next to the title is derived here from the real `id` (or,
// for an ECO, shown verbatim from the real `num`), never a model-supplied
// string, so nothing shown there can be an invented code.

interface AssistantDetailCardBase {
  title: string;
  description?: string;
  tone?: CardTone;
  followUps?: string[];
  sources: string[];
}

export interface AssistantTaskDetailCard extends AssistantDetailCardBase {
  type: 'task_detail';
  id: string;
  /** Absent on cards persisted before this field existed. */
  projectId?: string;
  status: string;
  priority?: CardSeverity;
  startDate?: string;
  dueDate?: string;
  assignees?: string[];
  hasDependency?: boolean;
}

export interface AssistantIssueDetailCard extends AssistantDetailCardBase {
  type: 'issue_detail';
  id: string;
  /** Absent on cards persisted before this field existed. */
  projectId?: string;
  status: string;
  severity?: CardSeverity;
  category?: string;
  module?: string;
  reportedBy?: string;
  reportedAt?: string;
  dueDate?: string;
}

export type EcoChangeClass = 'I' | 'II' | 'III';

export interface AssistantEcoDetailCard extends AssistantDetailCardBase {
  type: 'eco_detail';
  /** The ECO's real human-facing code (e.g. "ECO-2026-047") — shown as the reference badge as-is. */
  num: string;
  /** The ECO's real DB id — absent on cards persisted before this field existed, or if the model omitted it; needed alongside `num` to deep-link (num alone can't build a route). */
  id?: string;
  /** Absent on cards persisted before this field existed. */
  projectId?: string;
  status: string;
  priority?: string;
  changeClass?: EcoChangeClass;
  targetDate?: string;
  owner?: string;
  originatingEcr?: string;
}

export interface AssistantModuleDetailCard extends AssistantDetailCardBase {
  type: 'module_detail';
  id: string;
  /** Absent on cards persisted before this field existed. */
  projectId?: string;
  moduleType?: string;
  status?: string;
  progress?: number;
  taskCount?: number;
  owner?: string;
}

export type AssistantCard =
  | AssistantStatusCard
  | AssistantListCard
  | AssistantBomCard
  | AssistantModuleListCard
  | AssistantMilestoneListCard
  | AssistantTaskDetailCard
  | AssistantIssueDetailCard
  | AssistantEcoDetailCard
  | AssistantModuleDetailCard;

const PRESENT_CARD_TYPES = new Set<AssistantCard['type']>([
  'status',
  'list',
  'bom',
  'module_list',
  'milestone_list',
  'task_detail',
  'issue_detail',
  'eco_detail',
  'module_detail',
]);

/**
 * A present_card result is persisted like any other tool message (role='tool',
 * content = JSON.stringify(card)) — this is what tells the transcript to
 * render it as a card instead of hiding it as tool-call plumbing.
 */
export function isPresentCardMessage(message: AssistantMessage): boolean {
  if (message.role !== 'tool' || !message.content) return false;
  try {
    const parsed = JSON.parse(message.content) as { type?: unknown };
    return typeof parsed?.type === 'string' && PRESENT_CARD_TYPES.has(parsed.type as AssistantCard['type']);
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

// ─── Act (phase 2) proposals — matches _shared/preview.ts (backend) exactly ──

export interface ProposalDeepLink {
  entityType: string;
  id: string;
  projectId: string;
}

export interface ProposalChange {
  label: string;
  from: string;
  to: string;
}

export interface ProposalField {
  label: string;
  value: string;
}

export interface ProposalItemUpdate {
  index: number;
  kind: 'update';
  title: string;
  deepLink: ProposalDeepLink;
  changes: ProposalChange[];
}

export interface ProposalItemCreate {
  index: number;
  kind: 'create';
  title: string;
  fields: ProposalField[];
}

export type ProposalItem = ProposalItemUpdate | ProposalItemCreate;

export interface ProposalWarning {
  code: string;
  message: string;
  itemIndexes: number[];
}

export interface ProposalPreview {
  /** Null for a personal (no-project) task proposal — a task creation with no project signal defaults there instead of asking which project. */
  destination: { projectId: string | null; projectName: string; inferredFrom: 'explicit' | 'pinned' | 'scope' | 'personal' };
  entityType: string;
  actionKind: 'create' | 'update' | 'mixed';
  itemCount: number;
  noopCount: number;
  items: ProposalItem[];
  warnings: ProposalWarning[];
  rationale?: string;
}

export interface ProposalItemResult {
  index: number;
  kind: 'create' | 'update';
  status: 'succeeded' | 'failed';
  entityType: string;
  entityId?: string;
  label: string;
  deepLink?: ProposalDeepLink;
  error?: { code: string; message: string };
}

export interface ProposalExecutionResult {
  version: number;
  executedAt: string;
  succeeded: number;
  failed: number;
  items: ProposalItemResult[];
}

export type AssistantProposalStatus =
  | 'pending'
  | 'executing'
  | 'executed'
  | 'partially_executed'
  | 'failed'
  | 'rejected'
  | 'expired'
  | 'superseded';

// Server-owned, edit-friendly resolved fields for the review-before-confirm
// form — real ids/raw enum values (unlike ProposalPreview's display
// strings). Matches the backend's ProposalFormState (_shared/preview.ts)
// exactly. 'single' carries every current field value for the one item;
// 'bulk-shared' carries only the field(s) set identically across every
// operation, edited as one shared change.
export interface ProposalFormSharedField {
  field: string;
  label: string;
  value: unknown;
}

export interface ProposalFormState {
  mode: 'single' | 'bulk-shared';
  fields?: Record<string, unknown>;
  sharedFields?: ProposalFormSharedField[];
  required: string[];
}

export interface AssistantProposal {
  id: string;
  conversationId: string;
  messageId: string;
  /** Null for a personal (no-project) task proposal. */
  projectId: string | null;
  toolName: string;
  entityType: string;
  actionKind: 'create' | 'update' | 'mixed';
  preview: ProposalPreview;
  summary: string;
  warnings: string[];
  status: AssistantProposalStatus;
  result: ProposalExecutionResult | null;
  rejectedReason: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  executedAt: string | null;
  /** Null = the review form hasn't been submitted yet — the card renders that form instead of Confirm/Dismiss. */
  reviewedAt: string | null;
  /** Null when there's nothing to prefill a form from (e.g. BOM/ECO proposals, which don't have a review form yet) — the card always renders read-only in that case. */
  formState: ProposalFormState | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/** ai:proposal socket payload — a pending card just created. */
export interface AssistantProposalEvent {
  proposalId: string;
  conversationId: string;
  messageId: string;
  status: 'pending';
  summary: string;
  preview: ProposalPreview;
  warnings: string[];
  expiresAt: string;
  createdAt: string;
}

/** ai:proposal-update socket payload — a status transition on an existing card. */
export interface AssistantProposalUpdateEvent {
  proposalId: string;
  conversationId: string;
  status: AssistantProposalStatus;
  result?: ProposalExecutionResult | null;
  rejectedReason?: string | null;
  updatedAt: string;
}

export function isTerminalProposalStatus(status: AssistantProposalStatus): boolean {
  return status !== 'pending' && status !== 'executing';
}

/** True for a role='event' message — a system-narrated proposal outcome (see AssistantEventLine.tsx). */
export function isProposalEventMessage(message: AssistantMessage): boolean {
  return message.role === 'event';
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
  shareId: string | null;
  sharedAt: string | null;
  /** Act (phase 2) — e.g. "Assigned 14 tasks · 1 failed", rendered as the sidebar outcome chip. Null until a proposal has ever executed in this conversation. */
  lastActionSummary?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantConversationDetail extends AssistantConversationSummary {
  pendingQuestions: AskUserQuestion[] | null;
  messages: AssistantMessage[];
  // Act (phase 2), I15 — every proposal for this conversation, joined here
  // so a page refresh reconstructs every card from REST alone.
  proposals: AssistantProposal[];
}

// ─── Share (public read-only link) ─────────────────────────────────────────
// Matches the backend's SharedConversationResponse — a frozen copy of the
// conversation as it looked at share time, returned by the public,
// unauthenticated GET /ai/conversations/shared/:shareId. See
// SharedConversation.tsx, the only consumer of this shape.
export interface AssistantSharedConversation {
  title: string | null;
  scope: BackendAiScope;
  projectName: string | null;
  ownerName: string | null;
  sharedAt: string;
  messages: AssistantMessage[];
  // Act (phase 2) — frozen at share time, rendered read-only (no
  // Confirm/Dismiss) since this public route has no authenticated session.
  proposals: AssistantProposal[];
}
