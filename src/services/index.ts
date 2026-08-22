// Barrel export for all services
export { projectsService } from './projects.service';
export { tasksService } from './tasks.service';
export { issuesService } from './issues.service';
export { authService } from './auth.service';
export { organizationsService } from './organizations.service';
export type { OrganizationSettings } from './organizations.service';
export { profileService } from './profile.service';
export type { Profile } from './profile.service';
export { milestonesService } from './milestones.service';
export { modulesService } from './modules.service';
export { activitiesService } from './activities.service';
export { teamService } from './team.service';
export { dashboardService } from './dashboard.service';
export { apiClient } from './api/client';
export { ENDPOINTS } from './api/endpoints';

// New services for project creation flow
export { attachmentsService } from './attachments.service';
export type { AttachmentRecord, CreateAttachmentInput } from './attachments.service';
export { projectLinksService } from './projectLinks.service';
export type { ProjectLink, CreateProjectLinkInput, UpdateProjectLinkInput } from './projectLinks.service';
export { projectMembersService } from './projectMembers.service';
export type { ProjectMember, ProjectMemberWithProfile, AddProjectMemberInput } from './projectMembers.service';
export { projectStorageService } from './projectStorage.service';
export type { UploadedProjectFile } from './projectStorage.service';
export { notificationsService } from './notifications.service';
export { commentsService } from './comments.service';
export type { Comment } from './comments.service';
