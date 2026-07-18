import { apiClient } from './api/client';
import { ENDPOINTS } from './api/endpoints';
import { config } from '@/config';

export interface GoogleDriveStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

export const googleDriveService = {
  /**
   * Full backend URL that kicks off the OAuth flow. Must be used as a real
   * page navigation (`window.location.href = ...`), not an apiClient fetch —
   * the browser has to follow the redirect all the way to Google's consent
   * screen and back to our callback route.
   */
  getConnectUrl(orgId: string): string {
    const base = config.api.baseUrl.replace(/\/$/, '');
    return `${base}${ENDPOINTS.GOOGLE_DRIVE.CONNECT(orgId)}`;
  },

  async getStatus(orgId: string): Promise<GoogleDriveStatus> {
    return apiClient.get<GoogleDriveStatus>(ENDPOINTS.GOOGLE_DRIVE.STATUS(orgId));
  },

  async disconnect(orgId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.GOOGLE_DRIVE.DISCONNECT(orgId));
  },
};
