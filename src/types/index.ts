// OpenPlan AI Type Definitions

// Organization roles are decoupled from project roles — a user's role on a
// given project is independent of whatever role they hold at the org level.
export type OrgRole = 'admin' | 'maintainer';
export type ProjectRole = 'admin' | 'maintainer' | 'member';

// Projects can define custom Kanban columns (see useProjectTaskColumns), so a
// task's status is any project-defined column key, not a fixed set of values.
export type TaskStatus = string;
export const DEFAULT_TASK_STATUSES: TaskStatus[] = ['todo', 'in-progress', 'review', 'done', 'blocked'];
export type Priority = 'critical' | 'major' | 'minor' | 'trivial';

// Expanded ModuleType for hardware workflows
export type ModuleType =
  | 'hardware'
  | 'software'
  | 'firmware'
  | 'testing'
  | 'design'           // CAD, mechanical design
  | 'procurement'      // Sourcing, vendor management
  | 'manufacturing'    // Assembly, production
  | 'qa'               // Quality assurance
  | 'logistics'        // Shipping, inventory
  | 'enclosure'        // Housing, packaging
  | 'pcb'              // PCB design & layout
  | 'power';           // Power systems

export type ProjectStage = 'concept' | 'design' | 'development' | 'testing' | 'production';

// Issue types
export type IssueSeverity = 'critical' | 'major' | 'minor' | 'trivial';
export type IssueStatus = 'open' | 'in-progress' | 'resolved' | 'wont-fix';
export type IssueCategory =
  | 'defect'           // Product defect
  | 'risk'             // Identified risk
  | 'supplier'         // Supplier/vendor issue
  | 'compliance'       // Regulatory/compliance gap
  | 'test-failure'     // Test failure
  | 'design-change'    // Design change request
  | 'other';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  initials: string;
  // Only populated on Task/Issue assignees — who assigned this person.
  // Comes straight off the API response, so it uses avatarUrl (not avatar) unlike the rest of this type.
  assignedBy?: { id: string; name: string; avatarUrl?: string | null } | null;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  showInBoardView?: boolean;
}

export interface Attachment {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedBy: TeamMember;
  uploadedAt: string;
  url: string;
}

export interface AttachmentCounts {
  images: number;
  videos: number;
  other: number;
}

export interface Comment {
  id: string;
  content: string;
  author: TeamMember;
  createdAt: string;
}

export interface VideoLink {
  id: string;
  url: string;
  title?: string;
  addedBy: TeamMember;
  addedAt: string;
}

// First-class Module entity
export interface Module {
  id: string;
  name: string;
  type: ModuleType;
  description?: string;
  color?: string;           // For visual distinction
  owner?: TeamMember;       // Module lead/owner
  progress: number;
  status: string;
  createdAt: string;
  createdBy?: TeamMember;  // Who created this module
  milestoneId?: string;     // Added to point to a milestone
}

// Enhanced Milestone interface
export type MilestoneStatus = 'completed' | 'blocked' | 'at-risk' | 'on-track';

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  date: string;              // Target date
  completed: boolean;
  completedAt?: string;      // Actual completion date
  status?: MilestoneStatus;  // Manual status override; falls back to computed status when unset
  linkedTaskIds?: string[];  // Tasks linked to this milestone
  linkedModuleIds?: string[]; // Modules linked to this milestone
  linkedIssueIds?: string[]; // Issues linked to this milestone (create-time only; edits go through Issue.blocksMilestoneIds)
  createdBy?: TeamMember;  // Who created this milestone
}

// A single "who changed what, when" entry, sourced from the activity log.
export interface ModificationHistoryEntry {
  userId: string;
  userName: string;
  fields: string[];
  at: string;
}

