import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProjectMembers } from '@/hooks/useProjectTeam';
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
 * Centralized project-role permission hook. Reuses the existing
 * useProjectMembers query cache rather than issuing a new network call.
 * Org Admins get implicit Admin access to every project, even without an
 * explicit project_members row (mirrors the backend's loadProjectMember
 * fallback behavior).
 */
export function useProjectPermissions(projectId: string | undefined): ProjectPermissions {
  const { user } = useAuth();
  const { data: members = [], isLoading } = useProjectMembers(projectId);
  const { isOrgAdmin } = useOrgPermissions();

  return useMemo(() => {
    const myMembership = user ? members.find((m) => m.id === user.id) : undefined;
    const myProjectRole: ProjectRole | null = isOrgAdmin
      ? 'admin'
      : ((myMembership?.role as ProjectRole | undefined) ?? null);

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
  }, [user, members, isOrgAdmin, isLoading, projectId]);
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
