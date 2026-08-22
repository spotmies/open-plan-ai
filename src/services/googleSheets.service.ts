import { apiClient } from './api/client';
import { ENDPOINTS } from './api/endpoints';
import { config } from '@/config';

// ─── Types — mirror the backend's google-sheets.types.ts response shapes ──────

// Org-level — mirrors GoogleDriveStatus exactly.
export interface GoogleSheetsOrgStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

// Project-level — what the BOM part editor needs: whether the org is
// connected at all, and whether this specific project has a sheet linked.
export interface GoogleSheetsLinkStatus {
  orgConnected: boolean;
  email: string | null;
  linked: boolean;
  spreadsheetId: string | null;
  sheetTabName: string | null;
}

export interface SheetTab {
  sheetId: number;
  title: string;
}

export interface SheetTabsResponse {
  spreadsheetId: string;
  spreadsheetTitle: string;
  tabs: SheetTab[];
}

export interface LinkSpreadsheetResponse {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetTabName: string;
}

export interface ColumnMappingPreview {
  headerRowIndex: number;
  headerRowLowConfidence: boolean;
  mapping: Record<string, string>;
  unmatchedColumns: string[];
  ambiguousColumns: string[];
  leadTimeColumnHeader: string | null;
  leadTimeColumnUnit: 'days' | 'weeks' | 'months' | null;
  reusedPersistedMapping: boolean;
  usedAi: boolean;
}

export interface ExportFieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface ExportChangedRow {
  partNumber: string;
  changes: ExportFieldChange[];
}

export interface ExportRenamedHeader {
  canonicalLabel: string;
  oldHeader: string;
  newHeader: string;
}

export interface ExportPreview {
  isFirstExport: boolean;
  newFields: string[];
  renamedHeaders: ExportRenamedHeader[];
  newPartRows: string[];
  changedRows: ExportChangedRow[];
  // Document/image URL columns that differ from the sheet. Always written on
  // confirm — unlike changedRows, these aren't gated by a toggle, since files
  // can only be attached in the app and never edited from the sheet side.
  changedAttachments: ExportChangedRow[];
  unchangedCount: number;
  totalRows: number;
}

export interface ExportAnswers {
  addNewFields: boolean;
  updateChangedColumns: boolean;
  renameHeaders: boolean;
}

export interface ExportCommitResult {
  newFieldsAdded: number;
  columnsUpdated: number;
  headersRenamed: number;
  newRowsWritten: number;
  totalRowsWritten: number;
}

export type ImportRowStatus = 'needs-input' | 'ambiguous-unit' | 'new-part' | 'matched-changed' | 'matched-unchanged';

export interface ImportRowPreview {
  rowIndex: number;
  partNumber: string;
  status: ImportRowStatus;
  values: Record<string, string>;
  missingRequiredFields: string[];
  aiSuggestions: Partial<Record<'Part Name' | 'Description' | 'Category', string>>;
  leadTimeRaw: string | null;
  leadTimeDays: number | null;
  leadTimeAmbiguous: boolean;
  leadTimeRequired: boolean;
  changes: ExportFieldChange[];
}

// A BOM part with no matching row in the sheet anymore (deleted there, or
// its Part Number cell was cleared/changed). Surfaced for the user to
// explicitly opt into removing — never auto-deleted.
export interface ImportDeletedPartPreview {
  nodeId: string;
  partId: string;
  partNumber: string;
  name: string;
}

export interface ImportPreview {
  headerRowIndex: number;
  headerRowLowConfidence: boolean;
  unmatchedColumns: string[];
  ambiguousColumns: string[];
  rows: ImportRowPreview[];
  deletedParts: ImportDeletedPartPreview[];
}

export interface ImportRowResolution {
  rowIndex: number;
  resolvedRequiredFields?: Partial<Record<'Part Number' | 'Part Name' | 'Description' | 'Category' | 'Manufacturer' | 'MPN' | 'Supplier' | 'Unit Price' | 'Quantity', string>>;
  resolvedLeadTimeDays?: number;
}

export interface ImportCommitRowResult {
  rowIndex: number;
  partNumber: string;
  outcome: 'created' | 'updated' | 'unchanged' | 'skipped' | 'failed';
  reason?: string;
}

export interface ImportCommitDeleteResult {
  nodeId: string;
  partNumber: string;
  outcome: 'deleted' | 'failed';
  reason?: string;
}

export interface ImportCommitResult {
  results: ImportCommitRowResult[];
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  deleteResults: ImportCommitDeleteResult[];
  deletedCount: number;
}

