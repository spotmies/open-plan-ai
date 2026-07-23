// Centralized API endpoint constants
export const ENDPOINTS = {
  // Auth
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password',
    SEND_OTP: '/auth/send-otp',
    VERIFY_OTP: '/auth/verify-otp',
    ME: '/auth/me',
  },
  // Users
  USERS: {
    ME: '/users/me',
    ME_PROFILE: '/users/me/profile',
    SEARCH: '/users/search',
    BY_ID: (id: string) => `/users/${id}`,
    ORGS: (id: string) => `/users/${id}/organizations`,
  },
  // Organizations
  ORGANIZATIONS: {
    MY: '/organizations/my',
    CREATE: '/organizations',
    BY_ID: (id: string) => `/organizations/${id}`,
    MEMBERS: (orgId: string) => `/organizations/${orgId}/members`,
    MEMBER_ROLE: (orgId: string, userId: string) => `/organizations/${orgId}/members/${userId}/role`,
    REMOVE_MEMBER: (orgId: string, userId: string) => `/organizations/${orgId}/members/${userId}`,
    INVITATIONS: (orgId: string) => `/organizations/${orgId}/invitations`,
    REVOKE_INVITATION: (orgId: string, invId: string) => `/organizations/${orgId}/invitations/${invId}`,
    ACCEPT_INVITATION: '/invitations/accept',
    MY_INVITATIONS: '/invitations/my',
    ACCEPT_BY_ID: (id: string) => `/invitations/${id}/accept`,
    ACTIVITIES: (orgId: string) => `/organizations/${orgId}/activities`,
    REPORTS_OVERVIEW: (orgId: string) => `/organizations/${orgId}/reports/overview`,
    ALL_TASKS: (orgId: string) => `/organizations/${orgId}/tasks`,
    ALL_ISSUES: (orgId: string) => `/organizations/${orgId}/issues`,
    LOGO: (orgId: string) => `/organizations/${orgId}/logo`,
  },
  // Projects
  PROJECTS: {
    LIST: (orgId: string) => `/organizations/${orgId}/projects`,
    CREATE: (orgId: string) => `/organizations/${orgId}/projects`,
    BY_ID: (id: string) => `/projects/${id}`,
    UPDATE: (id: string) => `/projects/${id}`,
    DELETE: (id: string) => `/projects/${id}`,
    STAGE: (id: string) => `/projects/${id}/stage`,
    PROGRESS: (id: string) => `/projects/${id}/progress`,
    MEMBERS: (id: string) => `/projects/${id}/members`,
    MEMBER: (projectId: string, userId: string) => `/projects/${projectId}/members/${userId}`,
    MEMBER_ROLE: (projectId: string, userId: string) => `/projects/${projectId}/members/${userId}/role`,
    CHAT: (id: string) => `/projects/${id}/chat`,
    TEAM: (id: string) => `/projects/${id}/team`,
    LINKS: (id: string) => `/projects/${id}/links`,
    ACTIVITIES: (id: string) => `/projects/${id}/activities`,
    REPORTS_OVERVIEW: (id: string) => `/projects/${id}/reports/overview`,
    REPORTS_VELOCITY: (id: string) => `/projects/${id}/reports/velocity`,
    REPORTS_TASK_DISTRIBUTION: (id: string) => `/projects/${id}/reports/task-distribution`,
    REPORTS_TEAM_WORKLOAD: (id: string) => `/projects/${id}/reports/team-workload`,
    REPORTS_BURNDOWN: (id: string) => `/projects/${id}/reports/burndown`,
    REPORTS_BOM_COST_TREND: (id: string) => `/projects/${id}/reports/bom-cost-trend`,
  },
  // Tasks
  TASKS: {
    LIST: (projectId: string) => `/projects/${projectId}/tasks`,
    CREATE: (projectId: string) => `/projects/${projectId}/tasks`,
    BY_ID: (id: string) => `/tasks/${id}`,
    STATUS: (id: string) => `/tasks/${id}/status`,
    ASSIGNEES: (id: string) => `/tasks/${id}/assignees`,
    ASSIGNEE: (taskId: string, userId: string) => `/tasks/${taskId}/assignees/${userId}`,
    MODULES: (id: string) => `/tasks/${id}/modules`,
    MODULE: (taskId: string, moduleId: string) => `/tasks/${taskId}/modules/${moduleId}`,
    DEPENDENCIES: (id: string) => `/tasks/${id}/dependencies`,
    DEPENDENCY: (taskId: string, depId: string) => `/tasks/${taskId}/dependencies/${depId}`,
    COMMENTS: (id: string) => `/tasks/${id}/comments`,
    ME_ALL: '/tasks/me/all',
  },
  // Hardware Modules
  MODULES: {
    LIST: (projectId: string) => `/projects/${projectId}/hardware-modules`,
    CREATE: (projectId: string) => `/projects/${projectId}/hardware-modules`,
    BY_ID: (id: string) => `/hardware-modules/${id}`,
  },
  // Milestones
  MILESTONES: {
    LIST: (projectId: string) => `/projects/${projectId}/milestones`,
    CREATE: (projectId: string) => `/projects/${projectId}/milestones`,
    BY_ID: (id: string) => `/milestones/${id}`,
    COMPLETE: (id: string) => `/milestones/${id}/complete`,
    TASKS: (id: string) => `/milestones/${id}/tasks`,
    TASK: (milestoneId: string, taskId: string) => `/milestones/${milestoneId}/tasks/${taskId}`,
    GENERATE_TASKS: (id: string) => `/milestones/${id}/generate-tasks`,
  },
  // Task Columns
  TASK_COLUMNS: {
    LIST: (projectId: string) => `/projects/${projectId}/task-columns`,
    CREATE: (projectId: string) => `/projects/${projectId}/task-columns`,
    REORDER: (projectId: string) => `/projects/${projectId}/task-columns/reorder`,
    BY_ID: (id: string) => `/task-columns/${id}`,
  },
  // Issue Columns
  ISSUE_COLUMNS: {
    LIST: (projectId: string) => `/projects/${projectId}/issue-columns`,
    CREATE: (projectId: string) => `/projects/${projectId}/issue-columns`,
    REORDER: (projectId: string) => `/projects/${projectId}/issue-columns/reorder`,
    BY_ID: (id: string) => `/issue-columns/${id}`,
  },
  // Tags (shared project-wide registry — reused by issues, tasks, and any future entity)
  TAGS: {
    LIST: (projectId: string) => `/projects/${projectId}/tags`,
    CREATE: (projectId: string) => `/projects/${projectId}/tags`,
    BY_ID: (id: string) => `/tags/${id}`,
  },
  // Issues
  ISSUES: {
    LIST: (projectId: string) => `/projects/${projectId}/issues`,
    LIST_ALL: (projectId: string) => `/projects/${projectId}/issues/all`,
    CREATE: (projectId: string) => `/projects/${projectId}/issues`,
    BY_ID: (id: string) => `/issues/${id}`,
    STATUS: (id: string) => `/issues/${id}/status`,
    ASSIGNEES: (id: string) => `/issues/${id}/assignees`,
    ASSIGNEE: (issueId: string, userId: string) => `/issues/${issueId}/assignees/${userId}`,
    TASK_LINKS: (id: string) => `/issues/${id}/task-links`,
    TASK_LINK: (issueId: string, taskId: string) => `/issues/${issueId}/task-links/${taskId}`,
    COMMENTS: (id: string) => `/issues/${id}/comments`,
  },
  // Customer-support intake API keys (management — authenticated)
  SUPPORT_LINKS: {
    LIST:       (projectId: string) => `/projects/${projectId}/support-links`,
    CREATE:     (projectId: string) => `/projects/${projectId}/support-links`,
    BY_ID:      (projectId: string, linkId: string) => `/projects/${projectId}/support-links/${linkId}`,
    REGENERATE: (projectId: string, linkId: string) => `/projects/${projectId}/support-links/${linkId}/regenerate`,
  },
  // BOM
  BOM: {
    TREE:              (projectId: string) => `/projects/${projectId}/bom/tree`,
    NODES:             (projectId: string) => `/projects/${projectId}/bom/nodes`,
    SUMMARY:           (projectId: string) => `/projects/${projectId}/bom/summary`,
    EXPORT:            (projectId: string) => `/projects/${projectId}/bom/export`,
    NODE:              (nodeId: string) => `/bom/nodes/${nodeId}`,
    NODE_MOVE:         (nodeId: string) => `/bom/nodes/${nodeId}/parent`,
    NODE_REQUIREMENTS: (nodeId: string) => `/bom/nodes/${nodeId}/requirements`,
    REQ_LINK:          (linkId: string) => `/bom/requirement-links/${linkId}`,
    NODE_APPROVALS:    (nodeId: string) => `/bom/nodes/${nodeId}/approvals`,
    APPROVAL_REQUESTS:        (nodeId: string) => `/bom/nodes/${nodeId}/approval-requests`,
    APPROVAL_REQUEST_DECISION:(requestId: string) => `/bom/approval-requests/${requestId}/decision`,
    PROJECT_APPROVAL_REQUESTS:(projectId: string) => `/projects/${projectId}/bom/approval-requests`,
    NODE_NOTES:        (nodeId: string) => `/bom/nodes/${nodeId}/notes`,
  },
  // BOM import — AI-assisted column mapping fallback for Excel import
  BOM_IMPORT: {
    MAP_COLUMNS: () => `/bom/import/map-columns`,
    FIX_ROW:     () => `/bom/import/fix-row`,
  },
  // Parts catalog (org-scoped)
  PARTS: {
    LIST:      (orgId: string)  => `/organizations/${orgId}/parts`,
    CREATE:    (orgId: string)  => `/organizations/${orgId}/parts`,
    CHECK:     (orgId: string)  => `/organizations/${orgId}/parts/check`,
    BY_ID:     (partId: string) => `/parts/${partId}`,
    REVISIONS: (partId: string) => `/parts/${partId}/revisions`,
    WHERE_USED:(partId: string) => `/parts/${partId}/where-used`,
  },
  // Notifications
  NOTIFICATIONS: {
    LIST: '/notifications',
    COUNT: '/notifications/count',
    STATS: '/notifications/stats',
    READ_ALL: '/notifications/read-all',
    READ: (id: string) => `/notifications/${id}/read`,
    DELETE: (id: string) => `/notifications/${id}`,
    CLEAR_READ: '/notifications/read',
    PREFERENCES: '/notification-preferences',
  },
  // Comments
  COMMENTS: {
    UPDATE: (id: string) => `/comments/${id}`,
    DELETE: (id: string) => `/comments/${id}`,
  },
  // Chat messages (single-message operations, not nested under a conversation)
  MESSAGES: {
    DELETE: (messageId: string) => `/messages/${messageId}`,
  },
  // Message reactions
  REACTIONS: {
    TOGGLE: (messageId: string) => `/messages/${messageId}/reactions`,
    BULK: '/messages/reactions',
  },
  // Pinned / favourite messages
  PINS: {
    TOGGLE: (conversationId: string, messageId: string) => `/conversations/${conversationId}/messages/${messageId}/pin`,
    LIST: (conversationId: string) => `/conversations/${conversationId}/pins`,
  },
  FAVOURITES: {
    TOGGLE: (messageId: string) => `/messages/${messageId}/favourite`,
    LIST: (conversationId: string) => `/conversations/${conversationId}/favourites`,
  },
  // Chat / Conversations
  CONVERSATIONS: {
    LIST: '/conversations',
    CREATE: '/conversations',
    BY_ID: (id: string) => `/conversations/${id}`,
    MESSAGES: (id: string) => `/conversations/${id}/messages`,
    FILE_MESSAGE: (id: string) => `/conversations/${id}/messages/file`,
    READ: (id: string) => `/conversations/${id}/read`,
    NOTIFICATIONS: (id: string) => `/conversations/${id}/notifications`,
    MEMBERS: (id: string) => `/conversations/${id}/members`,
    MEMBER: (conversationId: string, userId: string) => `/conversations/${conversationId}/members/${userId}`,
    FILES: (id: string) => `/conversations/${id}/files`,
    MUTUAL_PROJECTS: (id: string) => `/conversations/${id}/mutual-projects`,
  },
  // Engineering Changes (ECO)
  ECOS: {
    LIST:     (projectId: string) => `/projects/${projectId}/ecos`,
    STATS:    (projectId: string) => `/projects/${projectId}/ecos/stats`,
    CREATE:   (projectId: string) => `/projects/${projectId}/ecos`,
    BY_ID:    (projectId: string, ecoId: string) => `/projects/${projectId}/ecos/${ecoId}`,
    UPDATE:   (projectId: string, ecoId: string) => `/projects/${projectId}/ecos/${ecoId}`,
    DELETE:   (projectId: string, ecoId: string) => `/projects/${projectId}/ecos/${ecoId}`,
    SUBMIT:   (projectId: string, ecoId: string) => `/projects/${projectId}/ecos/${ecoId}/submit`,
    DECISION: (projectId: string, ecoId: string) => `/projects/${projectId}/ecos/${ecoId}/decision`,
    RELEASE:  (projectId: string, ecoId: string) => `/projects/${projectId}/ecos/${ecoId}/release`,
    VERIFY:   (projectId: string, ecoId: string) => `/projects/${projectId}/ecos/${ecoId}/verify`,
    CLOSE:    (projectId: string, ecoId: string) => `/projects/${projectId}/ecos/${ecoId}/close`,
    HOLD:     (projectId: string, ecoId: string) => `/projects/${projectId}/ecos/${ecoId}/hold`,
    RESUME:   (projectId: string, ecoId: string) => `/projects/${projectId}/ecos/${ecoId}/resume`,
    ECN:      (projectId: string, ecoId: string) => `/projects/${projectId}/ecos/${ecoId}/ecn`,
    ECN_PDF:  (projectId: string, ecoId: string) => `/projects/${projectId}/ecos/${ecoId}/ecn/pdf`,
  },
  // Links
  LINKS: {
    DELETE: (id: string) => `/links/${id}`,
  },
  // Google Meet integration
  GOOGLE_MEET: {
    CONNECT: '/integrations/google-meet/connect',
    DISCONNECT: '/integrations/google-meet/disconnect',
    STATUS: (userIds: string[]) => `/integrations/google-meet/status?userIds=${userIds.join(',')}`,
    ACCESS_TOKEN: '/integrations/google-meet/access-token',
  },
  // Google Drive integration (org-level — connecting switches storage for
  // project-level file uploads from S3 to the org's own Drive)
  GOOGLE_DRIVE: {
    CONNECT: (orgId: string) => `/organizations/${orgId}/integrations/google-drive/connect`,
    DISCONNECT: (orgId: string) => `/organizations/${orgId}/integrations/google-drive/disconnect`,
    STATUS: (orgId: string) => `/organizations/${orgId}/integrations/google-drive/status`,
  },
  // Uploads
  UPLOADS: {
    AVATAR: '/uploads/avatar',
    GROUP_AVATAR: '/uploads/group-avatar',
    ATTACHMENTS: '/uploads/attachments',
    ATTACHMENT_LINK: '/uploads/attachments/link',
    ATTACHMENT: (id: string) => `/uploads/attachments/${id}`,
    BY_ENTITY: (entityType: string, entityId: string) => `/uploads/attachments/${entityType}/${entityId}`,
  },
};
