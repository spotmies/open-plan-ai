// Backend<->frontend types for the task import feature. Enum-shaped fields
// (status, priority) mirror the backend's lowercase-with-underscore
// convention as-is here — this feature only ever displays them, it doesn't
// feed them back into a form that needs the frontend's UPPERCASE convention.

export type TaskImportJobStatus =
  | 'queued'
  | 'extracting'
  | 'structuring'
  | 'awaiting_review'
  | 'committing'
  | 'completed'
  | 'failed';

export interface TaskImportJobStatusDto {
  jobId: string;
  status: TaskImportJobStatus;
  conversationId: string | null;
  extractedRowCount: number | null;
  errorSummary: string | null;
  sourceFileName: string;
}

export interface ImportRowPreview {
  title: string;
  assigneeName: string | null;
  priority: 'critical' | 'major' | 'minor' | 'trivial' | null;
  dueDate: string | null;
  status: string | null;
  milestoneName: string | null;
  issues: string[];
  /** false only when the row is missing its required title (or was explicitly skipped in chat) — every other issue is informational and still imports. */
  importable: boolean;
}

export interface ImportProposalPreview {
  itemCount: number;
  cleanCount: number;
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
  taskIds: string[];
}

const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.docx', '.pdf', '.txt'];

export function isSupportedImportFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export const SUPPORTED_IMPORT_FILE_LABEL = 'Excel, CSV, Word, PDF, or text file';
