import { ReportTimeRange } from '../utils/reportsUtils';

interface ReportsHeaderProps {
  projectName?: string;
  timeRangeLabel?: string;
  timeRange?: ReportTimeRange;
  onTimeRangeChange?: (value: ReportTimeRange) => void;
  onExport?: (format: 'csv' | 'pdf') => void;
}

export function ReportsHeader(_props: ReportsHeaderProps) {
  return null;
}

