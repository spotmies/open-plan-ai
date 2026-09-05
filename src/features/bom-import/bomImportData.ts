// Backend<->frontend types for the BOM import feature. Mirrors
// issue-import/issueImportData.ts.

export type BomImportJobStatus =
  | 'queued'
  | 'extracting'
  | 'structuring'
  | 'awaiting_review'
  | 'committing'
  | 'completed'
  | 'failed';

export interface BomImportJobStatusDto {
  jobId: string;
  status: BomImportJobStatus;
  conversationId: string | null;
  extractedRowCount: number | null;
  errorSummary: string | null;
  sourceFileName: string;
}

export interface ImportRowPreview {
  partNumber: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number | null;
  leadTimeWeeks: number | null;
  /** 0-based hierarchy depth — used to indent the row in the review card. */
  level: number;
  existingPartId: string | null;
  /** Raw "owner / handled by" name from the source file, or null. */
  owner: string | null;
  /** true once `owner` matched a real project member — the node gets an owner on commit. */
  ownerResolved: boolean;
  /** Product photo URL from the source file, or null — set on the new part on commit. */
  imageUrl: string | null;
  issues: string[];
  /** false only when the row is missing a required field (or was explicitly skipped in chat) — every other issue is informational and still imports. */
  importable: boolean;
  /** true when this part number is already a node in the project's BOM — skipped on commit, not re-added. */
  alreadyInBom: boolean;
}

export interface ImportProposalPreview {
  itemCount: number;
  cleanCount: number;
  /** Rows skipped because the part number is already in the project's BOM — a subset of (itemCount - cleanCount). */
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
  nodeIds: string[];
}

// xlsx/csv go through the backend's structured column-mapping extractor;
// docx/pdf/txt/md go through its AI prose extractor.
const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.docx', '.pdf', '.txt', '.md'];

export function isSupportedImportFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export const SUPPORTED_IMPORT_FILE_LABEL = 'Excel, CSV, Word, PDF, text, or Markdown file';