// Sheets preview calls round-trip through the Google Sheets API and, for
// column mapping / required-field suggestions, an AI call on top of that —
// both can comfortably exceed the client's default 15s timeout on a large
// sheet. Give these specific calls more headroom than the rest of the app.
const SHEETS_SYNC_TIMEOUT_MS = 60_000;

// Commit (Push/Pull "confirm") writes one row at a time — create/update part,
// create/update node, append a revision, activity log — so its wall-clock
// time scales linearly with row count and has no fixed upper bound the way
// preview does. These are explicit, user-confirmed, one-shot actions with
// their own loading state already in the UI, not routine calls that need a
// timeout safety net, so give them none (0 = no Axios timeout) rather than
// picking an arbitrary cap that a big enough sheet would still blow through.
const SHEETS_COMMIT_TIMEOUT_MS = 0;

export const googleSheetsService = {
  /**
   * Full backend URL that kicks off the OAuth flow. Must be used as a real
   * page navigation (`window.location.href = ...`), not an apiClient fetch —
   * same reasoning as googleDriveService/googleMeetService. Org-scoped, just
   * like Drive/Meet: connect once from Integrations, then link a spreadsheet
   * per project afterward (no per-project OAuth).
   */
  getConnectUrl(orgId: string): string {
    const base = config.api.baseUrl.replace(/\/$/, '');
    return `${base}${ENDPOINTS.GOOGLE_SHEETS.CONNECT(orgId)}`;
  },

  async getOrgStatus(orgId: string): Promise<GoogleSheetsOrgStatus> {
    return apiClient.get<GoogleSheetsOrgStatus>(ENDPOINTS.GOOGLE_SHEETS.ORG_STATUS(orgId));
  },

  async disconnect(orgId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.GOOGLE_SHEETS.DISCONNECT(orgId));
  },

  async getLinkStatus(projectId: string): Promise<GoogleSheetsLinkStatus> {
    return apiClient.get<GoogleSheetsLinkStatus>(ENDPOINTS.GOOGLE_SHEETS.LINK_STATUS(projectId));
  },

  async previewTabs(projectId: string, spreadsheetUrl: string): Promise<SheetTabsResponse> {
    return apiClient.post<SheetTabsResponse>(ENDPOINTS.GOOGLE_SHEETS.TABS(projectId), { spreadsheetUrl }, { timeout: SHEETS_SYNC_TIMEOUT_MS });
  },

  async linkSpreadsheet(projectId: string, spreadsheetUrl: string, sheetTabName?: string): Promise<LinkSpreadsheetResponse> {
    return apiClient.post<LinkSpreadsheetResponse>(ENDPOINTS.GOOGLE_SHEETS.LINK(projectId), { spreadsheetUrl, sheetTabName }, { timeout: SHEETS_SYNC_TIMEOUT_MS });
  },

  async unlinkSpreadsheet(projectId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.GOOGLE_SHEETS.UNLINK(projectId));
  },

  async previewColumnMapping(projectId: string): Promise<ColumnMappingPreview> {
    return apiClient.get<ColumnMappingPreview>(ENDPOINTS.GOOGLE_SHEETS.COLUMN_MAPPING(projectId), { timeout: SHEETS_SYNC_TIMEOUT_MS });
  },

  async confirmColumnMapping(projectId: string, mapping: Record<string, string>): Promise<void> {
    await apiClient.post(ENDPOINTS.GOOGLE_SHEETS.COLUMN_MAPPING(projectId), { mapping }, { timeout: SHEETS_SYNC_TIMEOUT_MS });
  },

  async previewExport(projectId: string): Promise<ExportPreview> {
    return apiClient.get<ExportPreview>(ENDPOINTS.GOOGLE_SHEETS.EXPORT_PREVIEW(projectId), { timeout: SHEETS_SYNC_TIMEOUT_MS });
  },

  async commitExport(projectId: string, answers: ExportAnswers): Promise<ExportCommitResult> {
    return apiClient.post<ExportCommitResult>(ENDPOINTS.GOOGLE_SHEETS.EXPORT_COMMIT(projectId), answers, { timeout: SHEETS_COMMIT_TIMEOUT_MS });
  },

  async previewImport(projectId: string): Promise<ImportPreview> {
    return apiClient.get<ImportPreview>(ENDPOINTS.GOOGLE_SHEETS.IMPORT_PREVIEW(projectId), { timeout: SHEETS_SYNC_TIMEOUT_MS });
  },

  async commitImport(projectId: string, rows: ImportRowResolution[], deleteNodeIds?: string[]): Promise<ImportCommitResult> {
    return apiClient.post<ImportCommitResult>(ENDPOINTS.GOOGLE_SHEETS.IMPORT_COMMIT(projectId), { rows, deleteNodeIds }, { timeout: SHEETS_COMMIT_TIMEOUT_MS });
  },
};
