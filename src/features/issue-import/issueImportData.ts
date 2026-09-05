// Backend<->frontend types for the issue import feature. Enum-shaped fields
// (status, severity, category) mirror the backend's lowercase-with-underscore
// convention as-is here — this feature only ever displays them. Mirrors
// task-import/taskImportData.ts.

export type IssueImportJobStatus =
  | 'queued'
  | 'extracting'
  | 'structuring'
  | 'awaiting_review'
  | 'committing'
  | 'completed'
  | 'failed';

export interface IssueImportJobStatusDto {
  jobId: string;
  status: IssueImportJobStatus;
  conversationId: string | null;
  extractedRowCount: number | null;
  errorSummary: string | null;
  sourceFileName: string;
}

export interface ImportRowPreview {
  title: string;
  assigneeName: string | null;
  severity: 'critical' | 'major' | 'minor' | 'trivial' | null;
  category: 'defect' | 'risk' | 'supplier' | 'compliance' | 'test-failure' | 'design-change' | 'other' | null;
  categoryOther: string | null;
  dueDate: string | null;
  status: string | null;
  moduleName: string | null;
  /** Image URL from the source file, or null — attached as a linked image on the issue on commit. */
  imageUrl: string | null;
  issues: string[];
  /** false only when the row is missing its required title (or was explicitly skipped in chat) — every other issue is informational and still imports. */
  importable: boolean;
  /** true when an issue with this title already exists in the project — skipped on commit, not re-created. */
  alreadyImported: boolean;
}

export interface ImportProposalPreview {
  itemCount: number;
  cleanCount: number;
  /** Rows skipped because an issue with the same title already exists — a subset of (itemCount - cleanCount). */
  duplicateCount: number;
  rows: ImportRowPreview[];
}

export interface ImportProposalEvent {
  proposalId: string;
  conversationId: string;
  messageId: string;
  status: string;
  summary: string;
  preview: ImportProposalPreview;
  warnings: string[];
  expiresAt: string;
  createdAt: string;
}

export interface ImportProposalUpdateEvent {
  proposalId: string;
  conversationId: string;
  status: string;
  preview: ImportProposalPreview;
  warnings: string[];
  updatedAt: string;
}

export interface ImportChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'event';
  content: string | null;
  createdAt: string;
}

export interface ImportAskUserOption {
  label: string;
  description: string;
}

export interface ImportAskUserQuestion {
  header: string;
  question: string;
  options: ImportAskUserOption[];
  multiSelect: boolean;
}

export interface CommitImportResult {
  created: number;
  skipped: number;
  reasons: string[];
  issueIds: string[];
}

const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.docx', '.pdf', '.txt', '.md'];

export function isSupportedImportFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export const SUPPORTED_IMPORT_FILE_LABEL = 'Excel, CSV, Word, PDF, text, or Markdown file';
