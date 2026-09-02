import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  googleSheetsService,
  type ExportAnswers,
  type ImportRowResolution,
} from '@/services/googleSheets.service';
import { queryKeys } from '@/lib/queryClient';
import { toast } from 'sonner';

// ─── Org-level connection (Integrations page only — mirrors useGoogleDrive.ts) ──

const orgStatusKey = (orgId: string | undefined) => ['google-sheets-org-status', orgId];

export function useGoogleSheetsOrgStatus(orgId: string | undefined) {
  return useQuery({
    queryKey: orgStatusKey(orgId),
    queryFn: () => googleSheetsService.getOrgStatus(orgId!),
    enabled: !!orgId,
  });
}

export function useDisconnectGoogleSheets(orgId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => googleSheetsService.disconnect(orgId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgStatusKey(orgId) });
      toast.success('Disconnected from Google Sheets');
    },
    onError: (error) => {
      toast.error('Failed to disconnect Google Sheets', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}

// ─── Project-level link (BOM part editor — status + preview tabs → link) ──────

const linkStatusKey = (projectId: string | undefined) => ['google-sheets-link-status', projectId];

export function useGoogleSheetsLinkStatus(projectId: string | undefined) {
  return useQuery({
    queryKey: linkStatusKey(projectId),
    queryFn: () => googleSheetsService.getLinkStatus(projectId!),
    enabled: !!projectId,
  });
}

export function usePreviewGoogleSheetTabs(projectId: string | undefined) {
  return useMutation({
    mutationFn: (spreadsheetUrl: string) => googleSheetsService.previewTabs(projectId!, spreadsheetUrl),
    onError: (error) => {
      toast.error('Could not read that spreadsheet', {
        description: error instanceof Error ? error.message : 'Check the link and try again',
      });
    },
  });
}

export function useLinkGoogleSheet(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spreadsheetUrl, sheetTabName }: { spreadsheetUrl: string; sheetTabName?: string }) =>
      googleSheetsService.linkSpreadsheet(projectId!, spreadsheetUrl, sheetTabName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: linkStatusKey(projectId) });
      toast.success('Google Sheet linked to this BOM');
    },
    onError: (error) => {
      toast.error('Failed to link Google Sheet', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}

export function useUnlinkGoogleSheet(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => googleSheetsService.unlinkSpreadsheet(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: linkStatusKey(projectId) });
      toast.success('Google Sheet unlinked');
    },
    onError: (error) => {
      toast.error('Failed to unlink Google Sheet', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}

// ─── Push (Export) ──────────────────────────────────────────────────────────────

export function useGoogleSheetsExportPreview(projectId: string | undefined) {
  return useMutation({
    mutationFn: () => googleSheetsService.previewExport(projectId!),
    onError: (error) => {
      toast.error('Failed to preview Push', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}

export function useGoogleSheetsExportCommit(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (answers: ExportAnswers) => googleSheetsService.commitExport(projectId!, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: linkStatusKey(projectId) });
    },
    onError: (error) => {
      toast.error('Push failed', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}

// ─── Pull (Import) ──────────────────────────────────────────────────────────────

export function useGoogleSheetsImportPreview(projectId: string | undefined) {
  return useMutation({
    mutationFn: () => googleSheetsService.previewImport(projectId!),
    onError: (error) => {
      toast.error('Failed to preview Pull', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}

export function useGoogleSheetsImportCommit(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rows,
      deleteNodeIds,
      excludedColumns,
    }: {
      rows: ImportRowResolution[];
      deleteNodeIds?: string[];
      excludedColumns?: string[];
    }) => googleSheetsService.commitImport(projectId!, rows, deleteNodeIds, excludedColumns),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: linkStatusKey(projectId) });
      // Broad invalidation — Pull can create/update parts, nodes, and
      // revisions across the whole tree, not one node at a time like a
      // normal edit, so a targeted invalidate isn't worth the complexity.
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.all });
      const totalFailed = result.failedCount + result.deleteResults.filter((d) => d.outcome === 'failed').length;
      if (totalFailed > 0) {
        toast.warning(`Imported with ${totalFailed} issue(s)`, {
          description: `${result.createdCount} created, ${result.updatedCount} updated, ${result.deletedCount} removed, ${totalFailed} failed.`,
        });
      } else if (result.deletedCount > 0) {
        toast.success(`Imported — ${result.deletedCount} part(s) removed to match the sheet`);
      }
    },
    onError: (error) => {
      toast.error('Pull failed', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}
