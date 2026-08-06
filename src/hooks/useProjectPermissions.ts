import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import type { OrgRole, ProjectRole } from '@/types';

export interface EditableResource {
  createdBy?: string | null;
  ownerId?: string | null;
  assigneeIds?: string[];
}

export interface ProjectPermissions {
  myProjectRole: ProjectRole | null;
  isProjectAdmin: boolean;
  isProjectMaintainerPlus: boolean;
  /** Project Member and above — false only when the user has no access at all. */
  isProjectMemberPlus: boolean;
  /** Admin-only: rename project, manage members/roles. */
  canManageProjectSettings: boolean;
  canManageMembers: boolean;
  /** Maintainer+ can manage everyone's content, not just their own. */
  canManageAnyContent: boolean;
  /** Member can edit only resources they created/own/are assigned to; Maintainer+ can edit anything. */
  canEditResource: (resource: EditableResource) => boolean;
  /** Deleting is stricter than editing: only the creator or an Admin (not a plain Maintainer, and not an assignee). */
  canDeleteResource: (resource: EditableResource) => boolean;
  isLoading: boolean;
}

/**
 * Centralized project-role permission hook. Reuses the useProjectDetail
 * query cache (shared with ProjectDetail) rather than issuing a new network
 * call. Deliberately NOT useProject — that hook shares the same query key
 * but a thinner queryFn (bare GET /projects/:id with no tasks/milestones/
 * issues), and since React Query replaces rather than merges cached data,
 * enabling it here would race with ProjectDetail's richer fetch and wipe
 * out project.issues/tasks/milestones for any mounted board.
 *
 * `myRole` comes straight from the backend's `GET /projects/:id` response,
 * which resolves it the same way `requireProjectRole` does: a direct
 * project_members row if one exists, otherwise implicit Admin when the
 * caller is an org Admin **of this project's own organization**. This is
 * deliberately *not* derived from the globally-selected organization
 * (`useOrgPermissions`/`currentOrganization`) — a user can be an org Admin
 * of one org while merely a project Member on a project that belongs to a
 * different org, and using the globally-selected org here would show
 * Admin-only controls the backend would then reject.
 */
export function useProjectPermissions(projectId: string | undefined): ProjectPermissions {
  const { user } = useAuth();
  const { data: project, isLoading } = useProjectDetail(projectId);

  return useMemo(() => {
    const myProjectRole: ProjectRole | null = (project?.myRole as ProjectRole | undefined) ?? null;

    const isProjectAdmin = myProjectRole === 'admin';
    const isProjectMaintainerPlus = myProjectRole === 'admin' || myProjectRole === 'maintainer';
    const isProjectMemberPlus = myProjectRole !== null;

    const canEditResource = (resource: EditableResource): boolean => {
      if (!user) return false;
      // No projectId means the resource has no project (e.g. a personal My
      // Tasks item) — there's no project role to check, so it's editable
      // only by its creator/owner, mirroring the backend's ownership check.
      if (projectId === undefined) {
        const ownerIds = [resource.createdBy, resource.ownerId, ...(resource.assigneeIds ?? [])];
        return ownerIds.includes(user.id);
      }
      if (!myProjectRole) return false;
      if (isProjectMaintainerPlus) return true;
      const ownerIds = [resource.createdBy, resource.ownerId, ...(resource.assigneeIds ?? [])];
      return ownerIds.includes(user.id);
    };

    // Deleting is admin-or-creator only — plain Maintainers and assignees
    // (who aren't the creator) cannot delete, unlike canEditResource above.
    const canDeleteResource = (resource: EditableResource): boolean => {
      if (!user) return false;
      if (projectId === undefined) {
        return resource.createdBy === user.id;
      }
      if (!myProjectRole) return false;
      if (isProjectAdmin) return true;
      return resource.createdBy === user.id;
    };

    return {
      myProjectRole,
      isProjectAdmin,
      isProjectMaintainerPlus,
      isProjectMemberPlus,
      canManageProjectSettings: isProjectAdmin,
      canManageMembers: isProjectAdmin,
      canManageAnyContent: isProjectMaintainerPlus,
      canEditResource,
      canDeleteResource,
      isLoading,
    };
  }, [user, project, isLoading, projectId]);
}

export interface OrgPermissions {
  myOrgRole: OrgRole | null;
  isOrgAdmin: boolean;
  isOrgMaintainer: boolean;
  /** Org membership management (invite/add/remove/role-change) is admin-only. */
  canManageOrgMembers: boolean;
  canManageOrgSettings: boolean;
  /** Any org member (admin or maintainer) can create projects. */
  canCreateProject: boolean;
}

/**
 * Lightweight org-role permission hook sourced from OrganizationContext's
 * currentOrganization.myRole — replaces scattered inline
 * `currentOrgRole === 'admin' || currentOrgRole === 'manager'` checks.
 */
export function useOrgPermissions(): OrgPermissions {
  const { currentOrganization } = useOrganization();
  const myOrgRole = currentOrganization?.myRole ?? null;
  const isOrgAdmin = myOrgRole === 'admin';
  const isOrgMaintainer = myOrgRole === 'maintainer';

  return {
    myOrgRole,
    isOrgAdmin,
    isOrgMaintainer,
    canManageOrgMembers: isOrgAdmin,
    canManageOrgSettings: isOrgAdmin,
    canCreateProject: isOrgAdmin || isOrgMaintainer,
  };
}
