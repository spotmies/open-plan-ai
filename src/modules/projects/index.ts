// ── Projects Module — Public API ──────────────────────────────────────────────
// Bridge re-exports from legacy src/features/projects/ during migration.
// Move files here incrementally and update these exports to point to local paths.

// Pages
export { default as Projects }     from '@/features/projects/Projects';
export { default as ProjectDetail } from '@/features/projects/ProjectDetail';
export { default as NewProject }    from '@/features/projects/NewProject';
export { default as EditProject }   from '@/features/projects/EditProject';
export { default as IssuePage }     from '@/features/projects/IssuePage';

// Hooks (public API — callers must use these, not internal hooks directly)
export { useProjectDetail, useProjectModules } from '@/hooks/useProjectDetail';
export { useProjects, useProject, useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/useProjects';
export { useProjectMutations } from '@/hooks/useProjectMutations';

// Stores
export { useProjectStore, useSelectedProject, useProjectById } from '@/stores/useProjectStore';

// Types
export type { Project, Task, Module, Milestone, Issue } from '@/types';
