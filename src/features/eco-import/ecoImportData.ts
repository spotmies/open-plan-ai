// Backend<->frontend types for the ECO import feature. Enum-shaped fields
// (type, reason, priority) mirror the backend's lowercase-with-underscore
// convention as-is here — this feature only ever displays them, unlike
// ecoData.ts's own UPPERCASE adapter convention used elsewhere in the ECO
// UI. Mirrors issue-import/issueImportData.ts.

export type EcoImportJobStatus =
  | 'queued'
  | 'extracting'
  | 'structuring'
  | 'awaiting_review'
  | 'committing'
  | 'completed'
  | 'failed';

export interface EcoImportJobStatusDto {
  jobId: string;
  status: EcoImportJobStatus;
  conversationId: string | null;
  extractedRowCount: number | null;
  errorSummary: string | null;
  sourceFileName: string;
}

export type EcoImportType =
  | 'design_change' | 'component_change' | 'supplier_change' | 'process_change'
  | 'documentation_change' | 'cost_reduction' | 'deviation' | 'obsolescence' | 'other';

export type EcoImportReason =
  | 'performance' | 'cost' | 'quality' | 'supply_chain' | 'safety' | 'compliance'
  | 'customer_request' | 'eol_obsolescence' | 'manufacturability' | 'other';

export type EcoImportPriority = 'critical' | 'high' | 'medium' | 'low';

export const ECO_IMPORT_TYPE_LABEL: Record<EcoImportType, string> = {
  design_change: 'Design Change',
  component_change: 'Component Change',
  supplier_change: 'Supplier Change',
  process_change: 'Process Change',
  documentation_change: 'Documentation Change',
  cost_reduction: 'Cost Reduction',
  deviation: 'Deviation',
  obsolescence: 'Obsolescence',
  other: 'Other',
};

export const ECO_IMPORT_REASON_LABEL: Record<EcoImportReason, string> = {
  performance: 'Performance',
  cost: 'Cost',
  quality: 'Quality',
  supply_chain: 'Supply Chain',
  safety: 'Safety',
  compliance: 'Compliance',
  customer_request: 'Customer Request',
  eol_obsolescence: 'EOL / Obsolescence',
  manufacturability: 'Manufacturability',
  other: 'Other',
};

export interface ImportRowPreview {
  title: string;
  description: string | null;
  type: EcoImportType;
  typeOther: string | null;
  reason: EcoImportReason;
  reasonOther: string | null;
  priority: EcoImportPriority;
  /** Raw "owner / handled by" name from the source file, or null. */
  owner: string | null;
  /** true once `owner` matched a real project member — the ECO gets that owner on commit (otherwise it's owned by whoever ran the import). */
  ownerResolved: boolean;
  /** Image URL from the source file, or null — attached as a linked image on the ECO on commit. */
  imageUrl: string | null;
  targetDate: string | null;
  /** The source file's own reference ID for this change (e.g. an "ECO ID" column), if any — stored for traceability, never this ECO's real number. */
  originatingEcr: string | null;
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

export interface CommitEcoImportResult {
  created: number;
  skipped: number;
  reasons: string[];
  ecoIds: string[];
}

const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.docx', '.pdf', '.txt', '.md'];

export function isSupportedImportFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export const SUPPORTED_IMPORT_FILE_LABEL = 'Excel, CSV, Word, PDF, text, or Markdown file';
