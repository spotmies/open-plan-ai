// Human-readable labels for the raw field keys stored in an issue/task's
// `lastModifiedFields` (sourced from the activity log's `metadata.changes`).
// Used by the "Modified By" hover tooltip in IssueDetailContent and TaskDetailModal.
const MODIFIED_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  descriptionBlocks: 'Description',
  status: 'Status',
  priority: 'Priority',
  severity: 'Severity',
  category: 'Category',
  categoryOther: 'Category',
  resolution: 'Resolution',
  moduleId: 'Module',
  modules: 'Modules',
  milestoneId: 'Milestone',
  blocksMilestoneIds: 'Milestones',
  dueDate: 'Due Date',
  startDate: 'Start Date',
  estimatedHours: 'Estimated Hours',
  actualHours: 'Actual Hours',
  tags: 'Tags',
  checklist: 'Checklist',
  videoLinks: 'Video Links',
  assignees: 'Assignees',
  blockedTasks: 'Blocked Tasks',
  blockedByTasks: 'Blocked By',
  dependsOn: 'Dependencies',
};

export function modifiedFieldLabel(fieldKey: string): string {
  return MODIFIED_FIELD_LABELS[fieldKey] ?? fieldKey;
}

/** De-duplicated, human-readable comma list, e.g. "Status, Priority, Due Date". */
export function formatModifiedFields(fields: string[] | null | undefined): string | null {
  if (!fields || fields.length === 0) return null;
  const labels = Array.from(new Set(fields.map(modifiedFieldLabel)));
  return labels.join(', ');
}
