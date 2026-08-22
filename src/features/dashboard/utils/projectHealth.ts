import { Project } from '@/types';

export type RagStatus = 'green' | 'amber' | 'red';

export const RAG_LABEL: Record<RagStatus, string> = {
  green: 'On track',
  amber: 'At risk',
  red: 'Off track',
};

// Tailwind-safe class lookups — never use raw hex in className per project convention.
export const RAG_DOT_CLASS: Record<RagStatus, string> = {
  green: 'bg-status-done',
  amber: 'bg-priority-medium',
  red: 'bg-status-blocked',
};

export const RAG_BAR_CLASS: Record<RagStatus, string> = {
  green: 'bg-status-done',
  amber: 'bg-priority-medium',
  red: 'bg-status-blocked',
};

export interface ProjectHealth {
  rag: RagStatus;
  days: number; // negative = overdue
}

/**
 * Mirrors the reference design's RAG heuristic: production+complete is green,
 * overdue-and-incomplete or an at-risk milestone is red, close-to-deadline
 * with low progress is amber, otherwise green.
 */
export function projectHealth(project: Project, hasAtRiskMilestone: boolean): ProjectHealth {
  const target = new Date(project.targetDate);
  const days = Math.round((target.getTime() - Date.now()) / 86400000);

  let rag: RagStatus;
  if (project.stage === 'production' && project.progress >= 95) {
    rag = 'green';
  } else if ((days < 0 && project.progress < 100) || hasAtRiskMilestone) {
    rag = 'red';
  } else if (days < 45 && project.progress < 80) {
    rag = 'amber';
  } else {
    rag = 'green';
  }
  return { rag, days };
}

export function varianceLabel(days: number): string {
  return days < 0 ? `${Math.abs(days)}d over` : `${days}d left`;
}
