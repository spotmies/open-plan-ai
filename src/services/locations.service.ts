import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

// Org-wide registry of stock locations. The backend also auto-registers any
// location string used on a receive/adjust/order mutation, so this service's
// `create` is mostly a convenience for explicit "save this location" flows —
// most locations show up here just from being used once.
export interface CreateLocationInput {
  name: string;
}

interface ApiLocation {
  id: string;
  orgId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export const locationsService = {
  async getByOrgId(orgId: string): Promise<string[]> {
    const data = await apiClient.get<ApiLocation[]>(ENDPOINTS.LOCATIONS.LIST(orgId));
    return (data || []).map((loc) => loc.name);
  },

  async create(orgId: string, input: CreateLocationInput): Promise<string> {
    const data = await apiClient.post<ApiLocation>(ENDPOINTS.LOCATIONS.CREATE(orgId), input);
    return data.name;
  },
};