// Enhanced Task interface
export interface Task {
  id: string;
  title: string;
  description?: string;
  descriptionBlocks?: any[]; // For advanced editor state
  status: TaskStatus;
  priority: Priority;
  module: ModuleType;
  assignees?: TeamMember[];
  dueDate?: string;
  startDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  blockedBy: string[]; // Task IDs blocking this task
  tags: string[];
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
  comments?: Comment[];
  videoLinks?: VideoLink[];
  attachmentCounts?: AttachmentCounts;
  createdAt: string;
  updatedAt: string;
  createdBy?: TeamMember;  // Who created this task
  updatedBy?: TeamMember | null;  // Who last modified this task
  lastModifiedFields?: string[] | null;  // Field keys changed in the most recent update
  changeHistory?: ModificationHistoryEntry[] | null;  // Recent modification history, most recent first

  // NEW optional fields (backward compatible)
  milestoneId?: string | null;      // Link to parent milestone
  moduleId?: string;         // Link to Module entity (in addition to module type)
  moduleIds?: string[];      // Multiple module links
  linkedIssueIds?: string[]; // Issues affecting this task
  projectId?: string;        // Project this task belongs to (for cross-project views)
}

// Issue entity (New)
export interface Issue {
  id: string;
  title: string;
  description: string;
  descriptionBlocks?: any[]; // For advanced editor state
  category: IssueCategory;
  categoryOther?: string;         // Free-text description when category === 'other'
  severity: IssueSeverity;
  status: string;  // IssueStatus or any custom bucket key

  // Relationships
  projectId: string;
  moduleId?: string;           // Which module is affected
  blocksTaskIds?: string[];    // Tasks blocked by this issue
  blocksMilestoneIds?: string[]; // Milestones affected

  // Ownership
  reportedBy: TeamMember;
  updatedBy?: TeamMember | null;  // Who last modified this issue
  lastModifiedFields?: string[] | null;  // Field keys changed in the most recent update
  changeHistory?: ModificationHistoryEntry[] | null;  // Recent modification history, most recent first
  assignees?: TeamMember[];

  // Dates
  reportedAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  dueDate?: string;

  // Additional context
  resolution?: string;         // How it was resolved
  attachments?: Attachment[];
  comments?: Comment[];
  videoLinks?: VideoLink[];
  attachmentCounts?: AttachmentCounts;
  tags?: string[];
  checklist?: ChecklistItem[];
  blockedBy?: string[];
}

// My Day unified item type
export type MyDayItemType = 'task' | 'issue';

export interface MyDayItem {
  // Common fields
  id: string;
  itemType: MyDayItemType;
  title: string;
  description?: string;
  status: TaskStatus | IssueStatus;
  priority?: Priority | IssueSeverity;
  assignees: TeamMember[];
  dueDate?: string;
  projectId: string;
  projectName: string;

  // Flags for categorization
  isOverdue: boolean;
  isDueToday: boolean;
  isBlocked: boolean;
  isBlockingOthers?: boolean;
  hasUnresolvedDependencies?: boolean;

  // Original item reference (for opening detail modals)
  originalTask?: Task;
  originalIssue?: Issue;
}


// Legacy module summary (for backward compatibility)
export interface ModuleSummary {
  type: ModuleType;
  name: string;
  progress: number;
  taskCount: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  stage: ProjectStage;
  progress: number; // 0-100
  startDate: string;
  targetDate: string;
  type?: string; // Project Type (e.g., "Hardware Development")
  icon?: string; // Emoji icon for the project
  logoUrl?: string | null; // Uploaded square logo image, takes precedence over icon when set
  team: TeamMember[];
  memberCount?: number;
  tasks: Task[];
  milestones: Milestone[];
  modules: ModuleSummary[];  // Legacy support
  projectModules?: Module[]; // First-class modules (optional for backward compatibility)
  issues?: Issue[];          // Project-level issues (optional for backward compatibility)
  clientName?: string;
  clientOrganization?: string;
  clientContact?: string;
  notes?: string;
  departments?: string[];
  tabConfig?: ProjectTabConfig[];
  myRole?: string;
  pinned?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  type:
  | 'task_created'
  | 'task_completed'
  | 'task_updated'
  | 'task_assigned'
  | 'task_deleted'
  | 'comment_added'
  | 'milestone_reached'
  | 'milestone_created'
  | 'milestone_updated'
  | 'milestone_deleted'
  | 'milestone_reopened'
  | 'status_changed'
  | 'issue_created'
  | 'issue_resolved'
  | 'issue_updated'
  | 'issue_assigned'
  | 'issue_linked_to_task'
  | 'project_created'
  | 'project_updated'
  | 'project_assigned'
  | 'project_deleted'
  | 'project_member_added'
  | 'dependency_added';
  title: string;
  description: string;
  user: TeamMember;
  projectId: string;
  projectName: string;
  taskId?: string;
  taskTitle?: string;
  issueId?: string;
  issueTitle?: string;
  entityType?: string | null;
  entityId?: string | null;
  timestamp: string;
}

