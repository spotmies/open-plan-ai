import type { ProjectTaskColumn } from '@/services/projectTaskColumns.service';

export interface TaskStatusOption {
  value: string;
  label: string;
  color?: string;
}

// Single source of truth for turning a project's dynamic task buckets into
// filter/select options. Always includes a "Blocked" fallback since it's a
// derived state (not a real bucket) that some projects don't persist.
export function buildTaskStatusOptions(columns: ProjectTaskColumn[] = []): TaskStatusOption[] {
  const deduped = new Map<string, TaskStatusOption>();

  columns.forEach((column) => {
    if (column.isSpecial && column.status === 'blocked') return;
    deduped.set(column.status, {
      value: column.status,
      label: column.label,
      color: column.color,
    });
  });

  if (!deduped.has('blocked')) {
    deduped.set('blocked', { value: 'blocked', label: 'Blocked', color: '#ef4444' });
  }

  return Array.from(deduped.values());
}
