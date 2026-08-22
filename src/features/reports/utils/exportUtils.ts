import { format } from 'date-fns';
import {
  ReportKPI,
  StatusBreakdown,
  MilestoneHealthItem,
  TeamWorkloadItem,
  ModuleProgressItem,
  TrendDataPoint,
} from './reportsUtils';
import { Issue } from '@/types';

export interface ReportExportData {
  kpis: ReportKPI;
  statusBreakdown: StatusBreakdown[];
  milestoneHealth: MilestoneHealthItem[];
  teamWorkload: TeamWorkloadItem[];
  moduleProgress: ModuleProgressItem[];
  trendData: TrendDataPoint[];
  issues: Issue[];
  projectName?: string;
  timeRangeLabel?: string;
}

// Escape a CSV cell value
function escapeCSV(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Build a CSV row from an array of values
function csvRow(cells: (string | number | undefined | null)[]): string {
  return cells.map(escapeCSV).join(',');
}

// Assemble the full multi-section CSV string
export function buildCSV(data: ReportExportData): string {
  const generated = format(new Date(), 'MMM d, yyyy');
  const projectLabel = data.projectName || 'All Projects';
  const timeLabel = data.timeRangeLabel || 'All time';

  const lines: string[] = [];

  // Header
  lines.push('OPENPLAN REPORT');
  lines.push(csvRow(['Generated', generated]));
  lines.push(csvRow(['Project', projectLabel]));
  lines.push(csvRow(['Time Range', timeLabel]));
  lines.push('');

  // KPIs
  lines.push('=== KEY PERFORMANCE INDICATORS ===');
  lines.push(csvRow(['Metric', 'Value', 'Details']));
  lines.push(csvRow(['Project Progress', `${data.kpis.projectProgress}%`, `${data.kpis.completedTasks} of ${data.kpis.totalTasks} tasks`]));
  lines.push(csvRow(['Open Issues', data.kpis.openIssues, `${data.kpis.criticalIssues} critical`]));
  lines.push(csvRow(['Overdue Tasks', data.kpis.overdueTasks, 'Needs attention']));
  lines.push(csvRow(['Avg Cycle Time', data.kpis.avgCycleTime > 0 ? `${data.kpis.avgCycleTime} days` : 'N/A', 'Days per completed task']));
  lines.push('');

  // Task Status Breakdown
  lines.push('=== TASK STATUS BREAKDOWN ===');
  lines.push(csvRow(['Status', 'Count', 'Percentage']));
  const statusLabels: Record<string, string> = {
    'todo': 'To Do',
    'in-progress': 'In Progress',
    'review': 'Review',
    'done': 'Done',
    'blocked': 'Blocked',
  };
  for (const row of data.statusBreakdown) {
    lines.push(csvRow([statusLabels[row.status] || row.status, row.count, `${row.percentage}%`]));
  }
  lines.push('');

  // Milestone Health
  lines.push('=== MILESTONE HEALTH ===');
  lines.push(csvRow(['Milestone', 'Status', 'Progress', 'Completed Tasks', 'Total Tasks', 'Due Date']));
  for (const row of data.milestoneHealth) {
    lines.push(csvRow([
      row.milestone.title,
      row.status,
      `${row.progress}%`,
      row.completedTasks,
      row.totalTasks,
      row.milestone.date || 'N/A',
    ]));
  }
  lines.push('');

  // Team Workload
  lines.push('=== TEAM WORKLOAD ===');
  lines.push(csvRow(['Member', 'Total Tasks', 'Completed', 'In Progress', 'Overdue']));
  for (const row of data.teamWorkload) {
    lines.push(csvRow([
      row.member.name,
      row.totalTasks,
      row.completedTasks,
      row.inProgressTasks,
      row.overdueTasks,
    ]));
  }
  lines.push('');

  // Module Progress
  lines.push('=== MODULE PROGRESS ===');
  lines.push(csvRow(['Module', 'Progress', 'Completed Tasks', 'Total Tasks']));
  for (const row of data.moduleProgress) {
    lines.push(csvRow([
      row.module.name,
      `${row.progress}%`,
      row.completedTasks,
      row.totalTasks,
    ]));
  }
  lines.push('');

  // Trend Data
  lines.push('=== COMPLETED TASKS TREND ===');
  lines.push(csvRow(['Date', 'Completed', 'Cumulative', 'Remaining']));
  for (const row of data.trendData) {
    lines.push(csvRow([row.date, row.completed, row.cumulative, row.remaining]));
  }
  lines.push('');

  // Open Issues
  lines.push('=== OPEN ISSUES ===');
  lines.push(csvRow(['Title', 'Priority', 'Category', 'Status', 'Reported Date']));
  const openIssues = data.issues.filter(i => i.status === 'open' || i.status === 'in-progress');
  for (const issue of openIssues) {
    lines.push(csvRow([
      issue.title,
      issue.severity,
      issue.category || 'N/A',
      issue.status,
      issue.reportedAt ? format(new Date(issue.reportedAt), 'MMM d, yyyy') : 'N/A',
    ]));
  }

  return lines.join('\n');
}

// Trigger a CSV file download
export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Build CSV and trigger download
export function downloadCSVReport(data: ReportExportData): void {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const filename = `report-${dateStr}.csv`;
  const content = buildCSV(data);
  downloadCSV(filename, content);
}

// Trigger native browser print dialog (user can Save as PDF)
export function triggerPDFExport(): void {
  window.print();
}

// ─── ECO/BOM CSV export helpers ────────────────────────────────────────────────

/**
 * Download CSV content as a file
 * @param blob Blob containing CSV data
 * @param filename Output filename
 */
export function downloadCsvBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke URL after a short delay to allow download to start
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Download ECO CSV export
 * @param blob Blob from server response
 * @param format 'summary' | 'detailed'
 * @param ecoCount Number of ECOs being exported
 */
export function downloadEcoCsv(blob: Blob, exportFormat: 'summary' | 'detailed', ecoCount: number): void {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const filename = ecoCount === 1
    ? `eco-${exportFormat}-${dateStr}.csv`
    : `ecos-${exportFormat}-${ecoCount}-${dateStr}.csv`;
  downloadCsvBlob(blob, filename);
}

/**
 * Download BOM CSV export
 * @param blob Blob from server response
 * @param projectId Project ID for filename
 */
export function downloadBomCsv(blob: Blob, projectId: string): void {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const filename = `bom-${projectId}-${dateStr}.csv`;
  downloadCsvBlob(blob, filename);
}
