import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

export interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  avatarUrl?: string | null;
  initials: string;
  jobTitle?: string | null;
}

function mapToProfile(data: Record<string, unknown>): Profile {
  return {
    id: data.id as string,
    email: data.email as string,
    name: (data.name as string) || '',
    avatar_url: (data.avatarUrl as string | null) ?? (data.avatar_url as string | null) ?? null,
    avatarUrl: (data.avatarUrl as string | null) ?? (data.avatar_url as string | null) ?? null,
    initials: (data.initials as string) || '',
    jobTitle: (data.jobTitle as string | null) ?? null,
  };
}

export const profileService = {
  async getProfile(): Promise<Profile | null> {
    try {
      const data = await apiClient.get<Record<string, unknown>>(ENDPOINTS.USERS.ME_PROFILE);
      return mapToProfile(data);
    } catch {
      return null;
    }
  },

  async updateProfile(updates: Partial<Omit<Profile, 'id' | 'email'>>): Promise<Profile> {
    const data = await apiClient.put<Record<string, unknown>>(ENDPOINTS.USERS.ME_PROFILE, updates);
    return mapToProfile(data);
  },

  async uploadAvatar(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await apiClient.raw.post<{ success: boolean; data: { avatarUrl: string } }>(
      ENDPOINTS.UPLOADS.AVATAR,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data.avatarUrl;
  },

  async deleteAvatar(): Promise<void> {
    await apiClient.delete<void>(ENDPOINTS.UPLOADS.AVATAR);
  },

  async updatePassword(_newPassword: string): Promise<void> {
    throw new Error('Password update is not yet supported via this service. Use the auth endpoints.');
  },

  async deleteAccount(): Promise<void> {
    throw new Error('Account deletion is not yet supported in this backend version.');
  },
};