// View types for the project detail page (legacy - kept for backward compatibility)
export type ProjectView = 'kanban' | 'timeline' | 'list' | 'dependencies' | 'milestones' | 'issues';

// NEW: Section-based navigation for project detail
export type ProjectSection = 'tasks' | 'modules' | 'milestones' | 'issues' | 'bom' | 'eng-changes' | 'gate-reviews' | 'risk';

// Configurable tabs on the project detail page — order + visibility are per-project preferences
export type ProjectTabId = 'bom' | 'eng-changes' | 'tasks' | 'modules' | 'milestones' | 'issues';
export interface ProjectTabConfig {
  id: ProjectTabId;
  visible: boolean;
  order: number;
}
export type TaskViewMode = 'kanban' | 'list';
export type ModuleViewMode = 'kanban' | 'list';

// My Day specific types
export type MyDayView = 'kanban' | 'list';
export type MyDayGroupBy = 'project' | 'progress' | 'dueDate' | 'priority';
export type MyDayFilter = 'all' | 'today' | 'overdue';

export interface MyTasksColumnFilters {
  type?: MyDayItemType[];
  status?: string[];
  priority?: string[];
  projectIds?: string[];
  assignedByIds?: string[];
  dueDate?: 'overdue' | 'today' | 'upcoming' | 'no-date';
}

// Filter options - enhanced for hardware workflows
export interface TaskFilter {
  status?: TaskStatus[];
  priority?: Priority[];
  module?: ModuleType[];
  moduleIds?: string[];
  assignee?: string[];
  assignedBy?: string[];
  updatedBy?: string[];
  milestoneId?: string;
  dueDate?: 'overdue' | 'today' | 'this-week' | 'this-month' | 'no-date';
  dueDateCustom?: string; // exact date (yyyy-MM-dd) picked from the calendar, overrides dueDate preset
  tags?: string[];
  hasBlockers?: boolean;
}

export interface IssueFilter {
  severity?: IssueSeverity[];
  status?: IssueStatus[];
  category?: IssueCategory[];
  assignee?: string[];
  moduleId?: string;
}

// Team member status
export type MemberStatus = 'active' | 'inactive' | 'pending';

// Extended team member for management
export interface ExtendedTeamMember extends TeamMember {
  status: MemberStatus;
  department?: string;
  joinedAt?: string;
  projectCount?: number;
}

// Calendar types
export interface CalendarFilter {
  projectIds?: string[];
  priority?: Priority[];
  entityType?: ('task' | 'milestone' | 'issue' | 'meeting')[];
  isBlocked?: boolean;
  assignedBy?: string[];
}

export type CalendarViewMode = 'month' | 'week' | 'day';

// User settings/preferences
export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  compactMode: boolean;
  notifications: {
    taskAssignments: boolean;
    taskCompletions: boolean;
    comments: boolean;
    projectUpdates: boolean;
    milestoneReminders: boolean;
    emailDigest: 'daily' | 'weekly' | 'none';
  };
}

// Workspace settings
export interface WorkspaceSettings {
  name: string;
  description: string;
  timezone: string;
  dateFormat: string;
}
