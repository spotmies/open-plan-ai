import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

export interface CommentAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  initials: string | null;
}

export interface Comment {
  id: string;
  content: string;
  entityType: 'task' | 'issue';
  entityId: string;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor | null;
  // Legacy compat fields
  author_id?: string;
  profiles?: {
    id: string;
    name: string;
    initials: string;
    avatar_url: string | null;
    email: string;
  };
}

export const commentsService = {
  async getByEntity(entityId: string, entityType: string): Promise<Comment[]> {
    const url =
      entityType === 'task'
        ? ENDPOINTS.TASKS.COMMENTS(entityId)
        : ENDPOINTS.ISSUES.COMMENTS(entityId);
    return apiClient.get(url);
  },

  async create(comment: {
    content: string;
    entity_id: string;
    entity_type: string;
    author_id?: string;
  }): Promise<Comment> {
    const url =
      comment.entity_type === 'task'
        ? ENDPOINTS.TASKS.COMMENTS(comment.entity_id)
        : ENDPOINTS.ISSUES.COMMENTS(comment.entity_id);
    return apiClient.post(url, { content: comment.content });
  },

  async update(commentId: string, content: string): Promise<Comment> {
    return apiClient.put(ENDPOINTS.COMMENTS.UPDATE(commentId), { content });
  },

  async delete(commentId: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.COMMENTS.DELETE(commentId));
  },
};
